import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
{
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true,
  },

  name: { type: String, required: true },
  role: { type: String, required: true },
  contact: { type: String, required: true },
  salary: { type: Number },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active"
  }
},
{ timestamps: true }
);

employeeSchema.index({ companyId: 1, contact: 1 });

export default mongoose.model("Employee", employeeSchema);