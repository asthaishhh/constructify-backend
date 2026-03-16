import express from "express";
import Customer from "../models/Customer.js";
import authenticateToken from "../middleware/auth.js";
import authorizeRoles from "../middleware/authorize.js";

const router = express.Router();

// Create customer (admin only)
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const customer = await Customer.create(req.body);
      res.status(201).json(customer);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Get all customers (admin + user)
router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "user"),
  async (req, res) => {
    try {
      const customers = await Customer.find().sort({ createdAt: -1 });
      res.json(customers);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Get single customer (admin + user)
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "user"),
  async (req, res) => {
    try {
      const customer = await Customer.findById(req.params.id);

      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      res.json(customer);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

export default router;