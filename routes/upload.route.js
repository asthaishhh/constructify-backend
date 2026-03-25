import express from "express";
import upload from "../middleware/upload.js";
import { registerCompany } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register-company", upload.single("logo"), registerCompany);

export default router;