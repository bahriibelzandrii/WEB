import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import type { Role } from "../lib/auth.js";
import prisma from "../prisma.js";
import { ROLE_LABELS } from "../lib/labels.js";
import { clean, isEmail, isPhone, tooLong, isUniqueViolation } from "../lib/validate.js";
import { dateTime } from "../lib/format.js";

const ROLES = ["VISITOR", "TECHNICIAN", "MANAGER", "ADMIN"] as const;

const commonLocals = { roleLabels: ROLE_LABELS, roles: ROLES, dateTime };

function isFkViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("code" in err)) return false;
  return err.code === "P2003";
}

function validateUser(
  body: Record<string, unknown>,
  opts: { requirePassword: boolean },
): { errors: string[]; values: Record<string, string> } {
  const name = clean(body.name);
  const email = clean(body.email);
  const phone = clean(body.phone);
  const role = clean(body.role);
  const password = String(body.password ?? "");

  const errors: string[] = [];
  if (!name) errors.push("Вкажіть ім'я");
  else if (name.length < 2) errors.push("Ім'я: мінімум 2 символи");
  if (!email) errors.push("Вкажіть email (логін)");
  else if (!isEmail(email)) errors.push("Email: некоректний формат");
  if (phone && !isPhone(phone)) errors.push("Телефон: 10–15 цифр");
  if (!ROLES.includes(role as (typeof ROLES)[number])) errors.push("Оберіть роль");
  if (opts.requirePassword) {
    if (!password) errors.push("Вкажіть пароль");
    else if (password.length < 6) errors.push("Пароль: мінімум 6 символів");
  } else if (password && password.length < 6) {
    errors.push("Пароль: мінімум 6 символів (або залиште порожнім, щоб зберегти старий)");
  }

  return { errors, values: { name, email, phone, role } };
}

/** GET /users — список користувачів системи. */
export async function index(req: Request, res: Response) {
  const q = clean(req.query.q);
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "asc" },
  });
  res.render("users/index", {
    nav: "users",
    items: users,
    q,
    ...commonLocals,
  });
}

/** GET /users/new — форма створення користувача. */
export async function createForm(_req: Request, res: Response) {
  res.render("users/create", {
    nav: "users",
    errors: [] as string[],
    values: {},
    ...commonLocals,
  });
}

/** POST /users — створення користувача. */
export async function create(req: Request, res: Response) {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const password = String(b.password ?? "");
  const { errors, values } = validateUser(b, { requirePassword: true });

  if (errors.length > 0) {
    res.status(400).render("users/create", { nav: "users", errors, values, ...commonLocals });
    return;
  }

  try {
    await prisma.user.create({
      data: {
        name: values.name,
        email: values.email,
        phone: values.phone || null,
        role: values.role as Role,
        password: await bcrypt.hash(password, 10),
      },
    });
    res.redirect("/users");
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(400).render("users/create", {
        nav: "users",
        errors: ["Користувач з таким email вже існує"],
        values,
        ...commonLocals,
      });
      return;
    }
    throw err;
  }
}

/** GET /users/:id/edit — форма редагування користувача. */
export async function editForm(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!user) {
    res.status(404).render("errors/404", { title: "Користувача не знайдено" });
    return;
  }
  res.render("users/edit", {
    nav: "users",
    user,
    errors: [] as string[],
    values: { name: user.name, email: user.email, phone: user.phone ?? "", role: user.role },
    ...commonLocals,
  });
}

/** POST /users/:id/edit — збереження змін (пароль — лише якщо вказано новий). */
export async function edit(req: Request, res: Response) {
  const id = String(req.params.id);
  const b = (req.body ?? {}) as Record<string, unknown>;
  const password = String(b.password ?? "");
  const { errors, values } = validateUser(b, { requirePassword: false });

  const existing = await prisma.user.findUnique({ where: { id: id } });
  if (!existing) {
    res.status(404).render("errors/404", { title: "Користувача не знайдено" });
    return;
  }

  if (errors.length > 0) {
    res.status(400).render("users/edit", {
      nav: "users",
      user: existing,
      errors,
      values,
      ...commonLocals,
    });
    return;
  }

  const data: { name: string; email: string; phone: string | null; role: Role; password?: string } = {
    name: values.name,
    email: values.email,
    phone: values.phone || null,
    role: values.role as Role,
  };
  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  try {
    await prisma.user.update({ where: { id }, data });
    res.redirect("/users");
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(400).render("users/edit", {
        nav: "users",
        user: existing,
        errors: ["Користувач з таким email вже існує"],
        values,
        ...commonLocals,
      });
      return;
    }
    throw err;
  }
}

/** GET /users/:id/delete — сторінка підтвердження видалення. */
export async function confirmRemove(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!user) {
    res.status(404).render("errors/404", { title: "Користувача не знайдено" });
    return;
  }
  res.render("confirm-delete", {
    confirmTitle: "Видалити користувача?",
    confirmSummary: `${user.name} <${user.email}> — роль: ${ROLE_LABELS[user.role]}`,
    confirmAction: `/users/${user.id}/delete`,
    confirmBack: "/users",
  });
}

/**
 * POST /users/:id/delete — видалення.
 * Користувачі, прив'язані до даних (заявки, роботи, коментарі …), видалити
 * неможливо (onDelete: Restrict) — показуємо 400 з поясненням.
 */
export async function remove(req: Request, res: Response) {
  const id = String(req.params.id);
  if (req.user && req.user.id === id) {
    res.status(400).render("confirm-delete", {
      confirmTitle: "Ви не можете видалити власний акаунт",
      confirmSummary: "Оберіть іншого користувача або змініть його роль.",
      confirmAction: "/users",
      confirmBack: "/users",
    });
    return;
  }
  try {
    await prisma.user.delete({ where: { id } });
    res.redirect("/users");
  } catch (err) {
    if (isFkViolation(err)) {
      res.status(400).render("confirm-delete", {
        confirmTitle: "Видалити неможливо: користувач прив'язаний до даних системи",
        confirmSummary:
          "Цей користувач є автором заявок, робіт, діагностик або коментарів — історію аудиту зберігаємо (onDelete: Restrict). Замість видалення змініть йому роль (напр., VISITOR).",
        confirmAction: "/users",
        confirmBack: "/users",
      });
      return;
    }
    throw err;
  }
}
