import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    vehicleNo: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["Available", "On Route", "Maintenance", "Inactive", "Standby"],
      default: "Available",
    },
    fuelLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    lastMaintenance: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

vehicleSchema.index({ companyId: 1, vehicleNo: 1 }, { unique: true });

export default mongoose.models.Vehicle || mongoose.model("Vehicle", vehicleSchema);
