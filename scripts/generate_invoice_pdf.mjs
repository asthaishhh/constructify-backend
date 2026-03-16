import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

dotenv.config();

const invoiceIdArg = process.argv[2];
if (!invoiceIdArg) {
  console.error('Usage: node generate_invoice_pdf.mjs <invoiceId>');
  process.exit(2);
}

const invoiceId = invoiceIdArg;

// Import the helper after env is loaded
import('../controllers/invoice.controller.js').then(async (mod) => {
  const { generateInvoicePdfBuffer } = mod;
  const Invoice = (await import('../models/Invoice.js')).default;
  // Ensure related models are registered for populate()
  await import('../models/Customer.js');
  await import('../models/Material.js');

  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGO_URI or MONGODB_URI is not set in environment. Please set it in .env');
      process.exit(3);
    }

    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    // Allow passing invoice number (INV-...) OR ObjectId
    let targetId = invoiceId;
    if (String(invoiceId).startsWith('INV-')) {
      const found = await Invoice.findOne({ invoiceNumber: invoiceId });
      if (!found) {
        console.error('Invoice with invoiceNumber', invoiceId, 'not found');
        process.exit(5);
      }
      targetId = found._id.toString();
    }

    const { pdfBuffer, invoice } = await generateInvoicePdfBuffer(targetId);
    if (!pdfBuffer) {
      console.error('No PDF buffer returned — invoice may not exist');
      process.exit(4);
    }

    const outDir = path.resolve(process.cwd(), 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const filename = `invoice_${invoice.invoiceNumber || invoice._id}.pdf`;
    const outPath = path.join(outDir, filename);
    fs.writeFileSync(outPath, pdfBuffer);
    console.log('Written PDF to', outPath);
  } catch (err) {
    console.error('Error generating PDF:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
});
