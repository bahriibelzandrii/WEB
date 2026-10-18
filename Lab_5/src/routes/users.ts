import { Router } from "express";
import { requireRole } from "../lib/auth.js";
import * as c from "../controllers/users.js";

// Керування користувачами — лише АДМІНІСТРАТОР (матриця дозволів, Lab 5).
const router = Router();

router.use(requireRole(["ADMIN"]));

router.get("/", c.index);
router.get("/new", c.createForm);
router.post("/", c.create);
router.get("/:id/edit", c.editForm);
router.post("/:id/edit", c.edit);
router.get("/:id/delete", c.confirmRemove);
router.post("/:id/delete", c.remove);

export default router;
