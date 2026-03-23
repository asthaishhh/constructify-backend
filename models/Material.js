import mongoose from "mongoose";

const materialSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true,
  },

  name: {
    type: String,
    required: true,
    trim: true,
    enum: ["sand", "cement", "iron rods", "bricks"]
  },

  quantity: {
    type: Number,
    required: true,
    min: 0
  },

  unit: {
    type: String,
    required: true,
    enum: ["kg", "ton", "bags", "pieces", "m3"]
  },

  category: {
    type: String,
    required: true,
    index: true
  },

  price: {
    type: Number,
    min: 0
  },

  supplier: {
    type: String,
    trim: true
  },

  location: {
    type: String,
    default: "Main Warehouse"
  },

  minStock: {
    type: Number,
    default: function () {
      const name = String(this?.name || "").trim().toLowerCase();
      const defaults = {
        cement: 100,
        bricks: 1000,
        "iron rods": 100,
        sand: 1000,
      };
      return Number(defaults[name] ?? 0);
    }
  },
   reorderQuantity: {   // NEW FIELD
    type: Number,
    default: 0
  }

}, { timestamps: true });

materialSchema.index({ companyId: 1, name: 1 }, { unique: true });

const Material = mongoose.model("Material", materialSchema);
export default Material;