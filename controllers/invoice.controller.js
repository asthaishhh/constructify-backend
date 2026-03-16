import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import Material from "../models/Material.js";
import PDFDocument from "pdfkit";
import Counter from "../models/Counter.js";
import SVGtoPDF from "svg-to-pdfkit";
import fs from "fs";
import path from "path";

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

const INVOICE_COUNTER_ID = "invoice";
const INVOICE_NUMBER_PREFIX = "INV-";
const INVOICE_SEQUENCE_PAD = 6;
const INVOICE_SEQUENCE_REGEX = new RegExp(`^${INVOICE_NUMBER_PREFIX}\\d{${INVOICE_SEQUENCE_PAD}}$`);

const formatInvoiceNumber = (sequence) =>
  `${INVOICE_NUMBER_PREFIX}${String(sequence).padStart(INVOICE_SEQUENCE_PAD, "0")}`;

const getHighestExistingInvoiceSequence = async (session) => {
  const latestInvoiceQuery = Invoice.findOne({
    invoiceNumber: { $regex: INVOICE_SEQUENCE_REGEX },
  })
    .sort({ invoiceNumber: -1 })
    .select("invoiceNumber");

  if (session) {
    latestInvoiceQuery.session(session);
  }

  const latestInvoice = await latestInvoiceQuery;
  if (!latestInvoice?.invoiceNumber) {
    return 0;
  }

  const numericPart = Number(latestInvoice.invoiceNumber.replace(INVOICE_NUMBER_PREFIX, ""));
  return Number.isFinite(numericPart) ? numericPart : 0;
};

const getNextInvoiceNumber = async (session) => {
  const existingCounterQuery = Counter.findById(INVOICE_COUNTER_ID);
  if (session) {
    existingCounterQuery.session(session);
  }

  const existingCounter = await existingCounterQuery;
  if (!existingCounter) {
    const highestExistingSequence = await getHighestExistingInvoiceSequence(session);
    try {
      const counterSeed = new Counter({
        _id: INVOICE_COUNTER_ID,
        seq: highestExistingSequence,
      });
      await counterSeed.save(session ? { session } : undefined);
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }
  }

  const counterOptions = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  };

  if (session) {
    counterOptions.session = session;
  }

  const counter = await Counter.findOneAndUpdate(
    { _id: INVOICE_COUNTER_ID },
    { $inc: { seq: 1 } },
    counterOptions
  );

  return formatInvoiceNumber(counter.seq);
};

