import { Router } from "express";
import { index, show, createForm, create, editForm, edit, remove, confirmRemove } from "../controllers/clients.js";
import { requireRole, ROLES } from "../lib/auth.js";

// Матриця дозволів (Lab 4): перегляд — персонал + відвідувач; зміни — персонал (адмін/майстер).
const router = Router();
router.get("/", requireRole(ROLES.VIEW), index);
router.get("/new", requireRole(ROLES.STAFF), createForm);
router.post("/", requireRole(ROLES.STAFF), create);
router.get("/:id", requireRole(ROLES.VIEW), show);
router.get("/:id/edit", requireRole(ROLES.STAFF), editForm);
router.post("/:id/edit", requireRole(ROLES.STAFF), edit);
router.post("/:id/delete", requireRole(ROLES.STAFF), remove);
router.get("/:id/delete", requireRole(ROLES.STAFF), confirmRemove);
export default router;
