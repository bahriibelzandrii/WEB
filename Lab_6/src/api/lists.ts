// src/api/lists.ts — /api: публічні читання (списки + картки) для всіх ролей.
// Фільтри/пошук/інклудзи дублюють web-контролери (PAGES.md §4), формат — JSON.
import type { Request, Response } from "express";
import prisma from "../prisma.js";
import { REQUEST_STATUSES, REQUEST_TYPES, PRIORITIES } from "../lib/transitions.js";
import { parsePageQuery } from "./http.js";

const INS = { mode: "insensitive" as const };

function envelope(res: Response, data: unknown, page: number, pageSize: number, total: number) {
  res.json({ data, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

function notFound(res: Response) {
  res.status(404).json({ error: "Not found" });
}

// ───────────────────────── Клієнти (Lab 3) ─────────────────────────

export async function listClients(req: Request, res: Response) {
  const pq = parsePageQuery(req);
  const q = String(req.query.q ?? "").trim();
  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q, ...INS } },
            { phone: { contains: q } },
            { email: { contains: q, ...INS } },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { name: "asc" },
      skip: pq.skip,
      take: pq.pageSize,
    }),
    prisma.client.count({ where }),
  ]);
  envelope(res, data, pq.page, pq.pageSize, total);
}

export async function getClient(req: Request, res: Response) {
  const c = await prisma.client.findUnique({
    where: { id: String(req.params.id ?? "") },
    include: {
      devices: {
        where: { deletedAt: null },
        include: { _count: { select: { requests: true } } },
        orderBy: { createdAt: "asc" },
      },
      requests: {
        where: { deletedAt: null },
        include: { device: { select: { brand: true, model: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!c || c.deletedAt) return notFound(res);
  res.json({ data: c });
}

// ───────────────────────── Пристрої (Lab 3) ─────────────────────────

export async function listDevices(req: Request, res: Response) {
  const pq = parsePageQuery(req);
  const q = String(req.query.q ?? "").trim();
  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { brand: { contains: q, ...INS } },
            { model: { contains: q, ...INS } },
            { owner: { name: { contains: q, ...INS } } },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.device.findMany({
      where,
      include: { owner: { select: { id: true, name: true } } },
      orderBy: { brand: "asc" },
      skip: pq.skip,
      take: pq.pageSize,
    }),
    prisma.device.count({ where }),
  ]);
  envelope(res, data, pq.page, pq.pageSize, total);
}

export async function getDevice(req: Request, res: Response) {
  const d = await prisma.device.findUnique({
    where: { id: String(req.params.id ?? "") },
    include: {
      owner: true,
      requests: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!d || d.deletedAt) return notFound(res);
  res.json({ data: d });
}

// ───────────────────────── Каталоги (Lab 3) ─────────────────────────

export async function listWorks(req: Request, res: Response) {
  const pq = parsePageQuery(req);
  const q = String(req.query.q ?? "").trim();
  const where = q
    ? { OR: [{ name: { contains: q, ...INS } }, { description: { contains: q, ...INS } }] }
    : {};
  const [data, total] = await Promise.all([
    prisma.workCatalog.findMany({ where, orderBy: { name: "asc" }, skip: pq.skip, take: pq.pageSize }),
    prisma.workCatalog.count({ where }),
  ]);
  envelope(res, data, pq.page, pq.pageSize, total);
}

export async function getWork(req: Request, res: Response) {
  const w = await prisma.workCatalog.findUnique({ where: { id: String(req.params.id ?? "") } });
  if (!w) return notFound(res);
  res.json({ data: w });
}

export async function listParts(req: Request, res: Response) {
  const pq = parsePageQuery(req);
  const q = String(req.query.q ?? "").trim();
  const where = q
    ? { OR: [{ name: { contains: q, ...INS } }, { sku: { contains: q, ...INS } }] }
    : {};
  const [data, total] = await Promise.all([
    prisma.part.findMany({ where, orderBy: { name: "asc" }, skip: pq.skip, take: pq.pageSize }),
    prisma.part.count({ where }),
  ]);
  envelope(res, data, pq.page, pq.pageSize, total);
}

export async function getPart(req: Request, res: Response) {
  const p = await prisma.part.findUnique({ where: { id: String(req.params.id ?? "") } });
  if (!p) return notFound(res);
  res.json({ data: p });
}

// ───────────────────────── Заявки (Lab 3–4) ─────────────────────────

/** Повний include картки заявки (дублює showData web-контролера, без довідників). */
export async function fetchRequestFull(id: string) {
  return prisma.request.findUnique({
    where: { id },
    include: {
      client: true,
      device: true,
      createdBy: { omit: { password: true } },
      assignedTo: { omit: { password: true } },
      diagnostics: { include: { technician: { omit: { password: true } } } },
      works: {
        include: { technician: { omit: { password: true } } },
        orderBy: { createdAt: "asc" },
      },
      parts: { include: { part: true }, orderBy: { createdAt: "asc" } },
      estimate: { include: { createdBy: { omit: { password: true } } } },
      invoice: { include: { payments: { orderBy: { paidAt: "asc" } } } },
      warranty: true,
      comments: {
        include: { author: { omit: { password: true } } },
        orderBy: { createdAt: "asc" },
      },
      attachments: { include: { uploadedBy: { omit: { password: true } } } },
    },
  });
}

export async function listRequests(req: Request, res: Response) {
  const pq = parsePageQuery(req);
  const status = String(req.query.status ?? "").trim();
  const type = String(req.query.type ?? "").trim();
  const priority = String(req.query.priority ?? "").trim();
  const q = String(req.query.q ?? "").trim();

  if (status && !(REQUEST_STATUSES as readonly string[]).includes(status)) {
    res.status(400).json({ error: `Unknown status: ${status}` });
    return;
  }
  if (type && !(REQUEST_TYPES as readonly string[]).includes(type)) {
    res.status(400).json({ error: `Unknown type: ${type}` });
    return;
  }
  if (priority && !(PRIORITIES as readonly string[]).includes(priority)) {
    res.status(400).json({ error: `Unknown priority: ${priority}` });
    return;
  }

  const where = {
    deletedAt: null,
    ...(status ? { status: status as (typeof REQUEST_STATUSES)[number] } : {}),
    ...(type ? { type: type as (typeof REQUEST_TYPES)[number] } : {}),
    ...(priority ? { priority: priority as (typeof PRIORITIES)[number] } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, ...INS } },
            { client: { name: { contains: q, ...INS } } },
            {
              device: {
                OR: [{ brand: { contains: q, ...INS } }, { model: { contains: q, ...INS } }],
              },
            },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.request.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        device: { select: { id: true, brand: true, model: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: pq.skip,
      take: pq.pageSize,
    }),
    prisma.request.count({ where }),
  ]);
  envelope(res, data, pq.page, pq.pageSize, total);
}

export async function getRequest(req: Request, res: Response) {
  const r = await fetchRequestFull(String(req.params.id ?? ""));
  if (!r || r.deletedAt) return notFound(res);
  res.json({ data: r });
}

// ───────────────────────── Користувачі (Lab 5, ADMIN) ─────────────────────────

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
};

export async function listUsers(req: Request, res: Response) {
  const q = String(req.query.q ?? "").trim();
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, ...INS } },
            { email: { contains: q, ...INS } },
            { phone: { contains: q } },
          ],
        }
      : {},
    select: USER_SELECT,
    orderBy: { name: "asc" },
  });
  res.json({ data: users });
}

export async function getUser(req: Request, res: Response) {
  const u = await prisma.user.findUnique({
    where: { id: String(req.params.id ?? "") },
    select: USER_SELECT,
  });
  if (!u) return notFound(res);
  res.json({ data: u });
}

/** Повна картка заявки (Prisma include) — форма відповіді /api/requests/:id. */
export type RequestFull = NonNullable<Awaited<ReturnType<typeof fetchRequestFull>>>;
