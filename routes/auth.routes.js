import express from "express";

import { signup, login, me, registerCompany } from "../controllers/auth.controller.js";
import authenticateToken from "../middleware/auth.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/register-company", registerCompany);
router.post("/login", login);
router.get("/me", authenticateToken, me);

export default router;
