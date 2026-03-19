


import express from "express";
import authenticateToken from "../middleware/auth.js";
import authorizeRoles from "../middleware/authorize.js";

import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
} from "../controllers/order.controller.js";

const router = express.Router();

/* -------------------------
   🔐 Require Authentication
--------------------------*/
router.use(authenticateToken);

/* -------------------------
   ✅ GET all orders
   Admin + User
--------------------------*/
router.get("/", authorizeRoles("admin", "user"), getOrders);

/* -------------------------
   ✅ GET single order
   Admin + User
--------------------------*/
router.get("/:id", authorizeRoles("admin", "user"), getOrderById);

/* -------------------------
   ✅ Create new order
   Admin + User
   (Inventory deduction happens in controller)
--------------------------*/
router.post("/", authorizeRoles("admin", "user"), createOrder);

/* -------------------------
   ✅ Update order status
   Admin + User
--------------------------*/
router.put("/:id/status", authorizeRoles("admin", "user"), updateOrderStatus);

/* -------------------------
   ❌ Delete order
   Admin only
--------------------------*/
router.delete("/:id", authorizeRoles("admin"), deleteOrder);

export default router;