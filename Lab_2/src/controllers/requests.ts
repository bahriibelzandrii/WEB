import type { Request, Response } from "express";
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
} from "../lib/transitions.js";

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
  workStatusLabels: WORK_STATUS_LABELS,
  estimateStatusLabels: ESTIMATE_STATUS_LABELS,
  invoiceStatusLabels: INVOICE_STATUS_LABELS,
  paymentMethodLabels: PAYMENT_METHOD_LABELS,
  roleLabels: ROLE_LABELS,
  dateOnly,
  dateTime,
  uah,
  bytes,
};

/** GET /requests — список: фільтри + пошук + пагінація (PAGES.md §4.2). */
export async function index(req: Request, res: Response) {
  const status = (req.query.status as string | undefined) ?? "";
  const type = (req.query.type as string | undefined) ?? "";
  const priority = (req.query.priority as string | undefined) ?? "";
  const q = ((req.query.q as string | undefined) ?? "").trim();
  const page = parsePage(req.query.page);

  const where: Record<string, unknown> = { deletedAt: null };
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

/** GET /requests/:id — картка заявки: усі секції (PAGES.md §4.3). */
export async function show(req: Request, res: Response) {
  const id = String(req.params.id ?? "");

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

  if (!r || r.deletedAt) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  res.render("requests/show", {
    nav: "requests",
    r,
    ...commonLocals,
  });
}
