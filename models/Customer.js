import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      trim: true
    },

    phone: { 
      type: String, 
      required: true,
      unique: true
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

export default mongoose.models.Customer || mongoose.model("Customer", CustomerSchema);