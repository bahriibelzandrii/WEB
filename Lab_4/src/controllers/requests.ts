import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Request, Response } from "express";
import Busboy from "busboy";
import prisma from "../prisma.js";
import {
  STATUS_LABELS,
  TYPE_LABELS,
  PRIORITY_LABELS,
  DEVICE_TYPE_LABELS,
  WORK_STATUS_LABELS,
  ESTIMATE_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  ROLE_LABELS,
} from "../lib/labels.js";
import { dateOnly, dateTime, uah, bytes } from "../lib/format.js";
import {
  REQUEST_STATUSES,
  REQUEST_TYPES,
  PRIORITIES,
  DEVICE_TYPES,
  nextStatuses,
  canTransition,
} from "../lib/transitions.js";
import type { DeviceType } from "../lib/transitions.js";
import { parseDateOnly, isEmail, isUaPhone, tooLong, MIN_DATE, toNumber, maxDecimals, isUniqueViolation } from "../lib/validate.js";

const PAGE_SIZE = 20;

/** Каталог файлів заявок (D42): uploads/<requestId>/<ts>-<name>, serve /uploads. */
const UPLOAD_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "uploads");
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Сьогодні, UTC-опівніч (date-only, D34) — дефолт для дат форм; рахується на кожен виклик. */
function today(): Date {
  return parseDateOnly(new Date().toISOString().slice(0, 10))!;
}

function parsePage(raw: unknown): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function pageNumbers(page: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(page - 3, total - 6));
  return Array.from({ length: 7 }, (_, i) => start + i);
}

/** Номер заявки: R-YYYY-NNNN, max+1 за поточний рік (формат seed). */
type TxClient = {
  request: typeof prisma.request;
  client: typeof prisma.client;
  device: typeof prisma.device;
};

