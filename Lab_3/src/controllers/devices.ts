import type { Request, Response } from "express";
import prisma from "../prisma.js";
import { STATUS_LABELS, TYPE_LABELS, PRIORITY_LABELS, DEVICE_TYPE_LABELS } from "../lib/labels.js";
import { dateOnly } from "../lib/format.js";
import { REQUEST_STATUSES, REQUEST_TYPES, PRIORITIES, DEVICE_TYPES, type DeviceType } from "../lib/transitions.js";
import { clean, tooLong, parseDateOnly, MIN_DATE } from "../lib/validate.js";

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
  deviceTypes: DEVICE_TYPES,
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

/** GET /devices/new — форма створення пристрою. */
export async function createForm(_req: Request, res: Response) {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });

  res.render("devices/create", {
    nav: "devices",
    clients,
    values: {},
    errors: [],
    ...commonLocals,
  });
}

/** POST /devices — створення пристрою. */
export async function create(req: Request, res: Response) {
  const type = clean(req.body.type);
  const brand = clean(req.body.brand);
  const model = clean(req.body.model);
  const serialNumber = clean(req.body.serialNumber);
  const specs = clean(req.body.specs);
  const purchasedAt = clean(req.body.purchasedAt);
  const ownerId = clean(req.body.ownerId);

  const errors: string[] = [];

  if (!DEVICE_TYPES.includes(type as DeviceType)) {
    errors.push("Оберіть тип пристрою");
  }

  if (!brand) {
    errors.push("Вкажіть бренд");
  } else if (brand.length < 2) {
    errors.push("Бренд: мінімум 2 символи");
  } else if (tooLong(brand, 100)) {
    errors.push("Бренд: до 100 символів");
  }

  if (!model) {
    errors.push("Вкажіть модель");
  } else if (model.length < 2) {
    errors.push("Модель: мінімум 2 символи");
  } else if (tooLong(model, 100)) {
    errors.push("Модель: до 100 символів");
  }

  if (tooLong(serialNumber, 100)) {
    errors.push("Серійний номер: до 100 символів");
  }

  if (tooLong(specs, 200)) {
    errors.push("Характеристики: до 200 символів");
  }

  let parsedDate: Date | null = null;
  if (purchasedAt) {
    parsedDate = parseDateOnly(purchasedAt);
    if (!parsedDate) {
      errors.push("Дата покупки: некоректний формат (YYYY-MM-DD)");
    } else {
      const tomorrowMidnight = new Date();
      tomorrowMidnight.setHours(0, 0, 0, 0);
      tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);
      if (parsedDate >= tomorrowMidnight) {
        errors.push("Дата покупки: не може бути в майбутньому");
      } else if (parsedDate.getTime() < MIN_DATE) {
        errors.push("Дата покупки: не може бути раніше 1990 року");
      }
    }
  }

  const client = ownerId
    ? await prisma.client.findFirst({ where: { id: ownerId, deletedAt: null } })
    : null;
  if (!client) {
    errors.push("Оберіть власника (клієнта)");
  }

  const values = { type, brand, model, serialNumber, specs, purchasedAt, ownerId };

  if (errors.length > 0) {
    const clients = await prisma.client.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    });
    res.status(400).render("devices/create", {
      nav: "devices",
      errors,
      values,
      clients,
      ...commonLocals,
    });
    return;
  }

  const created = await prisma.device.create({
    data: {
      type: type as DeviceType,
      brand,
      model,
      serialNumber: serialNumber || null,
      specs: specs || null,
      purchasedAt: parsedDate,
      ownerId,
    },
  });

  res.redirect(`/devices/${created.id}`);
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

/** GET /devices/:id/edit — форма редагування пристрою. */
export async function editForm(req: Request, res: Response) {
  const id = String(req.params.id ?? "");

  const d = await prisma.device.findUnique({
    where: { id },
  });

  if (!d || d.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });

  res.render("devices/edit", {
    nav: "devices",
    d,
    clients,
    values: null,
    errors: [],
    ...commonLocals,
  });
}

