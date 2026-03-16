import express from "express";
import nodemailer from "nodemailer";
import authenticateToken from "../middleware/auth.js";
import authorizeRoles from "../middleware/authorize.js";
import { generateInvoicePdfBuffer } from "../controllers/invoice.controller.js";

const router = express.Router();
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("EMAIL_USER / EMAIL_PASS not set in environment variables");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

const isLikelyBase64 = (str) => {
  if (typeof str !== "string") return false;
  // very basic guard; prevents non-string / empty payloads
  return str.length > 50;
};

// @route   POST /api/email/send-bill
// @desc    Send bill PDF via email
// @access  Private (admin only)
router.post(
  "/send-bill",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { to, subject, billData, pdfBuffer } = req.body;

      if (!to || !billData || !pdfBuffer) {
        return res.status(400).json({
          message: "Missing required fields: to, billData, pdfBuffer",
        });
      }

      if (!isValidEmail(to)) {
        return res.status(400).json({ message: "Invalid recipient email" });
      }

      if (!isLikelyBase64(pdfBuffer)) {
        return res.status(400).json({ message: "Invalid pdfBuffer" });
      }

      const transporter = createTransporter();

      const safeClient = (billData.client || "client").toString().slice(0, 40);

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: subject || "Your Bill from Vrindavan Traders",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Vrindavan Traders</h2>
            <p>Dear Customer,</p>
            <p>Please find attached your bill/invoice.</p>

            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Bill Details:</h3>
              <p><strong>Client:</strong> ${billData.client || "N/A"}</p>
              <p><strong>Amount:</strong> ₹${billData.amount || "0.00"}</p>
              <p><strong>Date:</strong> ${billData.date || new Date().toLocaleDateString()}</p>
              <p><strong>Status:</strong> ${billData.status || "Pending"}</p>
            </div>

            <p>Thank you for your business!</p>
            <p>Best regards,<br>Vrindavan Traders Team</p>
          </div>
        `,
        attachments: [
          {
            filename: `bill_${safeClient}_${billData.id || Date.now()}.pdf`,
            content: Buffer.from(pdfBuffer, "base64"),
            contentType: "application/pdf",
          },
        ],
      };

      await transporter.sendMail(mailOptions);

      res.json({ message: "Bill sent successfully via email" });
    } catch (error) {
      console.error("Email send error:", error);
      res.status(500).json({
        message: "Failed to send email",
        error: error.message,
      });
    }
  }
);

// @route   POST /api/email/test
// @desc    Test email configuration
// @access  Private (admin only)
router.post(
  "/test",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { to } = req.body;

      if (!to) {
        return res.status(400).json({ message: "Email address required" });
      }

      if (!isValidEmail(to)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      const transporter = createTransporter();

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject: "Email Test - Vrindavan Traders",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Vrindavan Traders</h2>
            <p>This is a test email to verify email configuration.</p>
            <p>If you received this email, the email service is working correctly.</p>
            <p>Best regards,<br>Vrindavan Traders Team</p>
          </div>
        `,
      });

      res.json({ message: "Test email sent successfully" });
    } catch (error) {
      console.error("Test email error:", error);
      res.status(500).json({
        message: "Failed to send test email",
        error: error.message,
      });
    }
  }
);

export default router;

// New route: POST /api/email/send-bill/invoice/:id
router.post(
  "/send-bill/invoice/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const invoiceId = req.params.id;
      const { to: overrideTo, subject, companyProfile } = req.body || {};

      const { pdfBuffer, invoice } = await generateInvoicePdfBuffer(invoiceId, companyProfile || {});
      if (!pdfBuffer || !invoice) return res.status(404).json({ message: "Invoice not found or PDF generation failed" });

      const registeredCompanyEmail = String(companyProfile?.email || "").trim();
      const hasValidCompanyEmail = isValidEmail(registeredCompanyEmail);

      const primaryRecipient = overrideTo || invoice.clientEmail || (invoice.customer && invoice.customer.email) || "";
      const to = String(primaryRecipient || "").trim() || (hasValidCompanyEmail ? registeredCompanyEmail : "");

      if (!to) return res.status(400).json({ message: "No recipient email found for this invoice" });
      if (!isValidEmail(to)) return res.status(400).json({ message: "Invalid recipient email" });

      const shouldBccCompany = hasValidCompanyEmail && registeredCompanyEmail.toLowerCase() !== to.toLowerCase();

      const transporter = (() => {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
          throw new Error("EMAIL_USER / EMAIL_PASS not set in environment variables");
        }
        return nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });
      })();

      const safeClient = (invoice.client || (invoice.customer && invoice.customer.name) || "client").toString().slice(0, 40);

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        ...(hasValidCompanyEmail ? { replyTo: registeredCompanyEmail } : {}),
        ...(shouldBccCompany ? { bcc: registeredCompanyEmail } : {}),
        subject: subject || `Invoice from Vrindavan Traders - ${invoice.invoiceNumber || invoice._id}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0f4c5c;">Vrindavan Traders</h2>
            <p>Dear ${invoice.client || (invoice.customer && invoice.customer.name) || 'Customer'},</p>
            <p>Please find attached your invoice <strong>${invoice.invoiceNumber || ''}</strong>.</p>
            <p>Thank you for your business!</p>
            <p>Best regards,<br>Vrindavan Traders Team</p>
          </div>
        `,
        attachments: [
          {
            filename: `invoice_${safeClient}_${invoice.invoiceNumber || invoice._id}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      };

      await transporter.sendMail(mailOptions);
      res.json({ message: "Invoice generated and emailed successfully" });
    } catch (error) {
      console.error("send-bill/invoice error:", error);
      res.status(500).json({ message: "Failed to generate/send invoice", error: error.message });
    }
  }
);