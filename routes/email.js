// Email Brevo 
import express from "express";
import SibApiV3Sdk from "sib-api-v3-sdk";
import authenticateToken from "../middleware/auth.js";
import authorizeRoles from "../middleware/authorize.js";
import { generateInvoicePdfBuffer } from "../controllers/invoice.controller.js";

const router = express.Router();

/* ---------------- BREVO SETUP ---------------- */
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const transactionalApi = new SibApiV3Sdk.TransactionalEmailsApi();

const configureBrevoAuth = () => {
  const key = String(process.env.BREVO_API_KEY || "").trim();

  if (!key) {
    throw new Error("BREVO_API_KEY not set in environment variables");
  }

  const auth =
    defaultClient.authentications["api-key"] ||
    defaultClient.authentications.apiKey ||
    defaultClient.authentications["partner-key"];

  if (!auth) {
    throw new Error("Brevo SDK authentication object not found");
  }

  // Ensure key is set after env has been loaded (important in ESM import order).
  auth.apiKey = key;
};

/* ---------------- HELPERS ---------------- */
const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

const isLikelyBase64 = (str) => {
  if (typeof str !== "string") return false;
  return str.length > 50;
};

const getSender = (companyProfile = {}) => {
  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY not set in environment variables");
  }

  if (!process.env.BREVO_SENDER_EMAIL) {
    throw new Error("BREVO_SENDER_EMAIL not set in environment variables");
  }

  return {
    email: process.env.BREVO_SENDER_EMAIL,
    name: companyProfile?.companyName?.trim() || "Constructify",
  };
};

const sendBrevoEmail = async ({
  to,
  subject,
  htmlContent,
  textContent,
  attachments = [],
  replyTo,
  bcc,
  companyProfile = {},
}) => {
  configureBrevoAuth();
  const sender = getSender(companyProfile);

  const emailData = {
    sender,
    to: [{ email: to }],
    subject,
    htmlContent,
    textContent,
  };

  // Properly format attachments for Brevo API
  if (attachments && attachments.length > 0) {
    emailData.attachment = attachments.map((att) => {
      const base64Content = Buffer.isBuffer(att.content)
        ? att.content.toString("base64")
        : String(att.content || "").replace(/^data:.*;base64,/, "");

      return {
        name: att.name,
        content: base64Content,
      };
    });
  }

  if (replyTo && isValidEmail(replyTo)) {
    emailData.replyTo = { email: replyTo };
  }

  if (bcc && isValidEmail(bcc)) {
    emailData.bcc = [{ email: bcc }];
  }

  console.log(`[BREVO EMAIL] Sending email with ${emailData.attachment?.length || 0} attachment(s)`);
  if (emailData.attachment && emailData.attachment.length > 0) {
    emailData.attachment.forEach((att, idx) => {
      const contentSize = att.content?.length || 0;
      console.log(`  [ATTACHMENT ${idx}] Name: ${att.name}, Content size: ${contentSize} chars (base64)`);
    });
  }

  try {
    const result = await transactionalApi.sendTransacEmail(emailData);
    console.log(`[BREVO EMAIL] Success - Message ID:`, result?.data?.messageId || result?.messageId || 'unknown');
    return result;
  } catch (err) {
    console.error(`[BREVO EMAIL] Error details:`, err?.response?.body || err.message);
    throw err;
  }
};



/* ---------------- SEND BILL ---------------- */
// @route   POST /api/email/send-bill
// @desc    Send bill PDF via email
// @access  Private (admin only)
router.post(
  "/send-bill",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { to, subject, billData, pdfBuffer, companyProfile } = req.body;

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

      const safeClient = (billData.client || "client").toString().slice(0, 40);
      const brandName = companyProfile?.companyName || "Constructify";

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">${brandName}</h2>
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
          <p>Best regards,<br>${brandName} Team</p>
        </div>
      `;

      await sendBrevoEmail({
        to,
        subject: subject || `Your Bill from ${brandName}`,
        htmlContent: html,
        textContent: "Please find attached your bill/invoice.",
        companyProfile,
        attachments: [
          {
            name: `bill_${safeClient}_${billData.id || Date.now()}.pdf`,
            content: pdfBuffer, // already base64 from frontend
          },
        ],
      });

      res.json({ message: "Bill sent successfully via email" });
    } catch (error) {
      console.error("Email send error:", error?.response?.body || error.message);
      res.status(500).json({
        message: "Failed to send email",
        error: error?.response?.body || error.message,
      });
    }
  }
);

/* ---------------- TEST EMAIL ---------------- */
// @route   POST /api/email/test
// @desc    Test email configuration
// @access  Private (admin only)
router.post(
  "/test",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { to, companyProfile } = req.body;

      if (!to) {
        return res.status(400).json({ message: "Email address required" });
      }

      if (!isValidEmail(to)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      const brandName = companyProfile?.companyName || "Constructify";

      await sendBrevoEmail({
        to,
        subject: `Email Test - ${brandName}`,
        companyProfile,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">${brandName}</h2>
            <p>This is a test email to verify email configuration.</p>
            <p>If you received this email, the email service is working correctly.</p>
            <p>Best regards,<br>${brandName} Team</p>
          </div>
        `,
        textContent: "This is a test email to verify email configuration.",
      });

      res.json({ message: "Test email sent successfully" });
    } catch (error) {
      console.error("Test email error:", error?.response?.body || error.message);
      res.status(500).json({
        message: "Failed to send test email",
        error: error?.response?.body || error.message,
      });
    }
  }
);