const resolveLogoAsset = async (rawLogo) => {
  const logo = String(rawLogo || "").trim();
  if (!logo) return null;

  // Data URL logo: supports optional parameters and both base64 + URL-encoded payloads.
  const dataUrlMatch = logo.match(/^data:(image\/[a-zA-Z0-9.+-]+)(?:;[^,]*)?,(.*)$/s);
  if (dataUrlMatch) {
    const mimeType = String(dataUrlMatch[1] || "").toLowerCase();
    const payload = dataUrlMatch[2] || "";
    const isBase64 = /;base64,/i.test(logo);
    try {
      if (mimeType.includes("svg")) {
        const svgText = isBase64
          ? Buffer.from(payload, "base64").toString("utf8")
          : decodeURIComponent(payload);
        return { type: "svg", svgText };
      }

      const buffer = isBase64
        ? Buffer.from(payload, "base64")
        : Buffer.from(decodeURIComponent(payload), "binary");
      return { type: "image", buffer };
    } catch (_error) {
      return null;
    }
  }

  // Remote logo URL
  if (/^https?:\/\//i.test(logo)) {
    try {
      const response = await fetch(logo);
      if (!response.ok) return null;
      const bytes = await response.arrayBuffer();
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("svg")) {
        return { type: "svg", svgText: Buffer.from(bytes).toString("utf8") };
      }
      return { type: "image", buffer: Buffer.from(bytes) };
    } catch (_error) {
      return null;
    }
  }

  // Local file logo path (absolute or project-relative)
  const normalizedRelative = logo.replace(/^\/+/, "");
  const candidatePaths = [
    logo,
    path.resolve(process.cwd(), normalizedRelative),
    path.resolve(process.cwd(), "public", normalizedRelative),
    path.resolve(process.cwd(), "..", "frontend", "public", normalizedRelative),
  ];

  for (const candidatePath of candidatePaths) {
    try {
      if (fs.existsSync(candidatePath)) {
        const fileBuffer = fs.readFileSync(candidatePath);
        const ext = path.extname(candidatePath).toLowerCase();
        if (ext === ".svg") {
          return { type: "svg", svgText: fileBuffer.toString("utf8") };
        }
        return { type: "image", buffer: fileBuffer };
      }
    } catch (_error) {
      // Continue trying remaining candidate paths.
    }
  }

  return null;
};

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

    const invoiceNumber = await getNextInvoiceNumber(session);

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

  const clientName = invoice.client || (invoice.customer && invoice.customer.name) || "";
  const clientAddress = invoice.clientAddress || (invoice.customer && invoice.customer.address) || "";
  const clientEmail = invoice.clientEmail || (invoice.customer && invoice.customer.email) || "";
  const clientPhone = invoice.clientPhone || (invoice.customer && invoice.customer.phone) || "";
  const clientGstin =
    invoice.clientGstin ||
    (invoice.customer && (invoice.customer.gstNumber || invoice.customer.gstIn || invoice.customer.gstin)) ||
    "";

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
  const logoAsset = await resolveLogoAsset(companyProfile.logo);

  // Generate PDF with PDFKit
  const pdfBuffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const M  = 40;              // page margin
    const CW = PAGE_W - 2 * M; // content width = 515.28

    // Colour palette
    const TEAL    = '#0f4c5c';
    const SAFFRON = '#d6781e';
    const MUTED   = '#6b7280';
    const INK     = '#1a1a2e';
    const RULE    = '#e5e7eb';
    const TEAL_LT = '#e8f4f7';
    const SF_LT   = '#fff4eb';
    const WHITE   = '#ffffff';

    // ── Top accent bar ──
    doc.rect(0, 0, PAGE_W, 5).fill(TEAL);

    let y = 18;

     // ── HEADER ──
     let brandX = M;
     const headerTopY = y;
     const headerGap = 18;
     const leftW = 300;
     const rightW = CW - leftW - headerGap;
     const rightX = M + leftW + headerGap;

     // Optional logo image (supports data URL, remote URL, and local path)
     if (logoAsset) {
      try {
        if (logoAsset.type === 'svg') {
          SVGtoPDF(doc, logoAsset.svgText, M, y, { width: 48, height: 48, preserveAspectRatio: 'xMidYMid meet' });
        } else {
          doc.image(logoAsset.buffer, M, y, { fit: [48, 48], align: 'center', valign: 'center' });
        }
        brandX = M + 58;
      } catch (_error) {
        // Skip invalid logo content and render invoice without logo.
      }
     }

     const leftTextW = Math.max(180, leftW - (brandX - M));
     let leftCursorY = headerTopY;

     // Company name: primary in teal, secondary in saffron
     doc.fontSize(22).font('Helvetica-Bold').fillColor(TEAL)
       .text(companyNamePrimary, brandX, leftCursorY, { continued: !!companyNameSecondary, lineBreak: !companyNameSecondary, width: leftTextW });
     if (companyNameSecondary) {
      doc.fillColor(SAFFRON).text(companyNameSecondary, { lineBreak: true });
     }
     leftCursorY = doc.y + 4;

     // Tagline
     const tagline = (companyProfile.companyTagline || '').toUpperCase();
     if (tagline) {
      doc.fontSize(7.5).font('Helvetica').fillColor(MUTED)
        .text(tagline, brandX, leftCursorY, { width: leftTextW });
      leftCursorY = doc.y + 6;
     }

     // Address & contact
     if (companyProfile.address) {
      doc.fontSize(9).font('Helvetica').fillColor(MUTED)
        .text(companyProfile.address, brandX, leftCursorY, { width: leftTextW, lineGap: 2 });
      leftCursorY = doc.y + 4;
     }

     const contactLine = [companyProfile.email, companyProfile.phone].filter(Boolean).join('  .  ');
     if (contactLine) {
      doc.fontSize(9).font('Helvetica').fillColor(MUTED)
        .text(contactLine, brandX, leftCursorY, { width: leftTextW, lineGap: 2 });
      leftCursorY = doc.y + 6;
     }

     // Company GSTIN badge
     if (companyProfile.gstIn) {
      const gstLabel = 'GSTIN';
      const gstValue = String(companyProfile.gstIn);
      doc.fontSize(7.5).font('Helvetica-Bold');
      const gstLabelW = doc.widthOfString(gstLabel);
      doc.fontSize(9).font('Helvetica');
      const gstValueW = doc.widthOfString(gstValue);
      const gstBadgeW = Math.min(leftTextW, Math.max(120, gstLabelW + gstValueW + 26));
      const gy = leftCursorY;
      doc.roundedRect(brandX, gy, gstBadgeW, 18, 4).fillAndStroke(TEAL_LT, '#c5dfe7');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(TEAL)
        .text(gstLabel, brandX + 8, gy + 5, { lineBreak: false });
      doc.fontSize(9).font('Helvetica')
        .text(gstValue, brandX + 8 + gstLabelW + 8, gy + 4.5, { width: gstBadgeW - gstLabelW - 20, lineBreak: false });
      leftCursorY = gy + 24;
     }

     // INVOICE word (top-right)
     doc.fontSize(34).font('Helvetica-Bold').fillColor(TEAL)
       .text('Invoice', rightX, headerTopY, { width: rightW, align: 'right' });

     // Invoice meta rows
     const metaStartY = headerTopY + 48;
     const metaLabelW = 74;
     const metaValueW = rightW - metaLabelW - 10;
     let rightCursorY = metaStartY;
     [
      ['Invoice No:', invoice.invoiceNumber || ''],
      ['Date Issued:', formattedDate],
      ['Due Date:', formattedDue],
     ].forEach(([lbl, val]) => {
      doc.fontSize(9).font('Helvetica').fillColor(MUTED)
        .text(lbl, rightX, rightCursorY, { width: metaLabelW, align: 'left', lineBreak: false });
      doc.font('Helvetica-Bold').fillColor(INK)
        .text(val, rightX + metaLabelW + 10, rightCursorY, { width: metaValueW, align: 'right' });
      rightCursorY = doc.y + 6;
     });

     // Divider
     const divY = Math.max(leftCursorY, rightCursorY, headerTopY + 98);
    doc.moveTo(M, divY).lineTo(PAGE_W - M, divY).strokeColor(RULE).lineWidth(0.5).stroke();
    y = divY + 16;

    // ── INFO CARDS ──
    const cardW = (CW - 14) / 2;
    const cardH = 124;
     const cardPadX = 14;
     const cardPadY = 14;

    // Bill To card
    doc.roundedRect(M, y, cardW, cardH, 8).fillAndStroke(WHITE, RULE);
     const billTextW = cardW - (cardPadX * 2);
     let billY = y + cardPadY;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(SAFFRON)
       .text('BILL TO', M + cardPadX, billY - 2, { width: billTextW });
     billY += 12;

    doc.fontSize(12).font('Helvetica-Bold').fillColor(INK)
       .text(clientName || '—', M + cardPadX, billY, { width: billTextW, lineGap: 1 });
     billY = doc.y + 4;

     if (clientAddress) {
      doc.fontSize(9).font('Helvetica').fillColor(MUTED)
        .text(clientAddress.replace(/\n/g, ', '), M + cardPadX, billY, { width: billTextW, lineGap: 1.5 });
      billY = doc.y + 3;
     }

     if (clientEmail) {
      doc.fontSize(9).font('Helvetica').fillColor(MUTED)
        .text(clientEmail, M + cardPadX, billY, { width: billTextW, lineGap: 1.5 });
      billY = doc.y + 2;
     }

     if (clientPhone) {
      doc.fontSize(9).font('Helvetica').fillColor(MUTED)
        .text(clientPhone, M + cardPadX, billY, { width: billTextW, lineGap: 1.5 });
      billY = doc.y + 4;
     }

    if (clientGstin) {
      const gstLabel = 'GSTIN';
      doc.fontSize(7).font('Helvetica-Bold');
      const gstLabelW = doc.widthOfString(gstLabel);
      doc.fontSize(8.5).font('Helvetica');
      const gstValueW = doc.widthOfString(String(clientGstin));
      const gstBadgeW = Math.min(billTextW, Math.max(124, gstLabelW + gstValueW + 20));
      const gstBadgeH = 14;
      const minBottomY = y + cardH - cardPadY - gstBadgeH;
      const cgy = Math.min(minBottomY, billY + 4);
      doc.roundedRect(M + cardPadX, cgy, gstBadgeW, gstBadgeH, 3).fillAndStroke(TEAL_LT, '#c5dfe7');
      doc.fontSize(7).font('Helvetica-Bold').fillColor(TEAL)
        .text('GSTIN', M + cardPadX + 5, cgy + 3.5, { continued: true, lineBreak: false });
      doc.fontSize(8.5).font('Helvetica')
        .text(`  ${clientGstin}`, { lineBreak: true });
    }

    // Invoice Details card
    const c2x = M + cardW + 14;
    doc.roundedRect(c2x, y, cardW, cardH, 8).fillAndStroke(WHITE, RULE);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(SAFFRON)
       .text('INVOICE DETAILS', c2x + cardPadX, y + cardPadY - 2);
     doc.moveTo(c2x + cardPadX, y + cardPadY + 14).lineTo(c2x + cardW - cardPadX, y + cardPadY + 14).strokeColor(RULE).lineWidth(0.3).stroke();
    doc.fontSize(9.5).font('Helvetica').fillColor(MUTED)
       .text('Status', c2x + cardPadX, y + cardPadY + 22, { lineBreak: false });
    doc.font('Helvetica-Bold').fillColor(SAFFRON)
       .text((invoice.status || 'pending').toUpperCase(), c2x, y + cardPadY + 22, { width: cardW - cardPadX, align: 'right', lineBreak: false });
     doc.moveTo(c2x + cardPadX, y + cardPadY + 40).lineTo(c2x + cardW - cardPadX, y + cardPadY + 40).strokeColor(RULE).lineWidth(0.3).stroke();
    doc.fontSize(9.5).font('Helvetica').fillColor(MUTED)
       .text('Due Date', c2x + cardPadX, y + cardPadY + 48, { lineBreak: false });
    doc.font('Helvetica-Bold').fillColor(INK)
       .text(formattedDue, c2x, y + cardPadY + 48, { width: cardW - cardPadX, align: 'right', lineBreak: false });

    y += cardH + 20;

    // ── ITEMS TABLE ──
    const NUM_W  = 30;
    const QTY_W  = 50;
    const RATE_W = 85;
    const AMT_W  = 85;
    const NAM_W  = CW - NUM_W - QTY_W - RATE_W - AMT_W;

    const tX = {
      num:    M,
      name:   M + NUM_W,
      qty:    M + NUM_W + NAM_W,
      rate:   M + NUM_W + NAM_W + QTY_W,
      amount: M + NUM_W + NAM_W + QTY_W + RATE_W,
    };
    const tW = { num: NUM_W, name: NAM_W, qty: QTY_W, rate: RATE_W, amount: AMT_W };

    // Table header
    const TH_H = 28;
    doc.rect(M, y, CW, TH_H).fill(TEAL);
    [
      { txt: '#',            x: tX.num,    w: tW.num,    align: 'left'  },
      { txt: 'Material',     x: tX.name,   w: tW.name,   align: 'left'  },
      { txt: 'Qty',          x: tX.qty,    w: tW.qty,    align: 'right' },
      { txt: 'Rate (Rs.)',   x: tX.rate,   w: tW.rate,   align: 'right' },
      { txt: 'Amount (Rs.)', x: tX.amount, w: tW.amount, align: 'right' },
    ].forEach(col => {
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(WHITE)
         .text(col.txt, col.x + 6, y + 9, { width: col.w - 8, align: col.align, lineBreak: false });
    });
    y += TH_H;

    // Table rows
    const invoiceItems = (invoice.materials || []).map((it, idx) => {
      const name = it.name || (it.material && (it.material.name || it.material.materialName)) || '—';
      const qty  = it.quantity || 0;
      const rate = Number(it.rate || 0);
      return { num: idx + 1, name, qty, rate, amount: qty * rate };
    });

    const ROW_H = 24;
    invoiceItems.forEach((item, i) => {
      if (i % 2 === 1) doc.rect(M, y, CW, ROW_H).fill('#fafafa');
      doc.moveTo(M, y + ROW_H).lineTo(PAGE_W - M, y + ROW_H).strokeColor(RULE).lineWidth(0.3).stroke();
      doc.fontSize(9).font('Helvetica').fillColor(MUTED)
         .text(String(item.num), tX.num + 4, y + 7, { width: tW.num - 6, align: 'left', lineBreak: false });
      doc.fillColor(INK)
         .text(item.name, tX.name + 6, y + 7, { width: tW.name - 8, align: 'left', lineBreak: false });
      doc.text(String(item.qty), tX.qty + 4, y + 7, { width: tW.qty - 6, align: 'right', lineBreak: false });
      doc.text(item.rate.toFixed(2), tX.rate + 4, y + 7, { width: tW.rate - 6, align: 'right', lineBreak: false });
      doc.font('Helvetica-Bold')
         .text(item.amount.toFixed(2), tX.amount + 4, y + 7, { width: tW.amount - 8, align: 'right', lineBreak: false });
      y += ROW_H;
    });

    y += 16;

    // ── AMOUNT IN WORDS ──
    const AW_H = 30;
    doc.roundedRect(M, y, CW, AW_H, 5).fillAndStroke(SF_LT, '#f0d4b0');
    doc.rect(M, y, 3, AW_H).fill(SAFFRON);
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(SAFFRON)
       .text('AMOUNT IN WORDS', M + 10, y + 11, { lineBreak: false });
    doc.fontSize(9).font('Helvetica').fillColor(INK)
       .text(amountInWords, M + 132, y + 11, { width: CW - 142, lineBreak: false });
    y += AW_H + 16;

    // ── TOTALS ──
    const TOTAL_W = 240;
    const totalX  = PAGE_W - M - TOTAL_W;

    [
      ['Subtotal',  Number(subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })],
      ['CGST (9%)', Number(cgst).toLocaleString('en-IN',    { minimumFractionDigits: 2 })],
      ['SGST (9%)', Number(sgst).toLocaleString('en-IN',    { minimumFractionDigits: 2 })],
    ].forEach(([lbl, val]) => {
      doc.fontSize(9.5).font('Helvetica').fillColor(MUTED)
         .text(lbl, totalX + 12, y, { lineBreak: false });
      doc.font('Helvetica-Bold').fillColor(INK)
         .text(`Rs. ${val}`, totalX, y, { width: TOTAL_W - 14, align: 'right', lineBreak: false });
      y += 20;
      doc.moveTo(totalX, y).lineTo(PAGE_W - M, y).strokeColor(RULE).lineWidth(0.3).stroke();
      y += 5;
    });

    y += 8;
    doc.roundedRect(totalX, y, TOTAL_W, 34, 6).fill(TEAL);
    doc.fontSize(9).font('Helvetica').fillColor(WHITE)
       .text('TOTAL DUE', totalX + 12, y + 11, { lineBreak: false });
    doc.fontSize(16).font('Helvetica-Bold').fillColor(WHITE)
       .text(
         `Rs. ${Number(total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
         totalX, y + 9, { width: TOTAL_W - 14, align: 'right', lineBreak: false }
       );
    y += 34 + 20;

    // ── FOOTER ──
    const footerY = Math.max(y + 10, PAGE_H - 58);
    doc.moveTo(M, footerY).lineTo(PAGE_W - M, footerY).strokeColor(RULE).lineWidth(0.5).stroke();
    doc.fontSize(9).font('Helvetica').fillColor(MUTED)
       .text(
         `Payment due within 30 days. For queries contact ${companyProfile.email}`,
         M, footerY + 10, { width: CW, align: 'center', lineBreak: false }
       );
    doc.fontSize(11).font('Helvetica-Bold').fillColor(TEAL)
       .text('Thank you for your business.', M, footerY + 26, { width: CW, align: 'center' });

    doc.end();
  });

  return { pdfBuffer, invoice };
};