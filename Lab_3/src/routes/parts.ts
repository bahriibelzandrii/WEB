import { Router } from "express";
import { index, createForm, create, editForm, edit, remove, confirmRemove } from "../controllers/parts.js";

const router = Router();

router.get("/", index);
router.get("/new", createForm);
router.post("/", create);
router.get("/:id/edit", editForm);
router.post("/:id/edit", edit);
router.post("/:id/delete", remove);
router.get("/:id/delete", confirmRemove);

export default router;
