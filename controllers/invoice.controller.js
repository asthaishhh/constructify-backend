import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import Material from "../models/Material.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const DEFAULT_COMPANY_PROFILE = {
  companyName: "Vrindavan Traders",
  companyTagline: "Building trust, one project at a time",
  logo: "",
  gstIn: "",
  address: "Ahmedabad, Gujarat",
  phone: "+91 98765 43210",
  email: "vrindavantraders@email.com",
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeCompanyProfile = (profile = {}) => {
  const normalized = {
    ...DEFAULT_COMPANY_PROFILE,
    ...(profile && typeof profile === "object" ? profile : {}),
  };

  return {
    companyName: String(normalized.companyName || "").trim(),
    companyTagline: String(normalized.companyTagline || "").trim(),
    logo: String(normalized.logo || "").trim(),
    gstIn: String(normalized.gstIn || "").trim(),
    address: String(normalized.address || "").trim(),
    phone: String(normalized.phone || "").trim(),
    email: String(normalized.email || "").trim(),
  };
};

const splitCompanyName = (name) => {
  const safeName = String(name || "").trim();
  if (!safeName) return { primary: "", secondary: "" };
  const [first, ...rest] = safeName.split(/\s+/);
  return {
    primary: first,
    secondary: rest.length ? ` ${rest.join(" ")}` : "",
  };
};

const buildLogoBlock = (logo) => {
  const safeLogo = String(logo || "").trim();
  if (!safeLogo) {
    return `<div class="logo-slot">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f4c5c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
      <span>Logo</span>
    </div>`;
  }

  return `<div class="logo-slot"><img src="${escapeHtml(safeLogo)}" alt="Company logo" class="logo-image" /></div>`;
};

// Helper to detect whether MongoDB server supports transactions
const serverSupportsTransactions = async () => {
  try {
    const adminInfo = await mongoose.connection.db.admin().command({ ismaster: 1 });
    return Boolean(adminInfo.setName || adminInfo.msg === "isdbgrid");
  } catch (e) {
    return false;
  }
};

/**
 * Compute invoice amount from line items
 */
const computeAmount = (materials = []) =>
  materials.reduce((sum, item) => {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    return sum + qty * rate;
  }, 0);

/**
 * POST /api/invoices
 * Creates invoice + deducts inventory atomically (transaction)
 */
