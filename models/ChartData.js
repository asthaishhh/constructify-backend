// import mongoose from "mongoose";

// const ChartPointSchema = new mongoose.Schema({
//   label: { type: String, required: true },
//   value: { type: Number, required: true }
// });

// const ChartDataSchema = new mongoose.Schema({
//   type: {
//     type: String,
//     enum: ["revenue", "sales", "inventory", "orders"],
//     required: true,
//     index: true
//   },
//   period: {
//     type: String,
//     enum: ["daily", "weekly", "monthly", "yearly"]
//   },
//   data: [ChartPointSchema]
// }, { timestamps: true });

// export default mongoose.model("ChartData", ChartDataSchema);