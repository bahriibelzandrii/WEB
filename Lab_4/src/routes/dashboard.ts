import { Router } from "express";
import { index } from "../controllers/dashboard.js";
import { homeFor, requireRole, ROLES } from "../lib/auth.js";

const router = Router();

// Публічний лендінг (без БД): маркетингова сторінка + вхід/реєстрація.
router.get("/", (req, res) => (req.user ? res.redirect(homeFor(req.user)) : res.render("landing", { nav: "landing" })));

// Дашборд — після входу (персонал + відвідувач; клієнт — 403, у нього свої замовлення).
router.get("/dashboard", requireRole(ROLES.VIEW), index);

export default router;