async function nextNumberIn(tx: TxClient) {
  const year = new Date().getFullYear();
  const prefix = `R-${year}-`;
  const rows = await tx.request.findMany({
    where: { number: { startsWith: prefix } },
    select: { number: true },
  });
  let max = 0;
  for (const row of rows) {
    const n = Number(row.number.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

async function referenceData() {
  const [clients, devices, users, completed] = await Promise.all([
    prisma.client.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.device.findMany({
      where: { deletedAt: null },
      include: { owner: { select: { name: true, id: true } } },
      orderBy: { brand: "asc" },
    }),
    prisma.user.findMany({ where: { role: "TECHNICIAN" }, orderBy: { name: "asc" } }),
    prisma.request.findMany({
      where: { status: "COMPLETED", deletedAt: null },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { clients, devices, users, completed };
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
  workStatusLabels: WORK_STATUS_LABELS,
  estimateStatusLabels: ESTIMATE_STATUS_LABELS,
  invoiceStatusLabels: INVOICE_STATUS_LABELS,
  paymentMethodLabels: PAYMENT_METHOD_LABELS,
  roleLabels: ROLE_LABELS,
  paymentMethods: Object.keys(PAYMENT_METHOD_LABELS),
  dateOnly,
  dateTime,
  uah,
  bytes,
  get today(): string {
    return today().toISOString().slice(0, 10);
  },
};

/** GET /requests — список: фільтри + пошук + пагінація (PAGES.md §4.2). */
export async function index(req: Request, res: Response) {
  const status = (req.query.status as string | undefined) ?? "";
  const type = (req.query.type as string | undefined) ?? "";
  const priority = (req.query.priority as string | undefined) ?? "";
  const q = ((req.query.q as string | undefined) ?? "").trim();
  const page = parsePage(req.query.page);

  const where: Record<string, unknown> = { deletedAt: null };
  // Lab 4: майстер бачить у списку лише призначені собі заявки (адмін/відвідувач — всі).
  if (req.user?.role === "TECHNICIAN") where.assignedToId = req.user.id;
  if (status && (REQUEST_STATUSES as readonly string[]).includes(status)) where.status = status;
  if (type && (REQUEST_TYPES as readonly string[]).includes(type)) where.type = type;
  if (priority && (PRIORITIES as readonly string[]).includes(priority)) where.priority = priority;
  if (q) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" as const } },
      { description: { contains: q, mode: "insensitive" as const } },
      { client: { name: { contains: q, mode: "insensitive" as const } } },
    ];
  }

  const total = await prisma.request.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const items = await prisma.request.findMany({
    where,
    include: { client: true, device: true },
    orderBy: { createdAt: "desc" },
    skip: (cur - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  if (priority) params.set("priority", priority);
  if (q) params.set("q", q);
  const qs = params.toString();
  const base = `/requests${qs ? `?${qs}&` : "?"}`;

  res.render("requests/index", {
    nav: "requests",
    items,
    total,
    page: cur,
    totalPages,
    pageNumbers: pageNumbers(cur, totalPages),
    base,
    shownFrom: total === 0 ? 0 : (cur - 1) * PAGE_SIZE + 1,
    shownTo: Math.min(total, cur * PAGE_SIZE),
    status,
    type,
    priority,
    q,
    ...commonLocals,
  });
}

/** GET /requests/my-orders — замовлення клієнта (Client.userId = акаунт). */
export async function myOrders(req: Request, res: Response) {
  const page = parsePage(req.query.page);
  const where: Record<string, unknown> = { deletedAt: null, client: { userId: req.user!.id } };

  const total = await prisma.request.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const items = await prisma.request.findMany({
    where,
    include: { client: true, device: true },
    orderBy: { createdAt: "desc" },
    skip: (cur - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  res.render("requests/mine", {
    nav: "my-orders",
    items,
    total,
    page: cur,
    totalPages,
    pageNumbers: pageNumbers(cur, totalPages),
    base: "/requests/my-orders?",
    shownFrom: total === 0 ? 0 : (cur - 1) * PAGE_SIZE + 1,
    shownTo: Math.min(total, cur * PAGE_SIZE),
    ...commonLocals,
  });
}

/** GET /requests/new — форма створення (PAGES.md §4.4). */
export async function createForm(_req: Request, res: Response) {
  const ref = await referenceData();
  res.render("requests/create", {
    nav: "requests",
    errors: [] as string[],
    values: {},
    ...ref,
    ...commonLocals,
  });
}

/** POST /requests — створення: валідація + транзакція (PAGES.md §4.4). */
export async function create(req: Request, res: Response) {
  const b = req.body ?? {};
  const type = String(b.type ?? "");
  const priority = String(b.priority ?? "NORMAL");
  const description = String(b.description ?? "").trim();
  const clientMode = String(b.clientMode ?? "existing");
  const existingClientId = String(b.clientId ?? "");
  const newClientName = String(b.newClientName ?? "").trim();
  const newClientPhone = String(b.newClientPhone ?? "").trim();
  const newClientEmail = String(b.newClientEmail ?? "").trim();
  const newClientAddress = String(b.newClientAddress ?? "").trim();
  const deviceMode = String(b.deviceMode ?? "existing");
  const existingDeviceId = String(b.deviceId ?? "");
  const newDeviceType = String(b.newDeviceType ?? "");
  const newDeviceBrand = String(b.newDeviceBrand ?? "").trim();
  const newDeviceModel = String(b.newDeviceModel ?? "").trim();
  const newDeviceSerial = String(b.newDeviceSerial ?? "").trim();
  const newDeviceSpecs = String(b.newDeviceSpecs ?? "").trim();
  const newDevicePurchasedAt = String(b.newDevicePurchasedAt ?? "").trim();
  const technicianId = String(b.technicianId ?? "");
  const originalRequestId = String(b.originalRequestId ?? "");

  const errors: string[] = [];

  if (!(REQUEST_TYPES as readonly string[]).includes(type)) errors.push("Оберіть тип заявки");
  if (!(PRIORITIES as readonly string[]).includes(priority)) errors.push("Оберіть пріоритет");
  if (!description) {
    errors.push("Вкажіть опис проблеми / що обслуговати");
  } else if (description.length < 5) {
    errors.push("Опис: мінімум 5 символів");
  } else if (tooLong(description, 500)) {
    errors.push("Опис: до 500 символів");
  }

  let clientId: string | null = null;
  if (clientMode === "existing") {
    const c = existingClientId
      ? await prisma.client.findFirst({ where: { id: existingClientId, deletedAt: null } })
      : null;
    if (!c) errors.push("Оберіть існуючого клієнта");
    else clientId = c.id;
  } else {
    if (!newClientName) {
      errors.push("Новий клієнт: вкажіть ім'я / назву");
    } else if (newClientName.length < 2) {
      errors.push("Ім'я / назва: мінімум 2 символи");
    } else if (tooLong(newClientName, 100)) {
      errors.push("Ім'я / назва: до 100 символів");
    }

    if (!newClientPhone) {
      errors.push("Новий клієнт: вкажіть телефон");
    } else if (!isUaPhone(newClientPhone)) {
      errors.push("Новий клієнт: +380 + 9 цифр або 0 + 9 цифр");
    }

    if (newClientEmail) {
      if (tooLong(newClientEmail, 320)) {
        errors.push("Email: до 320 символів");
      } else if (!isEmail(newClientEmail)) {
        errors.push("Email: некоректний формат");
      } else {
        const dup = await prisma.client.findFirst({ where: { email: newClientEmail } });
        if (dup) errors.push("Email вже використовується іншим клієнтом");
      }
    }

    if (tooLong(newClientAddress, 200)) {
      errors.push("Адреса: до 200 символів");
    }
  }

  let deviceId: string | null = null;
  let existingDeviceOwnerId: string | null = null;
  if (deviceMode === "existing") {
    const d = existingDeviceId
      ? await prisma.device.findFirst({ where: { id: existingDeviceId, deletedAt: null } })
      : null;
    if (!d) errors.push("Оберіть існуючий пристрій");
    else {
      deviceId = d.id;
      existingDeviceOwnerId = d.ownerId;
    }
  } else {
    if (!(DEVICE_TYPES as readonly string[]).includes(newDeviceType)) {
      errors.push("Новий пристрій: оберіть тип");
    }

    if (!newDeviceBrand) {
      errors.push("Новий пристрій: вкажіть бренд");
    } else if (newDeviceBrand.length < 2) {
      errors.push("Бренд: мінімум 2 символи");
    } else if (tooLong(newDeviceBrand, 100)) {
      errors.push("Бренд: до 100 символів");
    }

    if (!newDeviceModel) {
      errors.push("Новий пристрій: вкажіть модель");
    } else if (newDeviceModel.length < 2) {
      errors.push("Модель: мінімум 2 символи");
    } else if (tooLong(newDeviceModel, 100)) {
      errors.push("Модель: до 100 символів");
    }

    if (tooLong(newDeviceSerial, 100)) {
      errors.push("Серійний номер: до 100 символів");
    }

    if (tooLong(newDeviceSpecs, 200)) {
      errors.push("Характеристики: до 200 символів");
    }

    if (newDevicePurchasedAt) {
      const parsedDate = parseDateOnly(newDevicePurchasedAt);
      if (!parsedDate) {
        errors.push("Новий пристрій: дата покупки: некоректний формат (YYYY-MM-DD)");
      } else {
        const tomorrowMidnight = new Date();
        tomorrowMidnight.setHours(0, 0, 0, 0);
        tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);
        if (parsedDate >= tomorrowMidnight) {
          errors.push("Новий пристрій: дата покупки: не може бути в майбутньому");
        } else if (parsedDate.getTime() < MIN_DATE) {
          errors.push("Новий пристрій: дата покупки: не може бути раніше 1990 року");
        }
      }
    }
  }

  if (clientMode === "new" && deviceMode === "existing") {
    errors.push("Новий клієнт: оберіть «Новий пристрій» (у нового клієнта ще немає пристроїв)");
  } else if (clientId && deviceId && existingDeviceOwnerId !== clientId) {
    errors.push("Пристрій не належить обраному клієнту");
  }

  let originalId: string | null = null;
  if (type === "WARRANTY_CLAIM") {
    if (!originalRequestId) {
      errors.push("Гарантійне звернення: оберіть оригінальний завершений ремонт");
    } else {
      const orig = await prisma.request.findFirst({
        where: { id: originalRequestId, status: "COMPLETED", deletedAt: null },
      });
      if (!orig) errors.push("Гарантійне звернення: оригінальний ремонт не знайдено або не завершений");
      else originalId = orig.id;
    }
  }

  let technicianIdFinal: string | null = null;
  if (technicianId) {
    const t = await prisma.user.findFirst({ where: { id: technicianId } });
    if (!t) errors.push("Майстер не знайдений");
    else technicianIdFinal = t.id;
  }

  if (!technicianIdFinal && req.user?.role === "TECHNICIAN") {
    technicianIdFinal = req.user.id; // заявка майстра одразу призначається йому
  }
  const values = {
    type,
    priority,
    description,
    clientMode,
    clientId: existingClientId,
    newClientName,
    newClientPhone,
    newClientEmail,
    newClientAddress,
    deviceMode,
    deviceId: existingDeviceId,
    newDeviceType,
    newDeviceBrand,
    newDeviceModel,
    newDeviceSerial,
    newDeviceSpecs,
    newDevicePurchasedAt,
    technicianId,
    originalRequestId,
  };

  if (errors.length > 0) {
    const ref = await referenceData();
    res.status(400).render("requests/create", { nav: "requests", errors, values, ...ref, ...commonLocals });
    return;
  }

  let created: { id: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      let cid = clientId as string;
      if (clientMode === "new") {
        const c = await tx.client.create({
          data: {
            name: newClientName,
            phone: newClientPhone,
            email: newClientEmail || null,
            address: newClientAddress || null,
          },
        });
        cid = c.id;
      }
      let did = deviceId as string;
      if (deviceMode === "new") {
        const d = await tx.device.create({
          data: {
            type: newDeviceType as DeviceType,
            brand: newDeviceBrand,
            model: newDeviceModel,
            serialNumber: newDeviceSerial || null,
            specs: newDeviceSpecs || null,
            purchasedAt: parseDateOnly(newDevicePurchasedAt),
            ownerId: cid,
          },
        });
        did = d.id;
      }
      const number = await nextNumberIn(tx);
      return tx.request.create({
        data: {
          number,
          type: type as (typeof REQUEST_TYPES)[number],
          status: "NEW",
          priority: priority as (typeof PRIORITIES)[number],
          description,
          clientId: cid,
          deviceId: did,
          originalRequestId: originalId,
          assignedToId: technicianIdFinal,
          createdById: req.user!.id,
        },
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      errors.push("Конфлікт даних: email або номер заявки вже зайнято — спробуйте ще раз");
      const ref = await referenceData();
      res.status(400).render("requests/create", { nav: "requests", errors, values, ...ref, ...commonLocals });
      return;
    }
    throw err;
  }

  res.redirect(`/requests/${created.id}`);
}

/** Дані картки: повний include + каталоги для форм «Додати роботу / запчастину». */
async function showData(id: string) {
  const r = await prisma.request.findUnique({
    where: { id },
    include: {
      client: true,
      device: true,
      createdBy: true,
      assignedTo: true,
      diagnostics: { include: { technician: true } },
      works: { include: { technician: true }, orderBy: { createdAt: "asc" } },
      parts: { include: { part: true }, orderBy: { createdAt: "asc" } },
      estimate: { include: { createdBy: true } },
      invoice: { include: { payments: { orderBy: { paidAt: "asc" } } } },
      warranty: true,
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      attachments: { include: { uploadedBy: true } },
      originalRequest: {
        select: { id: true, number: true, status: true, client: { select: { name: true } } },
      },
    },
  });
  if (!r || r.deletedAt) return null;
  const [catalogWorks, catalogParts, technicians] = await Promise.all([
    prisma.workCatalog.findMany({ orderBy: { name: "asc" } }),
    prisma.part.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "TECHNICIAN" }, orderBy: { name: "asc" } }),
  ]);
  return { r, catalogWorks, catalogParts, technicians };
}

/** GET /requests/:id — картка заявки: усі секції (PAGES.md §4.3). */
export async function show(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const error =
    req.query.error === "transition" ? "Недозволений перехід статусів" : undefined;

  const data = await showData(id);
  if (!data) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  // Lab 4: клієнт — тільки свої замовлення, скорочена картка (статус + фінанси).
  if (req.user?.role === "CLIENT") {
    if (data.r.client.userId !== req.user.id) {
      res.status(403).render("errors/403", { nav: "none", requiredRoles: "Клієнт (тільки свої замовлення)" });
      return;
    }
    res.render("requests/client", {
      nav: "my-orders",
      ...data,
      next: [],
      addWorkValues: null,
      addPartValues: null,
      ...commonLocals,
    });
    return;
  }

  res.render("requests/show", {
    nav: "requests",
    ...data,
    error,
    next: nextStatuses(data.r.status),
    addWorkValues: null,
    addPartValues: null,
    ...commonLocals,
  });
}

/** POST /requests/:id/transition — перехід статусу за машиною станів (PAGES.md §4.6). */
export async function transition(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const r = await prisma.request.findUnique({ where: { id } });
  if (!r || r.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  const to = String(req.body?.status ?? "");
  if (!canTransition(r.status, to)) {
    const data = await showData(id);
    if (!data) {
      res.status(404).render("errors/404", { nav: "none" });
      return;
    }
    res.status(400);
    renderShow(res, data, { errors: ["Недозволений перехід статусів"] });
    return;
  }

  await prisma.request.update({
    where: { id },
    data: { status: to as (typeof REQUEST_STATUSES)[number] },
  });
  res.redirect(`/requests/${id}`);
}

/** GET /requests/:id/edit — форма редагування (PAGES.md §4.5). */
export async function editForm(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const r = await prisma.request.findUnique({ where: { id } });
  if (!r || r.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  const [clients, devices, users, completed] = await Promise.all([
    prisma.client.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.device.findMany({
      where: { deletedAt: null },
      include: { owner: { select: { id: true, name: true } } },
      orderBy: { brand: "asc" },
    }),
    prisma.user.findMany({ where: { role: "TECHNICIAN" }, orderBy: { name: "asc" } }),
    prisma.request.findMany({
      where: { status: "COMPLETED", deletedAt: null, NOT: { id } },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  res.render("requests/edit", {
    nav: "requests",
    r,
    errors: [] as string[],
    values: null,
    clients,
    devices,
    users,
    completed,
    ...commonLocals,
  });
}

/** POST /requests/:id/edit — збереження (PAGES.md §4.5). */
export async function edit(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const r = await prisma.request.findUnique({ where: { id } });
  if (!r || r.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  const b = req.body ?? {};
  const type = String(b.type ?? "").trim() || r.type;
  const priority = String(b.priority ?? "NORMAL");
  const description = String(b.description ?? "").trim();
  const clientId = String(b.clientId ?? "");
  const deviceId = String(b.deviceId ?? "");
  const technicianId = String(b.technicianId ?? "");
  const originalRequestId = String(b.originalRequestId ?? "");

  const errors: string[] = [];

  if (!(REQUEST_TYPES as readonly string[]).includes(type)) errors.push("Оберіть тип заявки");

  if (!description) {
    errors.push("Вкажіть опис проблеми / що обслуговувати");
  } else if (description.length < 5) {
    errors.push("Опис: мінімум 5 символів");
  } else if (tooLong(description, 500)) {
    errors.push("Опис: до 500 символів");
  }

  if (!(PRIORITIES as readonly string[]).includes(priority)) errors.push("Оберіть пріоритет");

  const client = clientId
    ? await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } })
    : null;
  if (!client) errors.push("Оберіть клієнта");

  const device = deviceId
    ? await prisma.device.findFirst({ where: { id: deviceId, deletedAt: null } })
    : null;
  if (!device) errors.push("Оберіть пристрій");

  if (client && device && device.ownerId !== client.id) {
    errors.push("Пристрій не належить обраному клієнту");
  }

  let originalId: string | null = null;
  if (type === "WARRANTY_CLAIM") {
    if (!originalRequestId) {
      errors.push("Гарантійне звернення: оберіть оригінальний завершений ремонт");
    } else {
      const orig = await prisma.request.findFirst({
        where: { id: originalRequestId, status: "COMPLETED", deletedAt: null, NOT: { id } },
      });
      if (!orig) errors.push("Гарантійне звернення: оригінальний ремонт не знайдено або не завершений");
      else originalId = orig.id;
    }
  }

  let technicianIdFinal: string | null = null;
  if (technicianId) {
    const t = await prisma.user.findFirst({ where: { id: technicianId } });
    if (!t) errors.push("Майстер не знайдений");
    else technicianIdFinal = t.id;
  }

  const values = { type, priority, description, clientId, deviceId, technicianId, originalRequestId };

  if (errors.length > 0) {
    const [clients, devices, users, completed] = await Promise.all([
      prisma.client.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
      prisma.device.findMany({
        where: { deletedAt: null },
        include: { owner: { select: { id: true, name: true } } },
        orderBy: { brand: "asc" },
      }),
      prisma.user.findMany({ where: { role: "TECHNICIAN" }, orderBy: { name: "asc" } }),
      prisma.request.findMany({
        where: { status: "COMPLETED", deletedAt: null, NOT: { id } },
        include: { client: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    res.status(400).render("requests/edit", {
      nav: "requests",
      r,
      errors,
      values,
      clients,
      devices,
      users,
      completed,
      ...commonLocals,
    });
    return;
  }

  await prisma.request.update({
    where: { id },
    data: {
      type: type as (typeof REQUEST_TYPES)[number],
      description,
      priority: priority as (typeof PRIORITIES)[number],
      clientId: client!.id,
      deviceId: device!.id,
      originalRequestId: originalId,
      assignedToId: technicianIdFinal,
    },
  });
  res.redirect(`/requests/${id}`);
}

/** Сума/ціна: порожнє → fallback з каталогу; інакше число > 0, ≤2 знаків після коми, ≤ 99 999 999.99. */
function moneyValue(raw: unknown, fallback: number, label: string): { value: number; error: string | null } {
  const s = String(raw ?? "").trim();
  if (s === "") return { value: fallback, error: null };
  const n = toNumber(s);
  if (n === null) return { value: fallback, error: `${label}: вкажіть число` };
  if (n <= 0) return { value: fallback, error: `${label} має бути більшою за 0` };
  if (!maxDecimals(s, 2)) return { value: fallback, error: `${label}: не більше 2 знаків після коми` };
  if (n > 99999999.99) return { value: fallback, error: `${label}: занадто велика` };
  return { value: n, error: null };
}

function hoursValue(raw: unknown, fallback: number): { value: number; error: string | null } {
  const s = String(raw ?? "").trim();
  if (s === "") return { value: fallback, error: null };
  const n = toNumber(s);
  if (n === null) return { value: fallback, error: "Години: вкажіть число" };
  if (n <= 0) return { value: fallback, error: "Години мають бути більші за 0" };
  if (!maxDecimals(s, 2)) return { value: fallback, error: "Години: не більше 2 знаків після коми" };
  if (n > 999.99) return { value: fallback, error: "Години: занадто велика" };
  return { value: n, error: null };
}

/** Дані картки для renderShow: статус заявки + каталоги (повний об'єкт дає showData). */
type ShowData = {
  r: { status: string };
  catalogWorks: unknown;
  catalogParts: unknown;
  technicians: unknown;
};

function renderShow(res: Response, data: ShowData, extra: Record<string, unknown>) {
  res.render("requests/show", {
    nav: "requests",
    ...data,
    next: nextStatuses(data.r.status),
    addWorkValues: null,
    addPartValues: null,
    diagValues: null,
    ...extra,
    ...commonLocals,
  });
}

/** GET /requests/:id/delete — сторінка підтвердження видалення (server-side). */
export async function confirmRemove(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const r = await prisma.request.findUnique({ where: { id }, include: { client: true } });
  if (!r || r.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }
  res.render("confirm-delete", {
    nav: "requests",
    confirmTitle: "Видалити заявку?",
    confirmSummary: `${r.number} — ${r.client.name}`,
    confirmAction: `/requests/${id}/delete`,
    confirmBack: `/requests/${id}`,
  });
}

/** POST /requests/:id/delete — м'яке видалення (soft delete, deletedAt). */
export async function remove(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const r = await prisma.request.findUnique({ where: { id } });
  if (!r || r.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }
  await prisma.request.update({ where: { id }, data: { deletedAt: new Date() } });
  res.redirect("/requests");
}

/** POST /requests/:id/works — додати роботу з каталогу (снимок назви, своя сума/години). */
export async function addWork(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const data = await showData(id);
  if (!data) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  const b = req.body ?? {};
  const addWorkValues = {
    workId: String(b.workId ?? ""),
    cost: String(b.cost ?? "").trim(),
    hours: String(b.hours ?? "").trim(),
  };

  const work = addWorkValues.workId
    ? await prisma.workCatalog.findFirst({ where: { id: addWorkValues.workId } })
    : null;

  const errors: string[] = [];
  if (!work) errors.push("Оберіть роботу з каталогу");
  const cost = moneyValue(addWorkValues.cost, Number(work?.basePrice ?? 0), "Сума");
  const hours = hoursValue(addWorkValues.hours, work?.baseHours ?? 1);
  if (cost.error) errors.push(cost.error);
  if (hours.error) errors.push(hours.error);

  if (errors.length > 0) {
    res.status(400);
    renderShow(res, data, { errors, addWorkValues });
    return;
  }

  await prisma.requestWork.create({
    data: {
      requestId: id,
      catalogId: work!.id,
      name: work!.name,
      cost: cost.value,
      hours: hours.value,
      status: "PENDING",
    },
  });
  res.redirect(`/requests/${id}`);
}

/** POST /requests/:id/works/:lineId/delete — прибрати рядок роботи з заявки. */
export async function removeWork(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const lineId = String(req.params.lineId ?? "");
  const data = await showData(id);
  if (!data) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }
  const line = await prisma.requestWork.findFirst({ where: { id: lineId, requestId: id } });
  if (line) await prisma.requestWork.delete({ where: { id: line.id } });
  res.redirect(`/requests/${id}`);
}

/** POST /requests/:id/parts — додати запчастину з каталогу (к-сть + ціна за одиницю). */
export async function addPart(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const data = await showData(id);
  if (!data) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  const b = req.body ?? {};
  const addPartValues = {
    partId: String(b.partId ?? ""),
    quantity: String(b.quantity ?? "").trim(),
    unitPrice: String(b.unitPrice ?? "").trim(),
  };

  const part = addPartValues.partId
    ? await prisma.part.findFirst({ where: { id: addPartValues.partId } })
    : null;

  const errors: string[] = [];
  if (!part) errors.push("Оберіть запчастину з каталогу");

  let quantity = 1;
  if (addPartValues.quantity !== "") {
    const q = toNumber(addPartValues.quantity);
    if (q === null || !Number.isInteger(q) || q < 1 || q > 100) {
      errors.push("К-сть: ціле число від 1 до 100");
    } else {
      quantity = q;
    }
  }

  const price = moneyValue(addPartValues.unitPrice, Number(part?.price ?? 0), "Ціна");
  if (price.error) errors.push(price.error);

  if (errors.length > 0) {
    res.status(400);
    renderShow(res, data, { errors, addPartValues });
    return;
  }

  try {
    await prisma.requestPart.create({
      data: { requestId: id, partId: part!.id, quantity, unitPrice: price.value },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(400);
      renderShow(res, data, { errors: ["Ця запчастина вже додана в заявку"], addPartValues });
      return;
    }
    throw err;
  }
  res.redirect(`/requests/${id}`);
}

/** POST /requests/:id/parts/:lineId/delete — прибрати рядок запчастини з заявки. */
export async function removePart(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const lineId = String(req.params.lineId ?? "");
  const data = await showData(id);
  if (!data) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }
  const line = await prisma.requestPart.findFirst({ where: { id: lineId, requestId: id } });
  if (line) await prisma.requestPart.delete({ where: { id: line.id } });
  res.redirect(`/requests/${id}`);
}

// ───────────────────────────────────────────────────────────────────────────
// Рубрики картки: діагностика, оцінка, рахунок, гарантія, коментарі,
// вкладення (PAGES.md §4.3, D42). Паттерн: showData → 404; errors[] →
// renderShow(400); успіх → redirect на картку.
// ───────────────────────────────────────────────────────────────────────────

/** Сума ≥ 0 (порожнє → 0), ≤2 знаків після коми. */
function costValue(raw: unknown): { value: number; error: string | null } {
  const s = String(raw ?? "").trim();
  if (s === "") return { value: 0, error: null };
  const n = toNumber(s);
  if (n === null) return { value: 0, error: "Вартість: вкажіть число" };
  if (n < 0) return { value: 0, error: "Вартість: не може бути меншою за 0" };
  if (!maxDecimals(s, 2)) return { value: 0, error: "Вартість: не більше 2 знаків після коми" };
  if (n > 99999999.99) return { value: 0, error: "Вартість: занадто велика" };
  return { value: n, error: null };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const PAYMENT_METHODS = ["CASH", "CARD", "BANK_TRANSFER"] as const;

/** POST /requests/:id/diagnostics — додати/оновити діагностику (1—1 із заявкою). */
export async function saveDiagnostics(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const data = await showData(id);
  if (!data) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  const b = req.body ?? {};
  const errors: string[] = [];
  const findings = String(b.findings ?? "").trim();
  if (findings.length < 2) errors.push("Висновки: мінімум 2 символи");
  const cost = costValue(b.cost);
  if (cost.error) errors.push(cost.error);
  const notes = String(b.notes ?? "").trim() || null;

  const dateRaw = String(b.date ?? "").trim();
  let date: Date | null = null;
  if (dateRaw !== "") {
    date = parseDateOnly(dateRaw);
    if (!date) errors.push("Дата: некоректне значення");
  }

  const techRaw = String(b.technicianId ?? "").trim();
  let technicianId: string | null = null;
  if (techRaw !== "") {
    const tech = await prisma.user.findFirst({ where: { id: techRaw, role: "TECHNICIAN" } });
    if (!tech) errors.push("Майстер: невідоме значення");
    else technicianId = tech.id;
  }

  if (errors.length > 0) {
    res.status(400);
    renderShow(res, data, {
      errors,
      diagValues: { technicianId: techRaw, date: dateRaw, findings, cost: String(b.cost ?? "").trim(), notes: notes ?? "" },
    });
    return;
  }

  await prisma.diagnostics.upsert({
    where: { requestId: id },
    update: { technicianId, date: date ?? today(), findings, cost: cost.value, notes },
    create: { requestId: id, technicianId, date: date ?? today(), findings, cost: cost.value, notes },
  });
  res.redirect(`/requests/${id}`);
}

/** POST /requests/:id/estimate — створити/оновити оцінку з сум робіт і запчастин. */
export async function saveEstimate(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const data = await showData(id);
  if (!data) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }
  const r = data.r;
  if (r.estimate && r.estimate.status === "APPROVED") {
    res.status(400);
    renderShow(res, data, { errors: ["Оцінку вже затверджено — змініть роботи/запчастини та оновіть оцінку"] });
    return;
  }
  if (r.works.length === 0 && r.parts.length === 0) {
    res.status(400);
    renderShow(res, data, { errors: ["Додайте роботи або запчастини, щоб оформити оцінку"] });
    return;
  }

  const totalWorks = round2(r.works.reduce((s, w) => s + Number(w.cost), 0));
  const totalParts = round2(r.parts.reduce((s, p) => s + p.quantity * Number(p.unitPrice), 0));
  const total = round2(totalWorks + totalParts);
  await prisma.estimate.upsert({
    where: { requestId: id },
    update: { status: "DRAFT", totalWorks, totalParts, total, approvedAt: null },
    create: { requestId: id, status: "DRAFT", totalWorks, totalParts, total, createdById: req.user!.id },
  });
  res.redirect(`/requests/${id}`);
}

/** POST /requests/:id/estimate/approve — затвердити оцінку (DRAFT/REJECTED → APPROVED). */
export async function approveEstimate(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const data = await showData(id);
  if (!data) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }
  const est = data.r.estimate;
  if (!est) {
    res.status(400);
    renderShow(res, data, { errors: ["Оцінки ще немає — оформіть її спершу"] });
    return;
  }
  if (est.status === "APPROVED") {
    res.status(400);
    renderShow(res, data, { errors: ["Оцінку вже затверджено"] });
    return;
  }
  await prisma.estimate.update({
    where: { id: est.id },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  res.redirect(`/requests/${id}`);
}

/** POST /requests/:id/estimate/reject — відхилити оцінку (→ REJECTED). */
export async function rejectEstimate(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const data = await showData(id);
  if (!data) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }
  const est = data.r.estimate;
  if (!est) {
    res.status(400);
    renderShow(res, data, { errors: ["Оцінки ще немає — оформіть її спершу"] });
    return;
  }
  if (est.status === "REJECTED") {
    res.status(400);
    renderShow(res, data, { errors: ["Оцінку вже відхилено"] });
    return;
  }
  await prisma.estimate.update({
    where: { id: est.id },
    data: { status: "REJECTED", approvedAt: null },
  });
  res.redirect(`/requests/${id}`);
}

/** POST /requests/:id/invoice — видати рахунок з затвердженої оцінки. */
export async function createInvoice(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const data = await showData(id);
  if (!data) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  const b = req.body ?? {};
  const errors: string[] = [];
  const est = data.r.estimate;
  const estOk = !!est && est.status === "APPROVED";
  if (!estOk) errors.push("Для видачі рахунку спочатку оформіть і затвердіть оцінку");
  if (data.r.invoice) errors.push("Рахунок вже видано");

  let discount = 0;
  const d = costValue(b.discount);
  if (d.error) errors.push(d.error);
  else if (est && d.value > Number(est.total)) errors.push(`Знижка: не може перевищувати суму оцінки (${uah(Number(est.total))})`);
  else discount = d.value;

  let dueDate: Date | null = null;
  const dueRaw = String(b.dueDate ?? "").trim();
  if (dueRaw !== "") {
    dueDate = parseDateOnly(dueRaw);
    if (!dueDate) errors.push("Термін сплати: некоректне значення");
  }

  if (errors.length > 0) {
    res.status(400);
    renderShow(res, data, { errors });
    return;
  }

  const estTotal = Number(est!.total);
  const finalTotal = round2(estTotal - discount);
  await prisma.invoice.create({
    data: {
      requestId: id,
      estimateId: est!.id,
      total: estTotal,
      discount,
      finalTotal,
      // Повна знижка — рахунок на 0 грн одразу закритий, інакше його
      // неможливо було б «оплатити» (залишок 0).
      status: finalTotal <= 0 ? "PAID" : "UNPAID",
      issueDate: new Date(),
      dueDate,
    },
  });
  res.redirect(`/requests/${id}`);
}

/** POST /requests/:id/payments — записати платіж, перерахувати статус рахунку. */
export async function addPayment(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const data = await showData(id);
  if (!data) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  const b = req.body ?? {};
  const inv = data.r.invoice;
  const errors: string[] = [];
  if (!inv) errors.push("Рахунку немає — видайте його спершу");

  const amount = moneyValue(b.amount, 0, "Сума");
  if (amount.error) errors.push(amount.error);
  const method = String(b.method ?? "").trim();
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) errors.push("Спосіб оплати: оберіть значення");
  const note = String(b.note ?? "").trim() || null;

  let remaining = 0;
  if (inv) {
    const paid = round2(inv.payments.reduce((s, p) => s + Number(p.amount), 0));
    remaining = round2(Number(inv.finalTotal) - paid);
    if (remaining <= 0) errors.push("Рахунок вже оплачено повністю");
    else if (!amount.error && amount.value > remaining) errors.push(`Сума: більша за залишок (${uah(remaining)})`);
  }

  if (errors.length > 0) {
    res.status(400);
    renderShow(res, data, { errors });
    return;
  }

  await prisma.$transaction([
    prisma.payment.create({
      data: { invoiceId: inv!.id, amount: amount.value, method: method as (typeof PAYMENT_METHODS)[number], note },
    }),
    prisma.invoice.update({
      where: { id: inv!.id },
      data: { status: amount.value >= remaining ? "PAID" : "PARTIAL" },
    }),
  ]);
  res.redirect(`/requests/${id}`);
}

/** POST /requests/:id/warranty — оформити/оновити гарантію (1—1 із заявкою). */
export async function saveWarranty(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const data = await showData(id);
  if (!data) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  const b = req.body ?? {};
  const errors: string[] = [];
  const periodDays = Number(b.periodDays);
  if (![30, 60, 90, 180, 365].includes(periodDays)) errors.push("Термін гарантії: оберіть значення");
  const startRaw = String(b.startDate ?? "").trim();
  let startDate: Date | null = null;
  if (startRaw !== "") {
    startDate = parseDateOnly(startRaw);
    if (!startDate) errors.push("Дата початку: некоректне значення");
  }
  const scope = String(b.scope ?? "").trim() || null;

  if (errors.length > 0) {
    res.status(400);
    renderShow(res, data, { errors });
    return;
  }

  startDate = startDate ?? today();
  const endDate = new Date(startDate.getTime() + periodDays * 86400000);
  await prisma.warranty.upsert({
    where: { requestId: id },
    update: { periodDays, startDate, endDate, scope },
    create: { requestId: id, periodDays, startDate, endDate, scope },
  });
  res.redirect(`/requests/${id}`);
}

/** POST /requests/:id/comments — додати коментар. */
export async function addComment(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const data = await showData(id);
  if (!data) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  const b = req.body ?? {};
  const text = String(b.text ?? "").trim();
  const errors: string[] = [];
  if (text.length < 2) errors.push("Коментар: мінімум 2 символи");
  const isInternal = b.isInternal === true || b.isInternal === "on" || b.isInternal === "true" || b.isInternal === "1";

  if (errors.length > 0) {
    res.status(400);
    renderShow(res, data, { errors });
    return;
  }

  await prisma.comment.create({
    data: { requestId: id, authorId: req.user!.id, text, isInternal },
  });
  res.redirect(`/requests/${id}`);
}

/** Безпечне збереження origin-назви: basename, без шляхів, кирилиця — так. */
function sanitizeFileName(name: string): string {
  const base = path.basename(String(name)).replace(/[^\w.\- ()а-яА-ЯіїєґІЇЄҐ'’]/gu, "_");
  return base.replace(/\s+/g, "_").slice(0, 120).trim() || "file";
}

/** POST /requests/:id/attachments — файл (multipart, busboy; ліміт 10 МБ). */
export async function addAttachment(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const data = await showData(id);
  if (!data) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  try {
    const saved = await saveFirstFile(req, id);
    await prisma.fileAttachment.create({
      data: {
        requestId: id,
        fileName: saved.fileName,
        filePath: saved.relPath,
        mimeType: saved.mimeType || null,
        size: saved.size,
        uploadedById: req.user!.id,
      },
    });
    res.redirect(`/requests/${id}`);
  } catch (err) {
    const msg =
      err instanceof Error && err.message === "UPLOAD:LIMIT"
        ? "Файл: занадто великий (до 10 МБ)"
        : err instanceof Error && err.message === "UPLOAD:NONE"
          ? "Оберіть файл для завантаження"
          : "Не вдалося зберегти файл";
    res.status(400);
    renderShow(res, data, { errors: [msg] });
  }
}

type SavedFile = { fileName: string; relPath: string; mimeType: string; size: number };

/** Першу file-частинку multipart-тіла → uploads/<requestId>/<ts>-<name>. */
function saveFirstFile(req: Request, requestId: string): Promise<SavedFile> {
  const result = Promise.withResolvers<SavedFile>();
  const bb = Busboy({ headers: req.headers, limits: { fileSize: MAX_UPLOAD_BYTES } });
  let took = false;
  bb.on("file", (_name, stream, info) => {
    if (took) {
      stream.resume();
      return;
    }
    took = true;
    let dest: string;
    try {
      fs.mkdirSync(path.join(UPLOAD_ROOT, requestId), { recursive: true });
      dest = path.join(UPLOAD_ROOT, requestId, `${Date.now()}-${sanitizeFileName(info.filename)}`);
    } catch (e) {
      // Без слушатя error на потоці — unhandled 'error' вбиває процес (EACCES тощо).
      stream.destroy();
      result.reject(e);
      return;
    }
    const stored = path.basename(dest);
    const ws = fs.createWriteStream(dest);
    let size = 0;
    stream.on("data", (c: Buffer) => {
      size += c.length;
    });
    stream.on("limit", () => {
      ws.destroy();
      fs.rmSync(dest, { force: true });
      result.reject(new Error("UPLOAD:LIMIT"));
    });
    ws.on("finish", () =>
      result.resolve({ fileName: info.filename, relPath: `uploads/${requestId}/${stored}`, mimeType: info.mimeType, size }),
    );
    ws.on("error", (e) => {
      fs.rmSync(dest, { force: true });
      result.reject(e);
    });
    stream.on("error", (e) => {
      fs.rmSync(dest, { force: true });
      result.reject(e);
    });
    stream.pipe(ws);
  });
  bb.on("finish", () => {
    if (!took) result.reject(new Error("UPLOAD:NONE"));
  });
  bb.on("error", (e) => result.reject(e));
  req.pipe(bb);
  return result.promise;
}
