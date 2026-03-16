import express from "express";
import authenticateToken from "../middleware/auth.js";
import authorizeRoles from "../middleware/authorize.js";
import {
  createInvoice,
  getInvoices,
  updateInvoice,
  deleteInvoice,
   generateInvoicePdf,
} from "../controllers/invoice.controller.js";

const router = express.Router();

/* -------------------------
   🔐 Authentication Required
--------------------------*/
router.use(authenticateToken);

/* -------------------------
   ✅ GET all invoices
   Admin + User
--------------------------*/
router.get("/", authorizeRoles("admin", "user"), getInvoices);

/* -------------------------
   ✅ POST new invoice (Generate Bill)
   Admin + User
--------------------------*/
router.post("/", authorizeRoles("admin", "user"), createInvoice);

/* -------------------------
   ✅ PUT update invoice
   Admin + User
--------------------------*/
router.put("/:id", authorizeRoles("admin", "user"), updateInvoice);

/* -------------------------
   ✅ GET invoice PDF
   Admin + User
--------------------------*/
router.get("/:id/pdf", authorizeRoles("admin", "user"), generateInvoicePdf);
router.post("/:id/pdf", authorizeRoles("admin", "user"), generateInvoicePdf);

/* -------------------------
   ❌ DELETE invoice
   Admin ONLY
--------------------------*/
router.delete("/:id", authorizeRoles("admin"), deleteInvoice);

export default router;