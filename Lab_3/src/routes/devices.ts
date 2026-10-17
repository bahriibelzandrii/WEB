import { Router } from "express";
import { index, createForm, create, show, editForm, edit, remove, confirmRemove } from "../controllers/devices.js";

const router = Router();
router.get("/", index);
router.get("/new", createForm);
router.post("/", create);
router.get("/:id", show);
router.get("/:id/edit", editForm);
router.post("/:id/edit", edit);
router.post("/:id/delete", remove);
router.get("/:id/delete", confirmRemove);

export default router;
