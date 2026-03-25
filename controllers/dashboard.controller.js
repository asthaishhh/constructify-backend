import Material from "../models/Material.js";
import Invoice from "../models/Invoice.js";
import Order from "../models/order.js";
import Customer from "../models/Customer.js";

const getCompanyIdFromReq = (req) => String(req?.user?.companyId || "").trim();

const CATEGORY_COLORS = [
  "#8B7E74",
  "#E74C3C",
  "#D4AF37",
  "#7F8C8D",
  "#A78BFA",
  "#1ABC9C",
  "#5DADE2",
  "#F39C12",
  "#C0392B",
];

const ORDER_STATUS_COLORS = {
  pending: "#f59e0b",
  processing: "#3b82f6",
  received: "#6366f1",
  completed: "#10b981",
  cancelled: "#ef4444",
};

const round2 = (value) => Number((Number(value) || 0).toFixed(2));

const monthKeyFromDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabelFromKey = (monthKey) => {
  const [year, month] = String(monthKey || "").split("-");
  if (!year || !month) return "";
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("en-IN", { month: "short" });
};

const createTrailingMonthKeys = (count = 12) => {
  const keys = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
};

const normalizeOrderAmount = (order) => {
  const directTotal = Number(order?.totalAmount ?? order?.amount);
  if (Number.isFinite(directTotal) && directTotal >= 0) return directTotal;

  const qty = Number(order?.quantity);
  const rate = Number(order?.pricePerUnit ?? order?.price ?? order?.rate);
  if (Number.isFinite(qty) && Number.isFinite(rate)) return qty * rate;

  if (Array.isArray(order?.materials)) {
    return order.materials.reduce((sum, item) => {
      const itemQty = Number(item?.quantity || 0);
      const itemRate = Number((item?.rate ?? item?.pricePerUnit ?? item?.price) || 0);
      return sum + itemQty * itemRate;
    }, 0);
  }

  return 0;
};

const normalizeInvoiceAmount = (invoice) => {
  const directAmount = Number(invoice?.amount);
  if (Number.isFinite(directAmount) && directAmount >= 0) return directAmount;

  if (Array.isArray(invoice?.materials)) {
    return invoice.materials.reduce((sum, item) => {
      const qty = Number(item?.quantity || 0);
      const rate = Number(item?.rate || 0);
      return sum + qty * rate;
    }, 0);
  }

  return 0;
};

// ✅ LOW STOCK MATERIALS
// GET /api/dashboard/low-stock
export const getLowStockMaterials = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ message: "Company context missing in token" });
    }

    const lowStock = await Material.find({
      companyId,
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
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ message: "Company context missing in token" });
    }

    const [totalMaterials, totalCustomers, totalInvoices, totalOrders] =
      await Promise.all([
        Material.countDocuments({ companyId }),
        Customer.countDocuments({ companyId }),
        Invoice.countDocuments({ companyId }),
        Order.countDocuments({ companyId }),
      ]);

    const lowStockCount = await Material.countDocuments({
      companyId,
      $expr: { $lte: ["$quantity", "$minStock"] },
    });

    res.json({
      totalMaterials,
      totalCustomers,
      totalInvoices,
      totalOrders,
      lowStockCount,
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch dashboard summary",
      error: err.message,
    });
  }
};

