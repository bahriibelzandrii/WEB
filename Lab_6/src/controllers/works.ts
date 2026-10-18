import type { Request, Response } from "express";
import prisma from "../prisma.js";
import { uah } from "../lib/format.js";
import { clean, toNumber, tooLong, maxDecimals, isUniqueViolation } from "../lib/validate.js";

const commonLocals = {
  uah,
};

/** GET /works — каталог робіт (прайс-лист) (PAGES.md §4.11). */
export async function index(_req: Request, res: Response) {
  const items = await prisma.workCatalog.findMany({ orderBy: { name: "asc" } });
  res.render("works/index", { nav: "works", items, ...commonLocals });
}

/** GET /works/new — форма створення позиції прайс-листа. */
export async function createForm(_req: Request, res: Response) {
  res.render("works/create", {
    nav: "works",
    errors: [] as string[],
    values: {},
    ...commonLocals,
  });
}

/** POST /works — створення нової роботи. */
export async function create(req: Request, res: Response) {
  const b = req.body ?? {};
  const name = clean(b.name);
  const description = clean(b.description);
  const basePriceRaw = clean(b.basePrice);
  const baseHoursRaw = clean(b.baseHours);

  const values = {
    name,
    description,
    basePrice: basePriceRaw,
    baseHours: baseHoursRaw,
  };

  const errors: string[] = [];

  if (!name) {
    errors.push("Вкажіть назву роботи");
  } else if (name.length < 2) {
    errors.push("Назва: мінімум 2 символи");
  } else if (tooLong(name, 100)) {
    errors.push("Назва: до 100 символів");
  }

  if (tooLong(description, 500)) {
    errors.push("Опис: до 500 символів");
  }

  const priceNum = toNumber(basePriceRaw);
  if (priceNum === null) {
    errors.push("Вкажіть базову ціну (число)");
  } else if (priceNum <= 0) {
    errors.push("Базова ціна має бути більшою за 0");
  } else if (!maxDecimals(basePriceRaw, 2)) {
    errors.push("Базова ціна: не більше 2 знаків після коми");
  } else if (priceNum > 99999999.99) {
    errors.push("Базова ціна: занадто велика");
  }

  const hoursNum = toNumber(baseHoursRaw);
  if (hoursNum === null) {
    errors.push("Вкажіть тривалість у годинах (число)");
  } else if (hoursNum <= 0) {
    errors.push("Тривалість має бути більшою за 0");
  } else if (!maxDecimals(baseHoursRaw, 2)) {
    errors.push("Тривалість: не більше 2 знаків після коми");
  } else if (hoursNum > 1000) {
    errors.push("Тривалість: занадто велика");
  }

  if (name) {
    const existing = await prisma.workCatalog.findFirst({
      where: { name },
    });
    if (existing) {
      errors.push("Робота з такою назвою вже існує");
    }
  }

  if (errors.length > 0) {
    res.status(400).render("works/create", {
      nav: "works",
      errors,
      values,
      ...commonLocals,
    });
    return;
  }

  try {
    await prisma.workCatalog.create({
      data: {
        name,
        description: description || null,
        basePrice: priceNum!,
        baseHours: hoursNum!,
      },
    });
    res.redirect("/works");
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(400).render("works/create", {
        nav: "works",
        errors: ["Робота з такою назвою вже існує"],
        values,
        ...commonLocals,
      });
      return;
    }
    throw err;
  }
}

/** GET /works/:id/edit — форма редагування роботи. */
export async function editForm(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const w = await prisma.workCatalog.findUnique({ where: { id } });
  if (!w) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  res.render("works/edit", {
    nav: "works",
    w,
    errors: [] as string[],
    values: null,
    ...commonLocals,
  });
}

/** POST /works/:id/edit — збереження змін роботи. */
export async function edit(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const w = await prisma.workCatalog.findUnique({ where: { id } });
  if (!w) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  const b = req.body ?? {};
  const name = clean(b.name);
  const description = clean(b.description);
  const basePriceRaw = clean(b.basePrice);
  const baseHoursRaw = clean(b.baseHours);

  const values = {
    name,
    description,
    basePrice: basePriceRaw,
    baseHours: baseHoursRaw,
  };

  const errors: string[] = [];

  if (!name) {
    errors.push("Вкажіть назву роботи");
  } else if (name.length < 2) {
    errors.push("Назва: мінімум 2 символи");
  } else if (tooLong(name, 100)) {
    errors.push("Назва: до 100 символів");
  }

  if (tooLong(description, 500)) {
    errors.push("Опис: до 500 символів");
  }

  const priceNum = toNumber(basePriceRaw);
  if (priceNum === null) {
    errors.push("Вкажіть базову ціну (число)");
  } else if (priceNum <= 0) {
    errors.push("Базова ціна має бути більшою за 0");
  } else if (!maxDecimals(basePriceRaw, 2)) {
    errors.push("Базова ціна: не більше 2 знаків після коми");
  } else if (priceNum > 99999999.99) {
    errors.push("Базова ціна: занадто велика");
  }

  const hoursNum = toNumber(baseHoursRaw);
  if (hoursNum === null) {
    errors.push("Вкажіть тривалість у годинах (число)");
  } else if (hoursNum <= 0) {
    errors.push("Тривалість має бути більшою за 0");
  } else if (!maxDecimals(baseHoursRaw, 2)) {
    errors.push("Тривалість: не більше 2 знаків після коми");
  } else if (hoursNum > 1000) {
    errors.push("Тривалість: занадто велика");
  }

  if (name) {
    const existing = await prisma.workCatalog.findFirst({
      where: {
        name,
        ...(id ? { id: { not: id } } : {}),
      },
    });
    if (existing) {
      errors.push("Робота з такою назвою вже існує");
    }
  }

  if (errors.length > 0) {
    res.status(400).render("works/edit", {
      nav: "works",
      w,
      errors,
      values,
      ...commonLocals,
    });
    return;
  }

  try {
    await prisma.workCatalog.update({
      where: { id },
      data: {
        name,
        description: description || null,
        basePrice: priceNum!,
        baseHours: hoursNum!,
      },
    });
    res.redirect("/works");
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(400).render("works/edit", {
        nav: "works",
        w,
        errors: ["Робота з такою назвою вже існує"],
        values,
        ...commonLocals,
      });
      return;
    }
    throw err;
  }
}

/** POST /works/:id/delete — видалення; посилання RequestWork.catalogId → null (snapshot у заявках зберігається). */
export async function remove(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const w = await prisma.workCatalog.findUnique({ where: { id } });
  if (!w) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.requestWork.updateMany({
      where: { catalogId: id },
      data: { catalogId: null },
    });
    await tx.workCatalog.delete({ where: { id } });
  });
  res.redirect("/works");
}

/** GET /works/:id/delete — сторінка підтвердження видалення (server-side, замість браузерного confirm). */
export async function confirmRemove(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const w = await prisma.workCatalog.findUnique({ where: { id } });
  if (!w) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }
  res.render("confirm-delete", {
    nav: "none",
    confirmTitle: "Видалити роботу?",
    confirmSummary: `${w.name} · базова ціна ${uah(w.basePrice)}`,
    confirmAction: `/works/${w.id}/delete`,
    confirmBack: "/works",
  });
}
