/**
 * Авторизація та ролі (Lab 4).
 *
 * Механізм: passport (локальна стратегія email+пароль, bcryptjs) поверх
 * express-session. Сесія зберігає лише id користувача; ролі читаються з БД
 * при кожному deserializ'ації, тому зміна ролі в адмінці діє негайно.
 *
 * Матриця дозволів (однакова для Web):
 *   ВІДВІДУВАЧ  — read-only: дашборд, заявки (перегляд), каталоги
 *   КЛІЄНТ      — тільки свої замовлення (Client.userId = акаунт): список
 *                 «Мої замовлення» + скорочена картка (статус + фінанси)
 *   МАЙСТЕР     — повна персоналська сила: каталоги, заявки, оцінки,
 *                 рахунки, оплати, гарантії, діагностика, коментарі, файли;
 *                 у списку заявок бачить лише призначені собі
 *   АДМІНІСТРАТОР — усе, без фільтра «свої»
 *
 * Без входу доступні лише: лендінг «/», /login, /register, /health, /uploads.
 */
import type { Express, NextFunction, Request, Response } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { ROLE_LABELS } from "./labels.js";

export type Role = "ADMIN" | "TECHNICIAN" | "VISITOR" | "CLIENT";

/** Комбінації ролей для швидкого підключення захисту на маршрутах. */
export const ROLES = {
  /** Персонал: адмін + майстер (каталоги, заявки, фінанси, технічні дії). */
  STAFF: ["ADMIN", "TECHNICIAN"],
  /** Персонал + відвідувач (усі сторінки даних у режимі перегляду). */
  VIEW: ["ADMIN", "TECHNICIAN", "VISITOR"],
} as const;

/** Домівка після входу/після логіну: клієнт — свої замовлення, решта — дашборд. */
export function homeFor(user: Pick<Express.User, "role">): string {
  return user.role === "CLIENT" ? "/requests/my-orders" : "/dashboard";
}

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

/** Сіль HMAC сесій. Обов'язкова: публічний fallback-секрет у коді — відома слабка точка. */
const SESSION_SECRET = process.env.SESSION_SECRET;

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
  if (!SESSION_SECRET) {
    throw new Error(
      "SESSION_SECRET не встановлено: додайте змінну (див. .env.example / docker-compose.yml)",
    );
  }
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
          .then(async (user) => {
            if (!user) {
              return done(null, false, { message: "Невірний email або пароль" });
            }
            // bcrypt.compare (async) — без блокування event loop (compareSync — minor).
            const ok = await bcrypt.compare(String(password), user.password);
            if (!ok) {
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

/**
 * Глобальний захист: без входу доступні лише публічні шляхи
 * (лендінг «/», авторизація, health, статика, uploads).
 * Решта — редірект на /login?next=...
 */
const PUBLIC_PREFIXES = ["/login", "/register", "/health", "/uploads", "/css", "/js", "/favicon.ico"];

export function guestGate(req: Request, res: Response, next: NextFunction) {
  const p = req.path;
  if (req.user || p === "/" || PUBLIC_PREFIXES.some((x) => p === x || p.startsWith(x + "/"))) {
    return next();
  }
  return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
}
