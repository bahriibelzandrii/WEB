/**
 * Авторизація та ролі (Lab 4).
 *
 * Механізм: passport (локальна стратегія email+пароль, bcryptjs) поверх
 * express-session. Сесія зберігає лише id користувача; ролі читаються з БД
 * при кожному deserializ'ації, тому зміна ролі в адмінці діє негайно.
 *
 * Матриця дозволів (однакова для Web; у Lab 6 — і для API):
 *   ВІДВІДУВАЧ  — read-only: дашборд, заявки (перегляд), каталоги
 *   МАЙСТЕР     — + статус заявок, роботи/запчастини в заявках, діагностика,
 *                 коментарі, файли
 *   МЕНЕДЖЕР    — + заявки (повний), клієнти, пристрої, оцінки, рахунки,
 *                 оплати, гарантії, каталоги робіт і запчастин
 *   АДМІНІСТРАТОР — + користувачі, решта
 */
import type { Express, NextFunction, Request, Response } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { ROLE_LABELS } from "./labels.js";

export type Role = "ADMIN" | "MANAGER" | "TECHNICIAN" | "VISITOR";

/** Тіри ролей для швидкого підключення захисту на маршрутах. */
export const ROLES = {
  /** Майстер і вище (операції зі статусом/смігом заявок). */
  TECH: ["ADMIN", "MANAGER", "TECHNICIAN"],
  /** Менеджер і вище (довідники, фінанси). */
  MANAGER: ["ADMIN", "MANAGER"],
} as const;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      id: string;
      name: string;
      email: string;
      role: string;
    }
  }
}

const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "lab4-dev-secret-change-me";

function shortUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });
}

/**
 * Ініціалізація сесії + Passport. Выкликається ДО монтажних контролерів.
 * Також наповнює res.locals.user / res.locals.roleLabel для шаблонів.
 */
export function initAuth(app: Express) {
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 8, // 8 годин
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  // Локальна стратегія: вхід за email + пароль (bcryptjs compare).
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      (email, password, done) => {
        prisma.user
          .findUnique({ where: { email: String(email).trim().toLowerCase() } })
          .then((user) => {
            if (!user) {
              return done(null, false, { message: "Невірний email або пароль" });
            }
            if (!bcrypt.compareSync(password, user.password)) {
              return done(null, false, { message: "Невірний email або пароль" });
            }
            return done(
              null,
              {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
              },
            );
          })
          .catch((err) => done(err));
      },
    ),
  );

  passport.serializeUser((user, done) => {
    done(null, (user as Express.User).id);
  });
passport.deserializeUser((id, done) => {
    shortUser(String(id))
      .then((u) => done(null, u ?? false))
      .catch((err) => done(err));
  });

  // Локальні для шаблонів на кожному запиті.
  app.use((req, res, next) => {
    res.locals.user = req.user;
    res.locals.roleLabel = req.user ? ROLE_LABELS[req.user.role] ?? req.user.role : null;
    next();
  });
}

/**
 * Захист маршруту списком ролей.
 * - не авторизований → редірект на /login?next=... (Web-сценарій);
 * - авторизований без потрібної ролі → 403 (errors/403).
 */
export function requireRole(roles: readonly string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      const nextUrl = req.originalUrl;
      return res.redirect(`/login?next=${encodeURIComponent(nextUrl)}`);
    }
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .render("errors/403", {
          nav: "none",
          requiredRoles: roles.map((r) => ROLE_LABELS[r] ?? r).join(", "),
        });
    }
    next();
  };
}