// ✅ Unified analytics for dashboard + analysis
// GET /api/dashboard/analytics
export const getDashboardAnalytics = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ message: "Company context missing in token" });
    }

    const [materials, invoices, orders] = await Promise.all([
      Material.find({ companyId }).lean(),
      Invoice.find({ companyId }).populate("materials.material", "name").lean(),
      Order.find({ companyId }).lean(),
    ]);

    const monthKeys = createTrailingMonthKeys(12);
    const monthlyMap = Object.fromEntries(
      monthKeys.map((monthKey) => [
        monthKey,
        { monthKey, month: monthLabelFromKey(monthKey), invoiceRevenue: 0, orderRevenue: 0, orderProfit: 0, invoices: 0, orders: 0 },
      ])
    );

    let invoiceRevenue = 0;
    for (const invoice of invoices) {
      const amount = normalizeInvoiceAmount(invoice);
      invoiceRevenue += amount;
      const monthKey = monthKeyFromDate(invoice?.date || invoice?.createdAt);
      if (monthKey && monthlyMap[monthKey]) {
        monthlyMap[monthKey].invoiceRevenue += amount;
        monthlyMap[monthKey].invoices += 1;
      }
    }

    let orderRevenue = 0;
    let totalProfit = 0;
    const orderStatusCount = {
      pending: 0,
      processing: 0,
      received: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const order of orders) {
      const amount = normalizeOrderAmount(order);
      orderRevenue += amount;
      const orderProfit = Number(order?.profit || 0);
      totalProfit += orderProfit;
      const monthKey = monthKeyFromDate(order?.orderDate || order?.createdAt);
      if (monthKey && monthlyMap[monthKey]) {
        monthlyMap[monthKey].orderRevenue += amount;
        monthlyMap[monthKey].orderProfit += orderProfit;
        monthlyMap[monthKey].orders += 1;
      }

      const normalizedStatus = String(order?.status || "pending").toLowerCase();
      if (orderStatusCount[normalizedStatus] !== undefined) {
        orderStatusCount[normalizedStatus] += 1;
      }
    }

    // Revenue comes from invoices (selling); orderRevenue is treated as cost/exposure.
    const totalRevenue = invoiceRevenue;
    const monthlyTrend = monthKeys.map((monthKey) => {
      const row = monthlyMap[monthKey];
      const revenue = row.invoiceRevenue;
      const expenses = row.orderRevenue;
      const profit = row.orderProfit || (revenue - expenses);
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        monthKey,
        month: row.month,
        revenue: round2(revenue),
        expenses: round2(expenses),
        profit: round2(profit),
        margin: round2(margin),
        invoiceRevenue: round2(row.invoiceRevenue),
        orderRevenue: round2(row.orderRevenue),
        orders: row.orders,
        invoices: row.invoices,
      };
    });

    const categoryMap = new Map();
    for (const invoice of invoices) {
      for (const item of invoice?.materials || []) {
        const materialName =
          item?.name ||
          item?.material?.name ||
          item?.material?.materialName ||
          "Other";
        const amount = Number(item?.quantity || 0) * Number(item?.rate || 0);
        categoryMap.set(materialName, (categoryMap.get(materialName) || 0) + amount);
      }
    }

    const categoryTotal = Array.from(categoryMap.values()).reduce((sum, value) => sum + value, 0);
    const salesByCategory = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 9)
      .map(([name, amount], index) => ({
        name,
        amount: round2(amount),
        value: categoryTotal > 0 ? round2((amount / categoryTotal) * 100) : 0,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }));

    const totalOrders = orders.length;
    const orderStatus = Object.entries(orderStatusCount)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1),
        count,
        value: totalOrders > 0 ? round2((count / totalOrders) * 100) : 0,
        fill: ORDER_STATUS_COLORS[status],
      }));

    const lowStockCount = materials.filter((material) => Number(material.quantity || 0) <= Number(material.minStock || 0)).length;
    const stockLevels = materials.slice(0, 8).map((material) => {
      const current = Number(material.quantity || 0);
      const minimum = Number(material.minStock || 0);
      const max = Math.max(current, minimum, 1);
      return {
        material: material.name || material.materialName || "Material",
        current,
        minimum,
        max,
      };
    });

    const expenseBreakdown = [
      { category: "Orders", value: round2(orderRevenue), fill: "#60A5FA" },
      { category: "Invoices", value: round2(invoiceRevenue), fill: "#34D399" },
    ];

    return res.json({
      summary: {
        totalRevenue: round2(totalRevenue),
        invoiceRevenue: round2(invoiceRevenue),
        orderRevenue: round2(orderRevenue),
        totalProfit: round2(totalProfit),
        totalInvoices: invoices.length,
        totalOrders: orders.length,
        lowStockCount,
      },
      revenueTrend: monthlyTrend,
      profitMarginTrend: monthlyTrend.map((row) => ({ monthKey: row.monthKey, month: row.month, margin: row.margin })),
      salesByCategory,
      orderStatus,
      stockLevels,
      expenseBreakdown,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch dashboard analytics",
      error: err.message,
    });
  }
};