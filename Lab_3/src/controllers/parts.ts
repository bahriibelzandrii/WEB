import type { Request, Response } from "express";
import prisma from "../prisma.js";
import { uah } from "../lib/format.js";
import { clean, toNumber, tooLong, maxDecimals, isUniqueViolation } from "../lib/validate.js";

/** GET /parts — каталог запчастин */
export async function index(_req: Request, res: Response) {
  const items = await prisma.part.findMany({ orderBy: { name: "asc" } });
  res.render("parts/index", { nav: "parts", items, uah });
}

/** GET /parts/new — форма створення запчастини */
export async function createForm(_req: Request, res: Response) {
  res.render("parts/create", {
    nav: "parts",
    errors: [],
    values: {},
    uah,
  });
}

/** POST /parts — створення запчастини */
export async function create(req: Request, res: Response) {
  const name = clean(req.body.name);
  const sku = clean(req.body.sku);
  const priceRaw = clean(req.body.price);

  const errors: string[] = [];

  if (!name) {
    errors.push("Вкажіть назву запчастини");
  } else if (name.length < 2) {
    errors.push("Назва запчастини: мінімум 2 символи");
  } else if (tooLong(name, 100)) {
    errors.push("Назва: до 100 символів");
  }

  if (sku) {
    if (sku.length < 2 || tooLong(sku, 50) || !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(sku)) {
      errors.push("SKU: 2–50 символів, латинські літери/цифри/«-», перший — літера або цифра");
    } else {
      const existing = await prisma.part.findFirst({
        where: { sku },
      });
      if (existing) {
        errors.push("SKU вже використовується");
      }
    }
  }

  const priceNum = toNumber(priceRaw);
  if (priceNum === null) {
    errors.push("Вкажіть ціну (число)");
  } else if (priceNum <= 0) {
    errors.push("Ціна має бути більшою за 0");
  } else if (!maxDecimals(priceRaw, 2)) {
    errors.push("Ціна: не більше 2 знаків після коми");
  } else if (priceNum > 99999999.99) {
    errors.push("Ціна: занадто велика");
  }

  const values = { name, sku, price: priceRaw };

  if (errors.length > 0) {
    res.status(400).render("parts/create", {
      nav: "parts",
      errors,
      values,
      uah,
    });
    return;
  }

  try {
    await prisma.part.create({
      data: {
        name,
        sku: sku || null,
        price: priceNum as number,
      },
    });
    res.redirect("/parts");
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(400).render("parts/create", {
        nav: "parts",
        errors: ["SKU вже використовується"],
        values,
        uah,
      });
      return;
    }
    throw err;
  }
}

/** GET /parts/:id/edit — форма редагування запчастини */
export async function editForm(req: Request, res: Response) {
  const id = String(req.params.id ?? "");

  const p = await prisma.part.findUnique({
    where: { id },
  });

  if (!p) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  res.render("parts/edit", {
    nav: "parts",
    p,
    values: null,
    errors: [],
    uah,
  });
}

/** POST /parts/:id/edit — збереження змін запчастини */
export async function edit(req: Request, res: Response) {
  const id = String(req.params.id ?? "");

  const p = await prisma.part.findUnique({
    where: { id },
  });

  if (!p) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }

  const name = clean(req.body.name);
  const sku = clean(req.body.sku);
  const priceRaw = clean(req.body.price);

  const errors: string[] = [];

  if (!name) {
    errors.push("Вкажіть назву запчастини");
  } else if (name.length < 2) {
    errors.push("Назва запчастини: мінімум 2 символи");
  } else if (tooLong(name, 100)) {
    errors.push("Назва: до 100 символів");
  }

  if (sku) {
    if (sku.length < 2 || tooLong(sku, 50) || !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(sku)) {
      errors.push("SKU: 2–50 символів, латинські літери/цифри/«-», перший — літера або цифра");
    } else {
      const existing = await prisma.part.findFirst({
        where: {
          sku,
          id: { not: id },
        },
      });
      if (existing) {
        errors.push("SKU вже використовується");
      }
    }
  }

  const priceNum = toNumber(priceRaw);
  if (priceNum === null) {
    errors.push("Вкажіть ціну (число)");
  } else if (priceNum <= 0) {
    errors.push("Ціна має бути більшою за 0");
  } else if (!maxDecimals(priceRaw, 2)) {
    errors.push("Ціна: не більше 2 знаків після коми");
  } else if (priceNum > 99999999.99) {
    errors.push("Ціна: занадто велика");
  }

  const values = { name, sku, price: priceRaw };

  if (errors.length > 0) {
    res.status(400).render("parts/edit", {
      nav: "parts",
      p,
      errors,
      values,
      uah,
    });
    return;
  }

  try {
    await prisma.part.update({
      where: { id },
      data: {
        name,
        sku: sku || null,
        price: priceNum as number,
      },
    });
    res.redirect("/parts");
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(400).render("parts/edit", {
        nav: "parts",
        p,
        errors: ["SKU вже використовується"],
        values,
        uah,
      });
      return;
    }
    throw err;
  }
}

/** POST /parts/:id/delete — видалення; якщо запчастину використовує заявка — 400 + список із помилкою. */
export async function remove(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const p = await prisma.part.findUnique({ where: { id } });
  if (!p) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }
  const used = await prisma.requestPart.count({ where: { partId: id } });
  if (used > 0) {
    const items = await prisma.part.findMany({ orderBy: { name: "asc" } });
    res.status(400).render("parts/index", {
      nav: "parts",
      items,
      errors: ["Запчастину не можна видалити, бо вона використовується в заявках"],
      uah,
    });
    return;
  }
  await prisma.part.delete({ where: { id } });
  res.redirect("/parts");
}

/** GET /parts/:id/delete — сторінка підтвердження видалення (server-side, замість браузерного confirm). */
export async function confirmRemove(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  const p = await prisma.part.findUnique({ where: { id } });
  if (!p) {
    res.status(404).render("errors/404", { nav: "none" });
    return;
  }
  res.render("confirm-delete", {
    nav: "none",
    confirmTitle: "Видалити запчастину?",
    confirmSummary: p.sku ? `${p.name} · ${p.sku}` : p.name,
    confirmAction: `/parts/${p.id}/delete`,
    confirmBack: "/parts",
  });
}