/* ---------------- SEND GENERATED INVOICE ---------------- */
// @route   POST /api/email/send-bill/invoice/:id
// @desc    Generate invoice PDF and email it
// @access  Private (admin only)
router.post(
  "/send-bill/invoice/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const invoiceId = req.params.id;
      const { to: overrideTo, subject, companyProfile } = req.body || {};

      const { pdfBuffer, invoice } = await generateInvoicePdfBuffer(
        invoiceId,
        companyProfile || {},
        req.user?.companyId || null
      );

      if (!pdfBuffer || !invoice) {
        return res.status(404).json({
          message: "Invoice not found or PDF generation failed",
        });
      }

      if (!Buffer.isBuffer(pdfBuffer) && typeof pdfBuffer !== 'string') {
        console.error("[INVOICE EMAIL] Invalid pdfBuffer type:", typeof pdfBuffer);
        return res.status(500).json({
          message: "PDF generation returned invalid buffer type",
        });
      }

      const registeredCompanyEmail = String(companyProfile?.email || "").trim();
      const hasValidCompanyEmail = isValidEmail(registeredCompanyEmail);

      const primaryRecipient =
        overrideTo ||
        invoice.clientEmail ||
        invoice?.customer?.email ||
        "";

      const to =
        String(primaryRecipient || "").trim() ||
        (hasValidCompanyEmail ? registeredCompanyEmail : "");

      if (!to) {
        return res.status(400).json({
          message: "No recipient email found for this invoice",
        });
      }

      if (!isValidEmail(to)) {
        return res.status(400).json({ message: "Invalid recipient email" });
      }

      const shouldBccCompany =
        hasValidCompanyEmail &&
        registeredCompanyEmail.toLowerCase() !== to.toLowerCase();

      const safeClient = (
        invoice.client ||
        invoice?.customer?.name ||
        "client"
      )
        .toString()
        .slice(0, 40);

      const brandName = companyProfile?.companyName || "Constructify";
      const customerName =
        invoice.client || invoice?.customer?.name || "Customer";

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0f4c5c;">${brandName}</h2>
          <p>Dear ${customerName},</p>
          <p>Please find attached your invoice <strong>${invoice.invoiceNumber || ""}</strong>.</p>
          <p>Thank you for your business!</p>
          <p>Best regards,<br>${brandName} Team</p>
        </div>
      `;

      // Brevo SDK expects Buffer objects, not base64 strings
      const attachments = [
        {
          name: `invoice_${safeClient}_${invoice.invoiceNumber || invoice._id}.pdf`,
          content: pdfBuffer,  // Pass Buffer directly
        },
      ];

      console.log(`[INVOICE EMAIL] PDF Buffer - Type: ${typeof pdfBuffer}, IsBuffer: ${Buffer.isBuffer(pdfBuffer)}, Size: ${Buffer.isBuffer(pdfBuffer) ? pdfBuffer.length : 'unknown'} bytes`);

      console.log(`[INVOICE EMAIL] Sending to: ${to}, with ${attachments.length} attachment(s)`);

      await sendBrevoEmail({
        to,
        subject:
          subject ||
          `Invoice from ${brandName} - ${invoice.invoiceNumber || invoice._id}`,
        htmlContent: html,
        textContent: `Please find attached your invoice ${invoice.invoiceNumber || invoice._id}.`,
        replyTo: hasValidCompanyEmail ? registeredCompanyEmail : undefined,
        bcc: shouldBccCompany ? registeredCompanyEmail : undefined,
        companyProfile,
        attachments,
      });

      res.json({ message: "Invoice generated and emailed successfully" });
    } catch (error) {
      console.error(
        "send-bill/invoice error:",
        error?.response?.body || error.message
      );
      res.status(500).json({
        message: "Failed to generate/send invoice",
        error: error?.response?.body || error.message,
      });
    }
  }
);

export default router;

