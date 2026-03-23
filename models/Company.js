import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    name: { 
      type: String, 
      required: true,
      trim: true
    },

    phone: { 
      type: String, 
      required: true
    },

    email: { 
      type: String,
      trim: true,
      lowercase: true
    },

    address: { 
      type: String,
      trim: true
    },

    gstNumber: { 
      type: String 
    },

    companyName: { 
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

CustomerSchema.index({ companyId: 1, phone: 1 }, { unique: true });
CustomerSchema.index({ companyId: 1, email: 1 });

export default mongoose.models.Customer || mongoose.model("Customer", CustomerSchema);