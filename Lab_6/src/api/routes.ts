// src/api/routes.ts — /api: RESTful API (Lab 6).
// Матриця ролей 1:1 з web-маршрутами (Lab 4–5):
//   MANAGER+ — довідники, заявки, фінанси; TECH+ — робота зі заявкою; ADMIN — користувачі.
import { Router, type NextFunction, type Request, type Response } from "express";
import { ROLES } from "../lib/auth.js";
import { apiAuth, prismaError, wrap } from "./http.js";
import * as L from "./lists.js";
import * as M from "./mutations.js";

const router = Router();

// ─────────── Публічні читання (усі ролі, включно з гостями) ───────────
router.get("/clients", wrap(L.listClients));
router.get("/clients/:id", wrap(L.getClient));
router.get("/devices", wrap(L.listDevices));
router.get("/devices/:id", wrap(L.getDevice));
router.get("/works", wrap(L.listWorks));
router.get("/works/:id", wrap(L.getWork));
router.get("/parts", wrap(L.listParts));
router.get("/parts/:id", wrap(L.getPart));
router.get("/requests", wrap(L.listRequests));
router.get("/requests/:id", wrap(L.getRequest));

// ─────────── Клієнти / Пристрої (MANAGER+) ───────────
router.post("/clients", apiAuth(ROLES.MANAGER), wrap(M.createClient));
router.put("/clients/:id", apiAuth(ROLES.MANAGER), wrap(M.editClient));
router.delete("/clients/:id", apiAuth(ROLES.MANAGER), wrap(M.removeClient));

router.post("/devices", apiAuth(ROLES.MANAGER), wrap(M.createDevice));
router.put("/devices/:id", apiAuth(ROLES.MANAGER), wrap(M.editDevice));
router.delete("/devices/:id", apiAuth(ROLES.MANAGER), wrap(M.removeDevice));

// ─────────── Каталоги (MANAGER+) ───────────
router.post("/works", apiAuth(ROLES.MANAGER), wrap(M.createWork));
router.put("/works/:id", apiAuth(ROLES.MANAGER), wrap(M.editWork));
router.delete("/works/:id", apiAuth(ROLES.MANAGER), wrap(M.removeWork));

router.post("/parts", apiAuth(ROLES.MANAGER), wrap(M.createPart));
router.put("/parts/:id", apiAuth(ROLES.MANAGER), wrap(M.editPart));
router.delete("/parts/:id", apiAuth(ROLES.MANAGER), wrap(M.removePart));

// ─────────── Заявки ───────────
router.post("/requests", apiAuth(ROLES.MANAGER), wrap(M.createRequest));
router.put("/requests/:id", apiAuth(ROLES.MANAGER), wrap(M.editRequest));
router.delete("/requests/:id", apiAuth(ROLES.MANAGER), wrap(M.removeRequest));

// Статус / роботи / запчастини / діагностика / коментарі / файли — МАЙСТЕР+
router.post("/requests/:id/transition", apiAuth(ROLES.TECH), wrap(M.transitionRequest));
router.post("/requests/:id/works", apiAuth(ROLES.TECH), wrap(M.addWorkLine));
router.delete("/requests/:id/works/:lineId", apiAuth(ROLES.TECH), wrap(M.removeWorkLine));
router.post("/requests/:id/parts", apiAuth(ROLES.TECH), wrap(M.addPartLine));
router.delete("/requests/:id/parts/:lineId", apiAuth(ROLES.TECH), wrap(M.removePartLine));
router.post("/requests/:id/diagnostics", apiAuth(ROLES.TECH), wrap(M.saveDiagnostics));
router.post("/requests/:id/comments", apiAuth(ROLES.TECH), wrap(M.addComment));
router.post("/requests/:id/attachments", apiAuth(ROLES.TECH), wrap(M.addAttachment));

// Оцінка / рахунок / оплата / гарантія — МЕНЕДЖЕР+
router.post("/requests/:id/estimate", apiAuth(ROLES.MANAGER), wrap(M.saveEstimate));
router.post("/requests/:id/estimate/approve", apiAuth(ROLES.MANAGER), wrap(M.approveEstimate));
router.post("/requests/:id/estimate/reject", apiAuth(ROLES.MANAGER), wrap(M.rejectEstimate));
router.post("/requests/:id/invoice", apiAuth(ROLES.MANAGER), wrap(M.createInvoice));
router.post("/requests/:id/payments", apiAuth(ROLES.MANAGER), wrap(M.addPayment));
router.post("/requests/:id/warranty", apiAuth(ROLES.MANAGER), wrap(M.saveWarranty));

// ─────────── Користувачі (ADMIN) ───────────
router.get("/users", apiAuth(["ADMIN"]), wrap(L.listUsers));
router.get("/users/:id", apiAuth(["ADMIN"]), wrap(L.getUser));
router.post("/users", apiAuth(["ADMIN"]), wrap(M.createUser));
router.put("/users/:id", apiAuth(["ADMIN"]), wrap(M.editUser));
router.delete("/users/:id", apiAuth(["ADMIN"]), wrap(M.removeUser));

// Не відомий маршрут /api → JSON 404 (не HTML-сторінка).
router.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

// Помилки /api → JSON (замість глобального HTML-обробника).
router.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const mapped = prismaError(err);
    if (mapped) {
      res.status(mapped.status).json(mapped);
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  },
);

export default router;
