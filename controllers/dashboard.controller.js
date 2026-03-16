import Material from "../models/Material.js";
import Invoice from "../models/Invoice.js";
import Order from "../models/order.js";

// ✅ LOW STOCK MATERIALS
// GET /api/dashboard/low-stock
export const getLowStockMaterials = async (req, res) => {
  try {
    const lowStock = await Material.find({
      $expr: { $lte: ["$quantity", "$minStock"] },
    }).sort({ quantity: 1 });

    res.json({
      count: lowStock.length,
      lowStock,
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch low stock materials",
      error: err.message,
    });
  }
};

// ✅ DASHBOARD SUMMARY (optional but useful)
// GET /api/dashboard/summary
export const getDashboardSummary = async (req, res) => {
  try {
    const [totalMaterials, totalCustomers, totalInvoices, totalOrders] =
      await Promise.all([
        Material.countDocuments(),
        // If you have Customer model, replace this line accordingly
        // Customer.countDocuments(),
        Promise.resolve(null), // placeholder if you don't want customer count here
        Invoice.countDocuments(),
        Order.countDocuments(),
      ]);

    const lowStockCount = await Material.countDocuments({
      $expr: { $lte: ["$quantity", "$minStock"] },
    });

    res.json({
      totalMaterials,
      totalInvoices,
      totalOrders,
      lowStockCount,
      // totalCustomers, // uncomment if you add Customer model here
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch dashboard summary",
      error: err.message,
    });
  }
};