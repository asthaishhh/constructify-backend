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
  role: { type: String },
  designation: { type: String },
  experience: { type: Number, default: 0, min: 0 },
  shift: {
    type: String,
    enum: ["Day", "Night", ""],
    default: "",
  },
  contact: { type: String, required: true },
  salary: { type: Number, default: 0, min: 0 },
  photo: { type: String, default: "" },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active"
  }
},
{ timestamps: true }
);

employeeSchema.pre("validate", function syncRoleAndDesignation(next) {
  if (!this.role && this.designation) {
    this.role = this.designation;
  }
  if (!this.designation && this.role) {
    this.designation = this.role;
  }
  if (!this.role && !this.designation) {
    this.invalidate("role", "Role is required");
  }
  next();
});

employeeSchema.index({ companyId: 1, contact: 1 });

export default mongoose.model("Employee", employeeSchema);