export const createInvoice = async (req, res) => {
  let session;
  let usingTransaction = false;

  try {
    const supports = await serverSupportsTransactions();
    if (supports) {
      session = await mongoose.startSession();
      session.startTransaction();
      usingTransaction = true;
    } else {
      usingTransaction = false;
    }

    const { customerId, customer, status, materials, date } = req.body;

    const customerRef = customerId || customer;
    if (!customerRef) {
      await session.abortTransaction();
      return res.status(400).json({ message: "customerId/customer is required" });
    }

    if (!Array.isArray(materials) || materials.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "materials must be a non-empty array" });
    }

    // 1) Validate + stock check
    const matchedMaterials = [];
    for (const item of materials) {
      const name = String(item.name || "").trim();
      const qtyNeeded = Number(item.quantity);
      const itemRate = Number(item.rate);

      if (!name || !Number.isFinite(qtyNeeded) || qtyNeeded <= 0) {
        if (usingTransaction && session) await session.abortTransaction();
        return res.status(400).json({ message: "Each item needs valid name and quantity" });
      }

      const query = Material.findOne({ name: new RegExp(`^${name}$`, "i") });
      if (usingTransaction && session) query.session(session);
      const dbMat = await query;

      if (!dbMat) {
        if (usingTransaction && session) await session.abortTransaction();
        return res.status(404).json({ message: `Material not found: ${name}` });
      }

      if (dbMat.quantity < qtyNeeded) {
        if (usingTransaction && session) await session.abortTransaction();
        return res.status(400).json({
          message: `Insufficient stock for ${dbMat.name}. Available: ${dbMat.quantity}, required: ${qtyNeeded}`,
        });
      }

      // ensure we have a rate (fallback to material price if available)
      const rate = Number.isFinite(itemRate) ? itemRate : Number(dbMat.rate || 0);
      matchedMaterials.push({ dbMat, qtyNeeded, rate });
    }

    // 2) Deduct stock (use matchedMaterials order)
    for (const m of matchedMaterials) {
      const upd = Material.updateOne({ _id: m.dbMat._id }, { $inc: { quantity: -m.qtyNeeded } });
      if (usingTransaction && session) await upd.session(session);
      else await upd;
    }

    // 3) Save invoice
    // 3) Save invoice
    const amount = computeAmount(materials);

    // Prepare invoice materials in schema format ({ material: ObjectId, quantity, rate })
    const invoiceMaterials = matchedMaterials.map((m) => ({
      material: m.dbMat._id,
      quantity: m.qtyNeeded,
      rate: m.rate,
    }));

    const invoiceNumber = `INV-${Date.now()}`;

    const createOpts = usingTransaction && session ? { session } : undefined;
    const [created] = await Invoice.create(
      [
        {
          invoiceNumber,
          customer: customerRef,
          status: status || "pending",
          materials: invoiceMaterials,
          amount,
          date: date || new Date(),
        },
      ],
      createOpts
    );

    if (usingTransaction && session) await session.commitTransaction();

    const populated = await Invoice.findById(created._id)
      .populate("customer")
      .populate("materials.material");
    return res.status(201).json(populated);
  } catch (err) {
    if (usingTransaction && session) await session.abortTransaction();
    console.error("createInvoice error:", err);
    return res.status(500).json({ message: "Failed to create invoice", error: err.message });
  } finally {
    if (session) session.endSession();
  }
};

/**
 * GET /api/invoices
 */
export const getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 }).populate("customer").populate("materials.material");
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch invoices", error: err.message });
  }
};

/**
 * PUT /api/invoices/:id
 * Safe update (status/date/customer only).
 * If you want material-editing later, we’ll implement stock re-adjustment properly.
 */
export const updateInvoice = async (req, res) => {
  try {
    const { status, date, customerId, customer } = req.body;

    const payload = {
      ...(status ? { status } : {}),
      ...(date ? { date } : {}),
      ...(customerId || customer ? { customer: customerId || customer } : {}),
    };

    const updated = await Invoice.findByIdAndUpdate(req.params.id, payload, {
      new: true,
    }).populate("customer").populate("materials.material");

    if (!updated) return res.status(404).json({ message: "Invoice not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Failed to update invoice", error: err.message });
  }
};

/**
 * DELETE /api/invoices/:id
 * Restores stock before deleting invoice (transaction)
 */
export const deleteInvoice = async (req, res) => {
  let session;
  let usingTransaction = false;

  try {
    const supports = await serverSupportsTransactions();
    if (supports) {
      session = await mongoose.startSession();
      session.startTransaction();
      usingTransaction = true;
    } else {
      usingTransaction = false;
    }

    const invoiceQuery = Invoice.findById(req.params.id);
    if (usingTransaction && session) invoiceQuery.session(session);
    const invoice = await invoiceQuery;
    if (!invoice) {
      if (usingTransaction && session) await session.abortTransaction();
      return res.status(404).json({ message: "Invoice not found" });
    }

    // restore stock
    for (const item of invoice.materials || []) {
      const name = String(item.name || "").trim();
      const qty = Number(item.quantity || 0);

      if (name && qty > 0) {
        const upd = Material.updateOne({ name: new RegExp(`^${name}$`, "i") }, { $inc: { quantity: qty } });
        if (usingTransaction && session) await upd.session(session);
        else await upd;
      }
    }

    if (usingTransaction && session) await Invoice.deleteOne({ _id: invoice._id }).session(session);
    else await Invoice.deleteOne({ _id: invoice._id });

    if (usingTransaction && session) await session.commitTransaction();
    res.json({ message: "Invoice deleted and stock restored" });
  } catch (err) {
    if (usingTransaction && session) await session.abortTransaction();
    res.status(400).json({ message: "Failed to delete invoice", error: err.message });
  } finally {
    if (session) session.endSession();
  }
};

