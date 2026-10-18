import { Router } from "express";
import { loginForm, loginPost, logout, registerForm, registerPost } from "../controllers/auth.js";

const router = Router();

router.get("/login", loginForm);
router.post("/login", loginPost);
router.get("/logout", logout);
router.get("/register", registerForm);
router.post("/register", registerPost);

export default router;
