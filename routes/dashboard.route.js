import express from "express";
import authenticateToken from "../middleware/auth.js";
import authorizeRoles from "../middleware/authorize.js";
import {
  getLowStockMaterials,
  getDashboardSummary,
} from "../controllers/dashboard.controller.js";

const router = express.Router();

// protect dashboard endpoints (admin only)
router.get(
  "/low-stock",
  authenticateToken,
  authorizeRoles("admin"),
  getLowStockMaterials
);

router.get(
  "/summary",
  authenticateToken,
  authorizeRoles("admin"),
  getDashboardSummary
);

export default router;