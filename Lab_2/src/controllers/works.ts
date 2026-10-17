import type { Request, Response } from "express";
import prisma from "../prisma.js";
import { uah } from "../lib/format.js";

/** GET /works — каталог робіт (прайс-лист, read-only) (PAGES.md §4.11). */
export async function index(_req: Request, res: Response) {
  const items = await prisma.workCatalog.findMany({ orderBy: { name: "asc" } });
  res.render("works/index", { nav: "works", items, uah });
}