// GET /api/invoices/:id/pdf
export const generateInvoicePdf = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const companyProfile = req.body?.companyProfile || {};
    const { pdfBuffer, invoice } = await generateInvoicePdfBuffer(invoiceId, companyProfile);
    if (!pdfBuffer) return res.status(500).json({ message: 'Failed to generate PDF' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice_${invoice.invoiceNumber || invoice._id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('generateInvoicePdf error:', err);
    return res.status(500).json({ message: 'Failed to generate PDF', error: err.message });
  }
};

export const generateInvoicePdfBuffer = async (invoiceId, rawCompanyProfile = {}) => {
  // returns { pdfBuffer: Buffer, invoice }
  const invoice = await Invoice.findById(invoiceId).populate("customer").populate("materials.material");
  if (!invoice) return { pdfBuffer: null, invoice: null };

  // Resolve template path relative to this file to avoid relying on process.cwd()
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const tplPath = path.resolve(__dirname, "..", "templates", "invoice-template.html");
  let tpl = fs.readFileSync(tplPath, "utf8");

  const clientName = invoice.client || (invoice.customer && invoice.customer.name) || "";
  const clientAddress = invoice.clientAddress || (invoice.customer && invoice.customer.address) || "";
  const clientEmail = invoice.clientEmail || (invoice.customer && invoice.customer.email) || "";
  const clientPhone = invoice.clientPhone || (invoice.customer && invoice.customer.phone) || "";
  const clientGstin =
    invoice.clientGstin ||
    (invoice.customer && (invoice.customer.gstNumber || invoice.customer.gstIn || invoice.customer.gstin)) ||
    "";

  const itemsHtml = (invoice.materials || []).map((it, i) => {
    const name = it.name || (it.material && (it.material.name || it.material.materialName)) || "—";
    const qty = it.quantity || 0;
    const rate = Number(it.rate || 0).toFixed(2);
    const amount = (qty * Number(it.rate || 0)).toFixed(2);
    return `<tr><td style="padding:12px">${i+1}</td><td style="padding:12px">${name}</td><td style="padding:12px">${qty}</td><td style="padding:12px">₹${rate}</td><td style="padding:12px">₹${amount}</td></tr>`;
  }).join("\n");

  const subtotal = invoice.amount || (invoice.materials || []).reduce((s, it) => s + (Number(it.quantity||0) * Number(it.rate||0)), 0);
  const gst = +(subtotal * 0.18).toFixed(2);
  const total = +(subtotal + gst).toFixed(2);

  // Compute CGST and SGST as halves of GST (common Indian split)
  const cgst = +(gst / 2).toFixed(2);
  const sgst = +(gst / 2).toFixed(2);

  // Convert amount to words (Rupees and Paise)
  const numberToWords = (function () {
    const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const b = ['','', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    function inWords(num) {
      if ((num = num.toString()).length > 9) return 'Amount too large';
      const n = ('000000000' + num).substr(-9).match(/(\d{2})(\d{2})(\d{3})(\d{2})/);
      if (!n) return; 
      let str = '';
      str += (n[1] != 0) ? (a[Number(n[1])] || (b[n[1][0]] + (n[1][1] != '0' ? ' ' + a[n[1][1]] : ''))) + ' Crore ' : '';
      str += (n[2] != 0) ? (a[Number(n[2])] || (b[n[2][0]] + (n[2][1] != '0' ? ' ' + a[n[2][1]] : ''))) + ' Lakh ' : '';
      str += (n[3] != 0) ? (function(num){
        const hundreds = Math.floor(num/100);
        const rem = num % 100;
        let out = '';
        if (hundreds) out += a[hundreds] + ' Hundred ';
        if (rem) out += (rem < 20) ? a[rem] : (b[Math.floor(rem/10)] + (rem%10 ? ' ' + a[rem%10] : ''));
        return out + ' '; })(Number(n[3])) : '';
      str += (n[4] != 0) ? ((a[Number(n[4])] || (b[n[4][0]] + (n[4][1] != '0' ? ' ' + a[n[4][1]] : '')))) + ' ' : '';
      return str.trim();
    }
    return function(amount){
      const rupees = Math.floor(amount);
      const paise = Math.round((amount - rupees) * 100);
      let words = '';
      if (rupees === 0) words = 'Zero Rupees';
      else words = inWords(rupees) + ' Rupees';
      if (paise > 0) words += ' and ' + inWords(paise) + ' Paise';
      words += ' Only';
      return words;
    };
  })();

  const amountInWords = numberToWords(total);

  const formattedDate = (invoice.date || invoice.createdAt) ? new Date(invoice.date || invoice.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: '2-digit', month: 'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12: false }) : "";
  const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);
  const formattedDue = dueDate.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: '2-digit', month: 'short', year:'numeric' });

  const companyProfile = normalizeCompanyProfile(rawCompanyProfile);
  const { primary: companyNamePrimary, secondary: companyNameSecondary } = splitCompanyName(companyProfile.companyName);

  tpl = tpl.replace(/{{invoiceNumber}}/g, invoice.invoiceNumber || "");
  tpl = tpl.replace(/{{dateIssued}}/g, formattedDate);
  tpl = tpl.replace(/{{dueDate}}/g, formattedDue);
  tpl = tpl.replace(/{{clientName}}/g, clientName);
  tpl = tpl.replace(/{{clientAddress}}/g, clientAddress.replace(/\n/g, ", "));
  tpl = tpl.replace(/{{clientEmail}}/g, clientEmail || "");
  tpl = tpl.replace(/{{clientPhone}}/g, clientPhone || "");
  tpl = tpl.replace(/{{clientGstin}}/g, escapeHtml(clientGstin));
  tpl = tpl.replace(/{{status}}/g, (invoice.status || "pending").toUpperCase());
  tpl = tpl.replace(/{{amount}}/g, Number(total).toLocaleString("en-IN", { minimumFractionDigits: 2 }));
  tpl = tpl.replace(/{{items}}/g, itemsHtml);
  tpl = tpl.replace(/{{subtotal}}/g, Number(subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 }));
  tpl = tpl.replace(/{{gst}}/g, Number(gst).toLocaleString("en-IN", { minimumFractionDigits: 2 }));
  tpl = tpl.replace(/{{total}}/g, Number(total).toLocaleString("en-IN", { minimumFractionDigits: 2 }));
  tpl = tpl.replace(/{{cgst}}/g, Number(cgst).toLocaleString("en-IN", { minimumFractionDigits: 2 }));
  tpl = tpl.replace(/{{sgst}}/g, Number(sgst).toLocaleString("en-IN", { minimumFractionDigits: 2 }));
  tpl = tpl.replace(/{{amountInWords}}/g, amountInWords);
  tpl = tpl.replace(/{{companyLogoBlock}}/g, buildLogoBlock(companyProfile.logo));
  tpl = tpl.replace(/{{companyName}}/g, escapeHtml(companyProfile.companyName));
  tpl = tpl.replace(/{{companyNamePrimary}}/g, escapeHtml(companyNamePrimary));
  tpl = tpl.replace(/{{companyNameSecondary}}/g, escapeHtml(companyNameSecondary));
  tpl = tpl.replace(/{{companyTagline}}/g, escapeHtml(companyProfile.companyTagline));
  tpl = tpl.replace(/{{companyAddress}}/g, escapeHtml(companyProfile.address).replace(/\n/g, "<br>"));
  tpl = tpl.replace(/{{companyEmail}}/g, escapeHtml(companyProfile.email));
  tpl = tpl.replace(/{{companyPhone}}/g, escapeHtml(companyProfile.phone));
  tpl = tpl.replace(/{{companyGstin}}/g, escapeHtml(companyProfile.gstIn));

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(tpl, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
  await browser.close();

  return { pdfBuffer, invoice };
};