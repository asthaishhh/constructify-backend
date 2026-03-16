import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
{
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

export default mongoose.model("Employee", employeeSchema);