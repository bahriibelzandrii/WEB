import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { STATUS_LABELS, INVOICE_STATUS_LABELS } from "../lib/labels.js";
import { REQUEST_STATUSES } from "../lib/transitions.js";
import { dateOnly, dateTime, uah } from "../lib/format.js";
import { clean, isEmail, isPhone, isUaPhone, isUniqueViolation, tooLong } from "../lib/validate.js";

const RECENT = 10;

/**
 * Особистий кабінет (Lab 4): профіль, зміна пароля.
 * Лічильники за статусами та недавні заявки — лише для КЛІЄНТА
 * (його замовлення: Client.userId = user); для персоналу кабінет —
 * тільки профіль і пароль.
 */
function scopeFor(role: string, userId: string): Record<string, unknown> {
  if (role === "CLIENT") return { client: { userId } };
  if (role === "TECHNICIAN") return { assignedToId: userId };
  return {};
}

async function cabinetLocals(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  if (user.role !== "CLIENT") {
    return { user, scope: {} as Record<string, unknown>, byStatus: [], recent: [] };
  }
  const scope = scopeFor(user.role, user.id);
  const [byStatus, recent] = await Promise.all([
    prisma.request.groupBy({
      by: ["status"],
      where: { deletedAt: null, ...scope },
      _count: true,
    }),
    prisma.request.findMany({
      where: { deletedAt: null, ...scope },
      include: {
        client: true,
        device: true,
        invoice: { select: { status: true, finalTotal: true } },
      },
      orderBy: { createdAt: "desc" },
      take: RECENT,
    }),
  ]);
  return { user, scope, byStatus, recent };
}

function renderCabinet(
  res: Response,
  locals: NonNullable<Awaited<ReturnType<typeof cabinetLocals>>>,
  extra: Record<string, unknown> = {},
) {
  res.render("cabinet/index", {
    nav: "cabinet",
    user: locals.user,
    byStatus: locals.byStatus,
    recent: locals.recent,
    statusLabels: STATUS_LABELS,
    statuses: REQUEST_STATUSES,
    invoiceStatusLabels: INVOICE_STATUS_LABELS,
    dateOnly,
    dateTime,
    uah,
    errors: null as string[] | null,
    values: { name: locals.user.name, email: locals.user.email, phone: locals.user.phone ?? "" },
    ...extra,
  });
}

/** GET /cabinet — кабінет. */
export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const locals = await cabinetLocals(req.user!.id);
    if (!locals) {
      res.status(404).render("errors/404", { nav: "none" });
      return;
    }
    const changed = req.query.changed === "1";
    return renderCabinet(res, locals, { changed });
  } catch (e) {
    return next(e);
  }
}

/** POST /cabinet/profile — оновлення імені/телефону/email (валідація Lab 3). */
export async function profilePost(req: Request, res: Response, next: NextFunction) {
  try {
    const b = req.body ?? {};
    const name = clean(b.name);
    const email = clean(b.email).toLowerCase();
    const phone = clean(b.phone);
    const errors: string[] = [];
    if (name.length < 2) errors.push("Вкажіть ім'я (мінімум 2 символи)");
    if (tooLong(name, 100)) errors.push("Ім'я: до 100 символів");
    if (!isEmail(email)) errors.push("Email: некоректний формат");
    if (tooLong(email, 320)) errors.push("Email: до 320 символів");
    if (phone && !isUaPhone(phone) && !isPhone(phone)) {
      errors.push("Телефон: +380 + 9 цифр (напр., +380671234501) або 0 + 9 цифр");
    }

    const locals = await cabinetLocals(req.user!.id);
    if (!locals) {
      res.status(404).render("errors/404", { nav: "none" });
      return;
    }

    if (errors.length > 0) {
      res.status(400);
      return renderCabinet(res, locals, {
        errors,
        values: { name, email, phone },
      });
    }

    try {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { name, email, phone: phone || null },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        res.status(400);
        return renderCabinet(res, (await cabinetLocals(req.user!.id))!, {
          errors: ["Email вже використовується іншим акаунтом"],
          values: { name, email, phone },
        });
      }
      throw e;
    }
    res.redirect("/cabinet");
  } catch (e) {
    next(e);
  }
}

/** POST /cabinet/password — зміна пароля (перевірка поточного, bcrypt hash). */
export async function passwordPost(req: Request, res: Response, next: NextFunction) {
  try {
    const b = req.body ?? {};
    const current = String(b.currentPassword ?? "");
    const fresh = String(b.newPassword ?? "");
    const confirm = String(b.confirmPassword ?? "");
    const errors: string[] = [];

    const locals = await cabinetLocals(req.user!.id);
    if (!locals) {
      res.status(404).render("errors/404", { nav: "none" });
      return;
    }

    const okCurrent = current !== "" && (await bcrypt.compare(current, locals.user.password));
    if (!okCurrent) errors.push("Поточний пароль невірний");
    if (fresh.length < 8) errors.push("Новий пароль: мінімум 8 символів");
    if (tooLong(fresh, 200)) errors.push("Новий пароль: до 200 символів");
    if (fresh !== confirm) errors.push("Повтор паролів не збігається");

    if (errors.length > 0) {
      res.status(400);
      return renderCabinet(res, locals, { errors });
    }

    const hash = await bcrypt.hash(fresh, 10);
    await prisma.user.update({ where: { id: req.user!.id }, data: { password: hash } });
    res.redirect("/cabinet?changed=1");
  } catch (e) {
    next(e);
  }
}
