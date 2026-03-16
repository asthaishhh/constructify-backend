import mongoose from "mongoose";

const materialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
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
    required: true,
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
    default: 0
  },
   reorderQuantity: {   // NEW FIELD
    type: Number,
    default: 0
  }

}, { timestamps: true });

const Material = mongoose.model("Material", materialSchema);
export default Material;