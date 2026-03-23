import express from "express";
import Customer from "../models/Customer.js";
import authenticateToken from "../middleware/auth.js";
import authorizeRoles from "../middleware/authorize.js";

const router = express.Router();

const getCompanyIdFromReq = (req) => String(req?.user?.companyId || "").trim();

// Create customer (admin only)
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const companyId = getCompanyIdFromReq(req);
      if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

      const customer = await Customer.create({ ...req.body, companyId });
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
      const companyId = getCompanyIdFromReq(req);
      if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

      const customers = await Customer.find({ companyId }).sort({ createdAt: -1 });
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
      const companyId = getCompanyIdFromReq(req);
      if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

      const customer = await Customer.findOne({ _id: req.params.id, companyId });

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