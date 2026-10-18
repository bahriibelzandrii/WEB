import { Router } from "express";
import { index, profilePost, passwordPost } from "../controllers/cabinet.js";
import { requireRole } from "../lib/auth.js";

// Особистий кабінет: доступні всім ролям (клієнт — профіль + свої замовлення).
const router = Router();
const all = requireRole(["ADMIN", "TECHNICIAN", "VISITOR", "CLIENT"]);

router.get("/", all, index);
router.post("/profile", all, profilePost);
router.post("/password", all, passwordPost);

export default router;
