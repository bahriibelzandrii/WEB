import { Router } from "express";
import { index, createForm, create, editForm, edit, remove, confirmRemove } from "../controllers/parts.js";
import { requireRole, ROLES } from "../lib/auth.js";

// Матриця дозволів (Lab 4): каталог запчастин веде менеджер і адміністратор.
const router = Router();

router.get("/", index);
router.get("/new", requireRole(ROLES.MANAGER), createForm);
router.post("/", requireRole(ROLES.MANAGER), create);
router.get("/:id/edit", requireRole(ROLES.MANAGER), editForm);
router.post("/:id/edit", requireRole(ROLES.MANAGER), edit);
router.post("/:id/delete", requireRole(ROLES.MANAGER), remove);
router.get("/:id/delete", requireRole(ROLES.MANAGER), confirmRemove);

export default router;
