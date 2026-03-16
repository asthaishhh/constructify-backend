import express from "express";

import { signup, login, me } from "../controllers/auth.controller.js";
import authenticateToken from "../middleware/auth.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", authenticateToken, me);

export default router;
