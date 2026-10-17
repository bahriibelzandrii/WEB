import { Router } from "express";
import { index } from "../controllers/works.js";

const router = Router();
router.get("/", index);
export default router;
