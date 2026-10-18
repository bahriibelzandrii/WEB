import { Router } from "express";
import { index } from "../controllers/dashboard.js";

const router = Router();
router.get("/", index);
export default router;
