import type { Request, Response } from "express";
import prisma from "../prisma.js";
import { STATUS_LABELS, TYPE_LABELS, PRIORITY_LABELS, DEVICE_TYPE_LABELS } from "../lib/labels.js";
import { dateOnly } from "../lib/format.js";
import { REQUEST_STATUSES, REQUEST_TYPES, PRIORITIES } from "../lib/transitions.js";

const PAGE_SIZE = 20;

function parsePage(raw: unknown): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function pageNumbers(page: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(page - 3, total - 6));
  return Array.from({ length: 7 }, (_, i) => start + i);
}

const commonLocals = {
  statuses: REQUEST_STATUSES,
  types: REQUEST_TYPES,
  priorities: PRIORITIES,
  statusLabels: STATUS_LABELS,
  typeLabels: TYPE_LABELS,
  priorityLabels: PRIORITY_LABELS,
  deviceTypeLabels: DEVICE_TYPE_LABELS,
  dateOnly,
};

/** GET /devices — список пристроїв: пошук + пагінація (PAGES.md §4.9). */
export async function index(req: Request, res: Response) {
  const q = String(req.query.q ?? "").trim();
  const page = parsePage(req.query.page);

  const where: Record<string, unknown> = { deletedAt: null };
  if (q) {
    where.OR = [
      { brand: { contains: q, mode: "insensitive" as const } },
      { model: { contains: q, mode: "insensitive" as const } },
      { serialNumber: { contains: q, mode: "insensitive" as const } },
    ];
  }

  const total = await prisma.device.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const items = await prisma.device.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { requests: true } },
    },
    orderBy: { brand: "asc" },
    skip: (cur - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const base = `/devices${q ? `?q=${encodeURIComponent(q)}&` : "?"}`;
  res.render("devices/index", {
    nav: "devices",
    items,
    total,
    page: cur,
    totalPages,
    pageNumbers: pageNumbers(cur, totalPages),
    base,
    shownFrom: total === 0 ? 0 : (cur - 1) * PAGE_SIZE + 1,
    shownTo: Math.min(total, cur * PAGE_SIZE),
    q,
    ...commonLocals,
  });
}

/** GET /devices/:id — картка пристрою: характеристики, власник, історія (PAGES.md §4.10). */
export async function show(req: Request, res: Response) {
  const id = String(req.params.id ?? "");

  const d = await prisma.device.findUnique({
    where: { id },
    include: {
      owner: true,
      requests: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!d || d.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  res.render("devices/show", { nav: "devices", d, ...commonLocals });
}
