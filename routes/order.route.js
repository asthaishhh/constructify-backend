// import express from "express";
// import Order from "../middleware/models/order.js";
// import  authenticateToken  from "../auth.js";
// import { authorizeRoles } from "../middleware/authorizeRoles.js";

// const router = express.Router();

// /* -------------------------
//    🔐 Require Authentication
// --------------------------*/
// router.use(authenticateToken);


// /* -------------------------
//    ✅ GET all orders
// --------------------------*/
// router.get("/", authorizeRoles("admin", "user"), async (req, res) => {
//   try {
//     const orders = await Order.find();
//     res.json(orders);
//   } catch (error) {
//     res.status(500).json({ message: "Failed to fetch orders" });
//   }
// });


// /* -------------------------
//    ✅ Create new order
// --------------------------*/
// router.post("/", authorizeRoles("admin", "user"), async (req, res) => {
//   try {
//     const newOrder = new Order(req.body);
//     await newOrder.save();
//     res.status(201).json(newOrder);
//   } catch (error) {
//     res.status(400).json({ message: "Failed to create order" });
//   }
// });


// /* -------------------------
//    ✅ Update order
// --------------------------*/
// router.put("/:id", authorizeRoles("admin", "user"), async (req, res) => {
//   try {
//     const updatedOrder = await Order.findByIdAndUpdate(
//       req.params.id,
//       req.body,
//       { new: true }
//     );

//     if (!updatedOrder) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     res.json(updatedOrder);
//   } catch (error) {
//     res.status(400).json({ message: "Failed to update order" });
//   }
// });


// /* -------------------------
//    ❌ Delete order (Admin Only)
// --------------------------*/
// router.delete("/:id", authorizeRoles("admin"), async (req, res) => {
//   try {
//     const deletedOrder = await Order.findByIdAndDelete(req.params.id);

//     if (!deletedOrder) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     res.json({ message: "Order deleted successfully" });
//   } catch (error) {
//     res.status(400).json({ message: "Failed to delete order" });
//   }
// });

// export default router;


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