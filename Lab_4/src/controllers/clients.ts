import type { Request, Response } from "express";
import prisma from "../prisma.js";
import {
  STATUS_LABELS,
  TYPE_LABELS,
  PRIORITY_LABELS,
  DEVICE_TYPE_LABELS,
} from "../lib/labels.js";
import { dateOnly } from "../lib/format.js";
import { REQUEST_STATUSES, REQUEST_TYPES, PRIORITIES } from "../lib/transitions.js";
import { clean, isEmail, isPhone, isUaPhone, tooLong, isUniqueViolation } from "../lib/validate.js";

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

/** GET /clients — список клієнтів: пошук + пагінація (PAGES.md §4.7). */
export async function index(req: Request, res: Response) {
  const q = String(req.query.q ?? "").trim();
  const page = parsePage(req.query.page);

  const where: Record<string, unknown> = { deletedAt: null };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" as const } },
      { phone: { contains: q, mode: "insensitive" as const } },
      { email: { contains: q, mode: "insensitive" as const } },
    ];
  }

  const total = await prisma.client.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const items = await prisma.client.findMany({
    where,
    include: { _count: { select: { requests: true, devices: true } } },
    orderBy: { name: "asc" },
    skip: (cur - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const base = `/clients${q ? `?q=${encodeURIComponent(q)}&` : "?"}`;
  res.render("clients/index", {
    nav: "clients",
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

/** GET /clients/:id — картка клієнта: контакти, пристрої, історія заявок (PAGES.md §4.8). */
export async function show(req: Request, res: Response) {
  const id = String(req.params.id ?? "");

  const c = await prisma.client.findUnique({
    where: { id },
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

  if (!c || c.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  res.render("clients/show", { nav: "clients", c, ...commonLocals });
}

/** GET /clients/new — форма створення клієнта. */
export async function createForm(_req: Request, res: Response) {
  res.render("clients/create", {
    nav: "clients",
    errors: [] as string[],
    values: {},
    ...commonLocals,
  });
}

/** POST /clients — створення клієнта. */
export async function create(req: Request, res: Response) {
  const b = req.body ?? {};
  const name = clean(b.name);
  const phone = clean(b.phone);
  const email = clean(b.email);
  const address = clean(b.address);
  const notes = clean(b.notes);

  const errors: string[] = [];
  if (!name) {
    errors.push("Вкажіть ім'я / назву");
  } else if (name.length < 2) {
    errors.push("Ім'я / назва: мінімум 2 символи");
  } else if (tooLong(name, 100)) {
    errors.push("Ім'я / назва: до 100 символів");
  }

  if (!phone) {
    errors.push("Вкажіть телефон");
  } else if (!isUaPhone(phone)) {
    errors.push("Телефон: +380 + 9 цифр (напр., +380671234501) або 0 + 9 цифр (напр., 0671234501)");
  }

  if (email) {
    if (tooLong(email, 320)) {
      errors.push("Email: до 320 символів");
    } else if (!isEmail(email)) {
      errors.push("Email: некоректний формат");
    } else {
      const existing = await prisma.client.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
      });
      if (existing) {
        errors.push("Email вже використовується іншим клієнтом");
      }
    }
  }

  if (tooLong(address, 200)) {
    errors.push("Адреса: до 200 символів");
  }

  if (tooLong(notes, 500)) {
    errors.push("Примітки: до 500 символів");
  }

  const values = { name, phone, email, address, notes };

  if (errors.length > 0) {
    res.status(400).render("clients/create", {
      nav: "clients",
      errors,
      values,
      ...commonLocals,
    });
    return;
  }

  try {
    const created = await prisma.client.create({
      data: {
        name,
        phone,
        email: email || null,
        address: address || null,
        notes: notes || null,
      },
    });
    res.redirect(`/clients/${created.id}`);
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(400).render("clients/create", {
        nav: "clients",
        errors: ["Email вже використовується іншим клієнтом"],
        values,
        ...commonLocals,
      });
      return;
    }
    throw err;
  }
}

/** GET /clients/:id/edit — форма редагування клієнта. */
export async function editForm(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const c = await prisma.client.findUnique({ where: { id } });
  if (!c || c.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  res.render("clients/edit", {
    nav: "clients",
    c,
    errors: [] as string[],
    values: null,
    ...commonLocals,
  });
}

/** POST /clients/:id/edit — збереження змін клієнта. */
export async function edit(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const c = await prisma.client.findUnique({ where: { id } });
  if (!c || c.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  const b = req.body ?? {};
  const name = clean(b.name);
  const phone = clean(b.phone);
  const email = clean(b.email);
  const address = clean(b.address);
  const notes = clean(b.notes);

  const errors: string[] = [];
  if (!name) {
    errors.push("Вкажіть ім'я / назву");
  } else if (name.length < 2) {
    errors.push("Ім'я / назва: мінімум 2 символи");
  } else if (tooLong(name, 100)) {
    errors.push("Ім'я / назва: до 100 символів");
  }

  if (!phone) {
    errors.push("Вкажіть телефон");
  } else if (!isUaPhone(phone)) {
    errors.push("Телефон: +380 + 9 цифр (напр., +380671234501) або 0 + 9 цифр (напр., 0671234501)");
  }

  if (email) {
    if (tooLong(email, 320)) {
      errors.push("Email: до 320 символів");
    } else if (!isEmail(email)) {
      errors.push("Email: некоректний формат");
    } else {
      const existing = await prisma.client.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, deletedAt: null, id: { not: id } },
      });
      if (existing) {
        errors.push("Email вже використовується іншим клієнтом");
      }
    }
  }

  if (tooLong(address, 200)) {
    errors.push("Адреса: до 200 символів");
  }

  if (tooLong(notes, 500)) {
    errors.push("Примітки: до 500 символів");
  }

  const values = { name, phone, email, address, notes };

  if (errors.length > 0) {
    res.status(400).render("clients/edit", {
      nav: "clients",
      c,
      errors,
      values,
      ...commonLocals,
    });
    return;
  }

  try {
    await prisma.client.update({
      where: { id },
      data: {
        name,
        phone,
        email: email || null,
        address: address || null,
        notes: notes || null,
      },
    });
    res.redirect(`/clients/${id}`);
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(400).render("clients/edit", {
        nav: "clients",
        c,
        errors: ["Email вже використовується іншим клієнтом"],
        values,
        ...commonLocals,
      });
      return;
    }
    throw err;
  }
}

/** POST /clients/:id/delete — м'яке видалення (soft delete, deletedAt). */
export async function remove(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const c = await prisma.client.findUnique({ where: { id } });
  if (!c || c.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }
  await prisma.client.update({ where: { id }, data: { deletedAt: new Date() } });
  res.redirect("/clients");
}

/** GET /clients/:id/delete — сторінка підтвердження видалення (server-side, замість браузерного confirm). */
export async function confirmRemove(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const c = await prisma.client.findUnique({ where: { id } });
  if (!c || c.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }
  res.render("confirm-delete", {
    nav: "none",
    confirmTitle: "Видалити клієнта?",
    confirmSummary: c.phone ? `${c.name} · ${c.phone}` : c.name,
    confirmAction: `/clients/${c.id}/delete`,
    confirmBack: `/clients/${c.id}`,
  });
}
