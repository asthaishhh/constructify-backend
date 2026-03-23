import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import Company from "../models/Company.js";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import Material from "../models/Material.js";
import Order from "../models/order.js";
import Invoice from "../models/Invoice.js";
import Employee from "../models/Employee.js";
import InventoryTransaction from "../models/InventoryTransaction.js";

const TARGET_EMAIL = "asthaishhh@gmail.com";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const slugify = (value = "") =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const missingCompanyFilter = {
  $or: [{ companyId: { $exists: false } }, { companyId: null }],
};

const findOrCreateCompany = async () => {
  const normalizedEmail = TARGET_EMAIL.toLowerCase().trim();

  let company = await Company.findOne({ email: normalizedEmail });
  if (company) return company;

  const adminUser = await User.findOne({ email: normalizedEmail }).select("name");
  const baseName = adminUser?.name?.trim() || "Astha Company";
  const baseSlug = slugify(baseName) || "astha-company";

  let slug = baseSlug;
  let n = 1;
  while (await Company.findOne({ slug })) {
    slug = `${baseSlug}-${n}`;
    n += 1;
  }

  company = await Company.create({
    name: baseName,
    ownerName: adminUser?.name?.trim() || "Owner",
    slug,
    email: normalizedEmail,
    isActive: true,
  });

  return company;
};

const run = async () => {
  dotenv.config({ path: path.join(__dirname, "..", ".env") });

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI not set in backend/.env");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const company = await findOrCreateCompany();
    const companyId = company._id;

    console.log(`[backfill] Using company: ${company.name} (${company.email}) -> ${companyId}`);

    const updates = await Promise.all([
      User.updateMany(missingCompanyFilter, { $set: { companyId } }),
      Customer.updateMany(missingCompanyFilter, { $set: { companyId } }),
      Material.updateMany(missingCompanyFilter, { $set: { companyId } }),
      Order.updateMany(missingCompanyFilter, { $set: { companyId } }),
      Invoice.updateMany(missingCompanyFilter, { $set: { companyId } }),
      Employee.updateMany(missingCompanyFilter, { $set: { companyId } }),
      InventoryTransaction.updateMany(missingCompanyFilter, { $set: { companyId } }),
    ]);

    const labels = [
      "users",
      "customers",
      "materials",
      "orders",
      "invoices",
      "employees",
      "inventoryTransactions",
    ];

    labels.forEach((label, i) => {
      const result = updates[i];
      console.log(`[backfill] ${label}: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
    });

    console.log("[backfill] Done.");
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((err) => {
  console.error("[backfill] Failed:", err.message);
  process.exit(1);
});
