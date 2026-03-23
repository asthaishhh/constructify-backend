import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: ".env" });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is missing in .env");
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(uri);

  const collection = mongoose.connection.db.collection("materials");
  const indexes = await collection.indexes();
  const indexNames = indexes.map((idx) => idx.name);

  if (indexNames.includes("name_1")) {
    await collection.dropIndex("name_1");
    console.log("Dropped stale index: name_1");
  } else {
    console.log("No stale index found: name_1");
  }

  const hasCompanyNameUnique = indexes.some(
    (idx) => idx.name === "companyId_1_name_1" && idx.unique === true
  );

  if (!hasCompanyNameUnique) {
    await collection.createIndex({ companyId: 1, name: 1 }, { unique: true });
    console.log("Created unique index: companyId_1_name_1");
  } else {
    console.log("Unique index already present: companyId_1_name_1");
  }

  await mongoose.disconnect();
  console.log("Material index repair complete.");
};

run().catch(async (err) => {
  console.error("Failed to repair material indexes:", err.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors in failure path
  }
  process.exit(1);
});
