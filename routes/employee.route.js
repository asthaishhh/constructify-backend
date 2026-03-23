import express from "express";
import Employee from "../models/Employee.js";
import authenticateToken from "../middleware/auth.js";
import authorizeRoles from "../middleware/authorize.js";

const router = express.Router();

const getCompanyIdFromReq = (req) => String(req?.user?.companyId || "").trim();

/* -------------------------
   🔐 Require Authentication
--------------------------*/
router.use(authenticateToken);

/* -------------------------
   ✅ GET all employees
   Admin + User
--------------------------*/
router.get("/", authorizeRoles("admin", "user"), async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

    const employees = await Employee.find({ companyId }).sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* -------------------------
   ❌ POST add employee
   Admin ONLY
--------------------------*/
router.post("/", authorizeRoles("admin"), async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

    const savedEmployee = await Employee.create({ ...req.body, companyId });
    res.status(201).json(savedEmployee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* -------------------------
   ❌ PUT update employee
   Admin ONLY
--------------------------*/
router.put("/:id", authorizeRoles("admin"), async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

    const updatedEmployee = await Employee.findOneAndUpdate(
      { _id: req.params.id, companyId },
      req.body,
      { new: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(updatedEmployee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* -------------------------
   ❌ DELETE employee
   Admin ONLY
--------------------------*/
router.delete("/:id", authorizeRoles("admin"), async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

    const deletedEmployee = await Employee.findOneAndDelete({ _id: req.params.id, companyId });

    if (!deletedEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({ message: "Employee deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;