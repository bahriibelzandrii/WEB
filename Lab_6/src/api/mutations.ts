// src/api/mutations.ts — /api: мутації. Пишемо через ті samі web-контролери
// (Lab 3–5): валідація та інваріанти однакові для Web і REST; redirect → успіх,
// 400-render → 400 JSON зі списком помилок.
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import type { Role } from "../lib/auth.js";
import prisma from "../prisma.js";
import { runWeb, sendWebFailure, type WebHandler } from "./http.js";
import { fetchRequestFull, type RequestFull } from "./lists.js";
import * as clients from "../controllers/clients.js";
import * as devices from "../controllers/devices.js";
import * as works from "../controllers/works.js";
import * as parts from "../controllers/parts.js";
import * as requests from "../controllers/requests.js";
import * as users from "../controllers/users.js";

type Refetch = (id: string) => Promise<unknown>;

/** Довідники + заявки: redirect web-контролера містить id (/clients/<id>). */
const REFRESH: Record<string, Refetch> = {
  client: (id) => prisma.client.findUnique({ where: { id } }),
  device: (id) =>
    prisma.device.findUnique({
      where: { id },
      include: { owner: { select: { id: true, name: true } } },
    }),
  work: (id) => prisma.workCatalog.findUnique({ where: { id } }),
  part: (id) => prisma.part.findUnique({ where: { id } }),
};

function idFromUrl(url: string): string {
  return url.split("/").filter(Boolean)[1] ?? "";
}

/** Універсальна мутація довідника через web-контролер. */
async function mutate(
  req: Request,
  res: Response,
  handler: WebHandler,
  after: "create" | "edit" | "remove",
  entity: keyof typeof REFRESH,
): Promise<void> {
  const outcome = await runWeb(req, handler);
  if (!outcome.ok) return sendWebFailure(res, outcome);
  if (after === "remove") {
    res.status(204).send();
    return;
  }
  const data = await REFRESH[entity](idFromUrl(outcome.url));
  res.status(after === "create" ? 201 : 200).json({ data });
}

// ───────────────────── Клієнти / Пристрої (Lab 3) ─────────────────────

export const createClient = (req: Request, res: Response) => mutate(req, res, clients.create, "create", "client");
export const editClient = (req: Request, res: Response) => mutate(req, res, clients.edit, "edit", "client");
export const removeClient = (req: Request, res: Response) => mutate(req, res, clients.remove, "remove", "client");

export const createDevice = (req: Request, res: Response) => mutate(req, res, devices.create, "create", "device");
export const editDevice = (req: Request, res: Response) => mutate(req, res, devices.edit, "edit", "device");
export const removeDevice = (req: Request, res: Response) => mutate(req, res, devices.remove, "remove", "device");

// ───────────────────── Каталоги (Lab 3) ─────────────────────

export const createWork = (req: Request, res: Response) => mutate(req, res, works.create, "create", "work");
export const editWork = (req: Request, res: Response) => mutate(req, res, works.edit, "edit", "work");
export const removeWork = (req: Request, res: Response) => mutate(req, res, works.remove, "remove", "work");

export const createPart = (req: Request, res: Response) => mutate(req, res, parts.create, "create", "part");
export const editPart = (req: Request, res: Response) => mutate(req, res, parts.edit, "edit", "part");
export const removePart = (req: Request, res: Response) => mutate(req, res, parts.remove, "remove", "part");

// ───────────────────── Заявки (Lab 3–4) ─────────────────────

export const createRequest = async (req: Request, res: Response) => {
  const outcome = await runWeb(req, requests.create);
  if (!outcome.ok) return sendWebFailure(res, outcome);
  const data = await fetchRequestFull(idFromUrl(outcome.url));
  res.status(201).json({ data });
};

export const editRequest = async (req: Request, res: Response) => {
  const outcome = await runWeb(req, requests.edit);
  if (!outcome.ok) return sendWebFailure(res, outcome);
  res.status(200).json({ data: await fetchRequestFull(idFromUrl(outcome.url)) });
};

export const removeRequest = async (req: Request, res: Response) => {
  const outcome = await runWeb(req, requests.remove);
  if (!outcome.ok) return sendWebFailure(res, outcome);
  res.status(204).send();
};


