import { Router } from "express";
import { index, show } from "../controllers/requests.js";

const router = Router();
router.get("/", index);
router.get("/:id", show);
export default router;
