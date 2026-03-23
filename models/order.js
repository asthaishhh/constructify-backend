import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["mine", "customers"],
      default: "mine",
    },

    client: {
      type: String,
      required: true,
      trim: true,
    },

    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      default: null,
    },

    materialName: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    unit: {
      type: String,
      default: "",
    },

    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    sellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    profitPerUnit: {
      type: Number,
      default: 0,
      min: 0,
    },

    profit: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["open", "processing", "executed", "completed", "cancelled", "pending", "received"],
      default: "open",
    },

    inventoryRefilled: {
      type: Boolean,
      default: false,
    },

    orderDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

orderSchema.index({ companyId: 1, id: 1 }, { unique: true });

const Order = mongoose.model("Order", orderSchema);

export default Order;