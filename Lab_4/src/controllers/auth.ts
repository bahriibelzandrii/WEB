import type { NextFunction, Request, Response } from "express";
import passport from "passport";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { clean, isEmail, isPhone, isUaPhone, isUniqueViolation, tooLong } from "../lib/validate.js";
import { homeFor } from "../lib/auth.js";

/**
 * Авторизація (Lab 4): /login, /logout, /register.
 *
 * /login   — email + пароль (Passport.js local, bcryptjs)
 * /logout  — знищення сесії
 * /register — публічна реєстрація: нові акаунти одразу отримують роль VISITOR
 */

/** Безпечний next-редірект: лише відносні шляхи всередині сайту. */
function safeNext(v: unknown): string {
  const s = clean(v);
  if (!s.startsWith("/") || s.startsWith("//")) return "/";
  return s.replace(/\/\/+/, "/");
}


/** GET /login — форма входу. */
export async function loginForm(req: Request, res: Response) {
  if (req.user) return res.redirect(homeFor(req.user));
  const next = safeNext(clean(req.query.next));
  return res.render("auth/login", {
    nav: "none",
    next,
    loggedout: req.query.loggedout === "1",
  });
}

export function loginPost(req: Request, res: Response, next: NextFunction) {
  passport.authenticate(
    "local",
    (err: unknown, user: Express.User | false, info: { message?: string } | string | null | undefined) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).render("auth/login", {
        nav: "none",
        next: safeNext(req.body.next),
        error: (typeof info === "string" ? info : info?.message) ?? "Невірний email або пароль",
        values: { email: clean(req.body.email) },
      });
    }
    req.login(user, (e) => {
      if (e) return next(e);
      const nextRaw = clean(req.body.next);
      return res.redirect(nextRaw ? safeNext(nextRaw) : homeFor(user));
    });
  })(req, res, next);
}

/** GET /logout — вихід із системи. */
export function logout(req: Request, res: Response, next: NextFunction) {
  const done = (e?: Error) => {
    if (e) return next(e);
    return res.redirect("/login?loggedout=1");
  };
  if (req.user) {
    req.logout(done);
  } else {
    done();
  }
}

/** GET /register — форма реєстрації (роль відвідувача). */
export async function registerForm(req: Request, res: Response) {
  if (req.user) return res.redirect(homeFor(req.user));
  return res.render("auth/register", { nav: "none" });
}

/**
 * POST /register — створення акаунта VISITOR + автоматичний вхід.
 * Валідація — серверна (паттерн Lab 3): errors[] + values, статус 400.
 */
export async function registerPost(req: Request, res: Response, next: NextFunction) {
  const values = {
    name: clean(req.body.name),
    email: clean(req.body.email).toLowerCase(),
    phone: clean(req.body.phone),
    password: String(req.body.password ?? ""),
    password2: String(req.body.password2 ?? ""),
  };
  const errors: string[] = [];

  if (values.name.length < 2) errors.push("Ім'я: вкажіть щонайменше 2 символи");
  if (tooLong(values.name, 100)) errors.push("Ім'я: завелике (макс. 100 символів)");
  if (!isEmail(values.email)) errors.push("Email: некоректний формат");
  if (values.phone !== "" && !(isUaPhone(values.phone) || isPhone(values.phone)))
    errors.push("Телефон: некоректний формат");
  if (values.password.length < 8) errors.push("Пароль: щонайменше 8 символів");
  if (values.password !== values.password2) errors.push("Паролі не збігаються");

  if (errors.length === 0) {
    const taken = await prisma.user.findUnique({ where: { email: values.email } });
    if (taken) errors.push("Email уже використовується");
  }

  if (errors.length > 0) {
    return res.status(400).render("auth/register", { nav: "none", errors, values });
  }

  const user = await prisma.user
    .create({
      data: {
        name: values.name,
        email: values.email,
        phone: values.phone === "" ? null : values.phone,
        password: await bcrypt.hash(values.password, 10),
        role: "VISITOR",
      },
    })
    .catch((err) => {
      if (isUniqueViolation(err)) return null;
      throw err;
    });
  if (!user) {
    return res.status(400).render("auth/register", {
      nav: "none",
      errors: ["Email уже використовується"],
      values,
    });
  }

  req.login(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    (e) => {
      if (e) return next(e);
      return res.redirect(homeFor({ id: user.id, name: user.name, email: user.email, role: user.role } as Express.User));
    },
  );
}