/** Мутація секції картки заявки: web-контролер → помилка JSON або оновлений фрагмент. */
async function cardOp(
  req: Request,
  res: Response,
  handler: WebHandler,
  status: number,
  then: (r: RequestFull) => unknown,
): Promise<void> {
  const outcome = await runWeb(req, handler);
  if (!outcome.ok) return sendWebFailure(res, outcome);
  const r = await fetchRequestFull(String(req.params.id ?? ""));
  if (!r) {
    res.status(409).json({ error: "Request not found" });
    return;
  }
  res.status(status).json({ data: then(r) });
}

export const transitionRequest = (req: Request, res: Response) =>
  cardOp(req, res, requests.transition, 200, (r) => ({ id: r.id, number: r.number, status: r.status }));

export const addWorkLine = (req: Request, res: Response) =>
  cardOp(req, res, requests.addWork, 201, (r) => r.works[r.works.length - 1]);

export const removeWorkLine = async (req: Request, res: Response) => {
  const outcome = await runWeb(req, requests.removeWork);
  if (!outcome.ok) return sendWebFailure(res, outcome);
  res.status(204).send();
};

export const addPartLine = (req: Request, res: Response) =>
  cardOp(req, res, requests.addPart, 201, (r) => r.parts[r.parts.length - 1]);

export const removePartLine = async (req: Request, res: Response) => {
  const outcome = await runWeb(req, requests.removePart);
  if (!outcome.ok) return sendWebFailure(res, outcome);
  res.status(204).send();
};

export const saveDiagnostics = (req: Request, res: Response) =>
  cardOp(req, res, requests.saveDiagnostics, 200, (r) => r.diagnostics);

export const saveEstimate = (req: Request, res: Response) =>
  cardOp(req, res, requests.saveEstimate, 200, (r) => r.estimate);

export const approveEstimate = (req: Request, res: Response) =>
  cardOp(req, res, requests.approveEstimate, 200, (r) => r.estimate);

export const rejectEstimate = (req: Request, res: Response) =>
  cardOp(req, res, requests.rejectEstimate, 200, (r) => r.estimate);

export const createInvoice = (req: Request, res: Response) =>
  cardOp(req, res, requests.createInvoice, 201, (r) => r.invoice);

export const addPayment = (req: Request, res: Response) =>
  cardOp(req, res, requests.addPayment, 201, (r) => r.invoice);

export const saveWarranty = (req: Request, res: Response) =>
  cardOp(req, res, requests.saveWarranty, 200, (r) => r.warranty);

export const addComment = (req: Request, res: Response) =>
  cardOp(req, res, requests.addComment, 201, (r) => r.comments[r.comments.length - 1]);

export const addAttachment = (req: Request, res: Response) =>
  cardOp(req, res, requests.addAttachment, 201, (r) => r.attachments[r.attachments.length - 1]);

// ───────────────────── Користувачі (Lab 5) ─────────────────────
// create — напряму (web create редіректить на список без id), але та сама
// validateUser з web-контролера; edit/remove — через web-контролери.

export const createUser = async (req: Request, res: Response) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const password = String(b.password ?? "");
  const { errors, values } = users.validateUser(b, { requirePassword: true });
  if (errors.length > 0) {
    res.status(400).json({ error: "Validation failed", errors });
    return;
  }
  try {
    const user = await prisma.user.create({
      data: {
        name: values.name,
        email: values.email,
        phone: values.phone || null,
        role: values.role as Role,
        password: await bcrypt.hash(password, 10),
      },
    });
    const { password: _hidden, ...safe } = user;
    void _hidden;
    res.status(201).json({ data: safe });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      res.status(400).json({ error: "User with this email already exists" });
      return;
    }
    throw err;
  }
};

export const editUser = async (req: Request, res: Response) => {
  const outcome = await runWeb(req, users.edit);
  if (!outcome.ok) return sendWebFailure(res, outcome);
  const id = String(req.params.id ?? "");
  const data = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
  });
  res.status(200).json({ data });
};

export const removeUser = async (req: Request, res: Response) => {
  const outcome = await runWeb(req, users.remove);
  if (!outcome.ok) return sendWebFailure(res, outcome);
  res.status(204).send();
};
