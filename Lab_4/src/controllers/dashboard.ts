import type { Request, Response } from "express";
import prisma from "../prisma.js";
import { REQUEST_STATUSES } from "../lib/transitions.js";
import { STATUS_LABELS, TYPE_LABELS, PRIORITY_LABELS } from "../lib/labels.js";
import { dateOnly } from "../lib/format.js";

/** GET / — дашборд: картки за статусами + 10 останніх заявок (PAGES.md §4.1). */
export async function index(_req: Request, res: Response) {
  const [byStatus, total, latest] = await Promise.all([
    prisma.request.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.request.count({ where: { deletedAt: null } }),
    prisma.request.findMany({
      where: { deletedAt: null },
      include: { client: true, device: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const s of REQUEST_STATUSES) counts[s] = 0;
  for (const row of byStatus) counts[row.status] = row._count._all;

  res.render("dashboard/index", {
    nav: "home",
    total,
    counts,
    latest,
    statuses: REQUEST_STATUSES,
    statusLabels: STATUS_LABELS,
    typeLabels: TYPE_LABELS,
    priorityLabels: PRIORITY_LABELS,
    dateOnly,
  });
}
