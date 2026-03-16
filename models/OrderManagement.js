// import mongoose from "mongoose";

// const orderManagementSchema = new mongoose.Schema(
//   {
//     id: {
//       type: String,
//       unique: true,
//       required: true,
//     },
//     type: {
//       type: String,
//       enum: ["mine", "customers"],
//       required: true,
//     },
//     client: {
//       type: String,
//       default: "N/A",
//     },
//     pair: {
//       type: String,
//       required: true,
//     },
//     side: {
//       type: String,
//       enum: ["Buy", "Sell"],
//       required: true,
//     },
//     quantity: {
//       type: Number,
//       required: true,
//     },
//     price: {
//       type: Number,
//       required: true,
//     },
//     status: {
//       type: String,
//       enum: ["open", "executed", "completed", "cancelled"],
//       default: "open",
//     },
//   },
//   { timestamps: true }
// );

// const OrderManagement = mongoose.model("OrderManagement", orderManagementSchema);
// export default OrderManagement;