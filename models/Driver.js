import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
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
      trim: true,
    },
    licenseNo: {
      type: String,
      required: true,
      trim: true,
    },
    experience: {
      type: Number,
      default: 0,
      min: 0,
    },
    contact: {
      type: String,
      required: true,
      trim: true,
    },
    assignedVehicle: {
      type: String,
      trim: true,
      default: "",
    },
    route: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["Active", "On Route", "Inactive"],
      default: "Active",
    },
  },
  { timestamps: true }
);

driverSchema.index({ companyId: 1, licenseNo: 1 }, { unique: true });

export default mongoose.models.Driver || mongoose.model("Driver", driverSchema);