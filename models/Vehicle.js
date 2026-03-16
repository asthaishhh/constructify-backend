import mongoose from "mongoose";

const VehicleSchema = new mongoose.Schema(
  {
    vehicleNo: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    type: {
      type: String,
      required: true
    },

    capacity: {
      type: Number, // in kg
      required: true
    },

    status: {
      type: String,
      enum: ["Available", "On Route", "Maintenance", "Inactive", "Standby"],
      default: "Available"
    },

    fuelLevel: {
      type: Number,
      min: 0,
      max: 100
    },

    lastMaintenance: {
      type: Date
    }
  },
  { timestamps: true }
);

export default mongoose.models.Vehicle || mongoose.model("Vehicle", VehicleSchema);