import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
{
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true,
  },

  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true
  },

  sourceOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    default: null,
  },

  status: {
    type: String,
    enum: ["pending", "paid", "completed"],
    default: "pending"
  },

  materials: [
    {
      material: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Material",
        required: true
      },
      quantity: {
        type: Number,
        required: true
      },
      rate: {
        type: Number,
        required: true
      }
    }
  ],

  amount: {
    type: Number,
    required: true
  },

  date: {
    type: Date,
    default: Date.now
  }

},
{ timestamps: true }
);

// Prevent OverwriteModelError
export default mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);