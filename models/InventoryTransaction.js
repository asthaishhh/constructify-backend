import mongoose from "mongoose";

const inventoryTransactionSchema = new mongoose.Schema(
{
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true,
  },

  material: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Material",
    required: true
  },

  type: {
    type: String,
    enum: ["IN", "OUT"],
    required: true
  },

  quantity: {
    type: Number,
    required: true
  },

  reason: {
    type: String,
    enum: ["purchase", "order", "adjustment", "damage"],
    required: true
  },

  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  },

  notes: {
    type: String
  }

},
{ timestamps: true }
);

export default mongoose.model("InventoryTransaction", inventoryTransactionSchema);