/** POST /devices/:id/edit — збереження змін пристрою. */
export async function edit(req: Request, res: Response) {
  const id = String(req.params.id ?? "");

  const d = await prisma.device.findUnique({
    where: { id },
  });

  if (!d || d.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  const type = clean(req.body.type);
  const brand = clean(req.body.brand);
  const model = clean(req.body.model);
  const serialNumber = clean(req.body.serialNumber);
  const specs = clean(req.body.specs);
  const purchasedAt = clean(req.body.purchasedAt);
  const ownerId = clean(req.body.ownerId);

  const errors: string[] = [];

  if (!DEVICE_TYPES.includes(type as DeviceType)) {
    errors.push("Оберіть тип пристрою");
  }

  if (!brand) {
    errors.push("Вкажіть бренд");
  } else if (brand.length < 2) {
    errors.push("Бренд: мінімум 2 символи");
  } else if (tooLong(brand, 100)) {
    errors.push("Бренд: до 100 символів");
  }

  if (!model) {
    errors.push("Вкажіть модель");
  } else if (model.length < 2) {
    errors.push("Модель: мінімум 2 символи");
  } else if (tooLong(model, 100)) {
    errors.push("Модель: до 100 символів");
  }

  if (tooLong(serialNumber, 100)) {
    errors.push("Серійний номер: до 100 символів");
  }

  if (tooLong(specs, 200)) {
    errors.push("Характеристики: до 200 символів");
  }

  let parsedDate: Date | null = null;
  if (purchasedAt) {
    parsedDate = parseDateOnly(purchasedAt);
    if (!parsedDate) {
      errors.push("Дата покупки: некоректний формат (YYYY-MM-DD)");
    } else {
      const tomorrowMidnight = new Date();
      tomorrowMidnight.setHours(0, 0, 0, 0);
      tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);
      if (parsedDate >= tomorrowMidnight) {
        errors.push("Дата покупки: не може бути в майбутньому");
      } else if (parsedDate.getTime() < MIN_DATE) {
        errors.push("Дата покупки: не може бути раніше 1990 року");
      }
    }
  }

  const client = ownerId
    ? await prisma.client.findFirst({ where: { id: ownerId, deletedAt: null } })
    : null;
  if (!client) {
    errors.push("Оберіть власника (клієнта)");
  }

  const values = { type, brand, model, serialNumber, specs, purchasedAt, ownerId };

  if (errors.length > 0) {
    const clients = await prisma.client.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    });
    res.status(400).render("devices/edit", {
      nav: "devices",
      d,
      errors,
      values,
      clients,
      ...commonLocals,
    });
    return;
  }

  await prisma.device.update({
    where: { id },
    data: {
      type: type as DeviceType,
      brand,
      model,
      serialNumber: serialNumber || null,
      specs: specs || null,
      purchasedAt: parsedDate,
      ownerId,
    },
  });

  res.redirect(`/devices/${id}`);
}

/** POST /devices/:id/delete — м'яке видалення (soft delete, deletedAt). */
export async function remove(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const d = await prisma.device.findUnique({ where: { id } });
  if (!d || d.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }
  await prisma.device.update({ where: { id }, data: { deletedAt: new Date() } });
  res.redirect("/devices");
}

/** GET /devices/:id/delete — сторінка підтвердження видалення (server-side, замість браузерного confirm). */
export async function confirmRemove(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const d = await prisma.device.findUnique({ where: { id } });
  if (!d || d.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }
  res.render("confirm-delete", {
    nav: "none",
    confirmTitle: "Видалити пристрій?",
    confirmSummary: d.serialNumber ? `${d.brand} ${d.model} · ${d.serialNumber}` : `${d.brand} ${d.model}`,
    confirmAction: `/devices/${d.id}/delete`,
    confirmBack: `/devices/${d.id}`,
  });
}
