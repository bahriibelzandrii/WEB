// src/api/http.ts — спільні засоби /api (Lab 6):
// apiAuth (JSON 401/403), пагінація, мапінг кодів Prisma,
// runWeb — провід web-контролерів (Lab 3–5) у REST-контексті.
import type { NextFunction, Request, Response } from "express";

/** Захист /api ролями: 401 для гостей, 403 для низьших ролей (JSON, без редіректів). */
export function apiAuth(roles: readonly string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden", requiredRoles: roles });
    }
    next();
  };
}

export interface PageQuery {
  page: number;
  pageSize: number;
  skip: number;
}

/** page/pageSize з query: page ≥ 1, pageSize 1–100 (дефолт 20), інакше — дефолт. */
export function parsePageQuery(req: Request): PageQuery {
  const pageRaw = Number(req.query.page);
  const sizeRaw = Number(req.query.pageSize);
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const pageSize = Number.isInteger(sizeRaw) && sizeRaw >= 1 && sizeRaw <= 100 ? sizeRaw : 20;
  return { page, pageSize, skip: (page - 1) * pageSize };
}

/** Коды Prisma → HTTP: P2002/P2003 (унікальність/FK) → 400, P2025 → 404. */
export function prismaError(err: unknown): { status: number; error: string } | null {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = err.code;
    if (typeof code !== "string") return null;
    switch (code) {
      case "P2002":
        return { status: 400, error: "Unique constraint violation" };
      case "P2003":
        return { status: 400, error: "Reference constraint violation" };
      case "P2025":
        return { status: 404, error: "Not found" };
    }
  }
  return null;
}

/** Обгортка маршрута /api: помилки Prisma → JSON, решта — у error-обробник routera. */
export function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (err) {
      const mapped = prismaError(err);
      if (mapped) res.status(mapped.status).json(mapped);
      else next(err);
    }
  };
}

export type WebHandler = (req: Request, res: Response) => Promise<void>;

export type WebOutcome =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string; errors?: string[] };

/**
 * Виконати web-контролер (Lab 3–5) від імені /api: та сама валідація й ті самі
 * інваріанти, результат переводиться на JSON:
 * redirect → успіх (url для подальшого dofetch); 404-render → 404;
 * 400-render → 400 зі списком помилок валідації.
 */
export async function runWeb(req: Request, handler: WebHandler): Promise<WebOutcome> {
  const cap = {
    redirectUrl: null as string | null,
    statusCode: 200,
    view: null as string | null,
    locals: {} as Record<string, unknown>,
  };
  const fake = {
    status(code: number) {
      cap.statusCode = code;
      return fake;
    },
    redirect(url: string) {
      cap.redirectUrl = url;
    },
    render(view: string, locals: Record<string, unknown> = {}) {
      cap.view = view;
      cap.locals = locals;
    },
    json(body: unknown) {
      cap.view = "json";
      cap.locals = { __json: body };
    },
    send() {
      return fake;
    },
    end() {
      return fake;
    },
  };
  // Структурний шим: web-контролери використовують лише status/redirect/render/json.
  const resShim = fake as unknown as Response;
  await handler(req, resShim);

  if (cap.redirectUrl) return { ok: true, url: cap.redirectUrl };
  if (cap.view === "errors/404" || cap.statusCode === 404) {
    return { ok: false, status: 404, error: "Not found" };
  }
  if (cap.statusCode === 400) {
    const errors = Array.isArray(cap.locals.errors) ? cap.locals.errors.map(String) : undefined;
    const title = typeof cap.locals.confirmTitle === "string" ? cap.locals.confirmTitle : undefined;
    return { ok: false, status: 400, error: title ?? "Validation failed", ...(errors ? { errors } : {}) };
  }
  if (cap.view === "json") {
    const body = cap.locals.__json;
    const error =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Request failed";
    return { ok: false, status: 400, error };
  }
  return { ok: false, status: 400, error: "Unexpected web response" };
}

/** Надіслати JSON-відповідь про невдачу web-контролера (404/400 + помилки валідації). */
export function sendWebFailure(res: Response, failure: Extract<WebOutcome, { ok: false }>): void {
  res.status(failure.status).json({
    error: failure.error,
    ...(failure.errors ? { errors: failure.errors } : {}),
  });
}
