import Order from "../models/order.js";
import Material from "../models/Material.js";
import Counter from "../models/Counter.js";

const getCompanyIdFromReq = (req) => String(req?.user?.companyId || "").trim();
const DEFAULT_MATERIAL_CATEGORY = "Building Materials";
const DEFAULT_MATERIAL_UNIT_BY_NAME = {
  sand: "m3",
  cement: "bags",
  "iron rods": "pieces",
  bricks: "pieces",
};
const ORDER_NUMBER_PREFIX = "ORD-";

const formatOrderNumber = (seq) => `${ORDER_NUMBER_PREFIX}${String(seq).padStart(4, "0")}`;

const parseOrderNumber = (id = "") => {
  const raw = String(id || "").trim();
  if (!raw.startsWith(ORDER_NUMBER_PREFIX)) return null;
  const value = Number(raw.slice(ORDER_NUMBER_PREFIX.length));
  return Number.isFinite(value) ? value : null;
};

const getHighestExistingOrderSequence = async (companyId) => {
  const orders = await Order.find({ companyId }).select("id").lean();
  return orders.reduce((max, order) => {
    const parsed = parseOrderNumber(order?.id);
    if (!Number.isFinite(parsed)) return max;
    return parsed > max ? parsed : max;
  }, 0);
};

const getOrderCounterId = (companyId) => `order_seq_${String(companyId)}`;

const syncOrderCounterWithExisting = async (companyId) => {
  const counterId = getOrderCounterId(companyId);
  const highestExistingSequence = await getHighestExistingOrderSequence(companyId);

  const counter = await Counter.findById(counterId).lean();
  const currentSeq = Number(counter?.seq || 0);
  if (currentSeq >= highestExistingSequence) return;

  await Counter.updateOne(
    { _id: counterId },
    { $set: { seq: highestExistingSequence } },
    { upsert: true }
  );
};

const getNextOrderIdForCompany = async (companyId) => {
  const counterId = getOrderCounterId(companyId);
  const existingCounter = await Counter.findById(counterId);

  if (!existingCounter) {
    const highestExistingSequence = await getHighestExistingOrderSequence(companyId);
    try {
      await Counter.create({ _id: counterId, seq: highestExistingSequence });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }

  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return formatOrderNumber(counter.seq);
};

const normalizeStatus = (status = "open") => {
  const s = String(status || "open").toLowerCase();
  if (["open", "processing", "executed", "completed", "cancelled", "pending", "received"].includes(s)) return s;
  return "open";
};

const mapOrderForUi = (orderDoc) => {
  const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc;
  return {
    ...order,
    id: order.id,
    type: order.type || "mine",
    client: order.client,
    materialName: order.materialName,
    quantity: Number(order.quantity || 0),
    costPrice: Number(order.costPrice || 0),
    sellingPrice: Number(order.sellingPrice || 0),
    // Keep legacy price field for existing frontend code paths
    price: Number(order.sellingPrice || 0),
    profitPerUnit: Number(order.profitPerUnit || 0),
    profit: Number(order.profit || 0),
    totalAmount: Number(order.totalAmount || 0),
    status: normalizeStatus(order.status),
    createdAt: order.createdAt,
  };
};

/*
CREATE ORDER
*/
export const createOrder = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

    const {
      id,
      type,
      client,
      materialName,
      quantity,
      costPrice,
      status,
    } = req.body;

    const normalizedType = type === "customers" ? "customers" : "mine";

    if (!client || !materialName || !quantity) {
      return res.status(400).json({ message: "client, materialName and quantity are required" });
    }

    await syncOrderCounterWithExisting(companyId);

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: "quantity must be greater than 0" });
    }

    const normalizedMaterialName = String(materialName || "").trim().toLowerCase();

    let material = await Material.findOne({
      companyId,
      name: new RegExp(`^${normalizedMaterialName}$`, "i"),
    });

    const hasProvidedCost = String(costPrice ?? "").trim() !== "" && Number.isFinite(Number(costPrice));
    if (!hasProvidedCost) {
      return res.status(400).json({ message: "Cost price is required to create order." });
    }

    const cost = Number(costPrice);
    if (!Number.isFinite(cost) || cost < 0) {
      return res.status(400).json({ message: "costPrice must be a valid number" });
    }

    if (!material && normalizedType === "mine") {
      const fallbackUnit = DEFAULT_MATERIAL_UNIT_BY_NAME[normalizedMaterialName] || "bags";
      try {
        material = await Material.create({
          companyId,
          name: normalizedMaterialName,
          quantity: 0,
          unit: fallbackUnit,
          category: DEFAULT_MATERIAL_CATEGORY,
          minStock: 0,
          price: cost,
        });
      } catch (materialCreateErr) {
        if (materialCreateErr?.code === 11000) {
          material = await Material.findOne({
            companyId,
            name: new RegExp(`^${normalizedMaterialName}$`, "i"),
          });
        } else {
          throw materialCreateErr;
        }
      }
    }

    if (!material) {
      return res.status(404).json({ message: `Material not found: ${materialName}` });
    }

    if (normalizedType === "customers" && material.quantity < qty) {
      return res.status(400).json({ message: `Insufficient stock for ${material.name}` });
    }

    if (normalizedType === "mine" && (!Number.isFinite(Number(material.price)) || Number(material.price) <= 0)) {
      material.price = cost;
      await material.save();
    }

    // Customer orders consume stock immediately.
    // Mine orders represent procurement and will refill on status=completed.
    if (normalizedType === "customers") {
      material.quantity -= qty;
      await material.save();
    }

    // Selling price is captured later during invoice generation.
    const totalAmount = Number((qty * cost).toFixed(2));
    const profitPerUnit = 0;
    const profit = 0;

    let newOrder = null;
    let lastSaveError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const normalizedId = await getNextOrderIdForCompany(companyId);
        newOrder = new Order({
          companyId,
          id: normalizedId,
          type: normalizedType,
          client,
          material: material._id,
          materialName: material.name,
          quantity: qty,
          unit: material.unit || "",
          costPrice: cost,
          sellingPrice: 0,
          totalAmount,
          profitPerUnit,
          profit,
          status: normalizeStatus(status),
          inventoryRefilled: false,
          createdAt: new Date(),
        });

        await newOrder.save();
        lastSaveError = null;
        break;
      } catch (saveErr) {
        lastSaveError = saveErr;
        if (saveErr?.code !== 11000) throw saveErr;
        await syncOrderCounterWithExisting(companyId);
      }
    }

    if (!newOrder || lastSaveError) {
      throw lastSaveError || new Error("Failed to assign unique order ID");
    }

    res.status(201).json({
      message: "Order created successfully",
      order: mapOrderForUi(newOrder),
    });
  } catch (error) {
    console.error("Create Order Error:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        message: "Could not allocate a unique order ID. Please try again.",
      });
    }

    if (error?.name === "ValidationError" || error?.name === "CastError") {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({
      message: "Server error creating order",
      error: error?.message || "Unknown error",
    });
  }
};

/*
GET ALL ORDERS
*/
export const getOrders = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

    const orders = await Order.find({ companyId })
      .populate("material", "name unit")
      .sort({ createdAt: -1 });

    res.status(200).json(orders.map(mapOrderForUi));
  } catch (error) {
    console.error("Get Orders Error:", error);
    res.status(500).json({ message: "Server error fetching orders" });
  }
};

/*
GET SINGLE ORDER
*/
export const getOrderById = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

    const order = await Order.findOne({ _id: req.params.id, companyId }).populate("material", "name unit");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json(mapOrderForUi(order));
  } catch (error) {
    console.error("Get Order Error:", error);
    res.status(500).json({ message: "Server error fetching order" });
  }
};

/*
UPDATE ORDER STATUS
*/
export const updateOrderStatus = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

    const { status } = req.body;
    const nextStatus = normalizeStatus(status);

    const order = await Order.findOne({ _id: req.params.id, companyId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const isMineOrder = order.type === "mine";
    const isInboundStatus = nextStatus === "received" || nextStatus === "completed";
    const shouldRefill = isMineOrder && isInboundStatus && !order.inventoryRefilled;

    if (shouldRefill) {
      const material = await Material.findOne({ _id: order.material, companyId });
      if (!material) {
        return res.status(404).json({ message: "Material not found for inventory refill" });
      }

      material.quantity = Number(material.quantity || 0) + Number(order.quantity || 0);
      await material.save();
      order.inventoryRefilled = true;
    }

    order.status = nextStatus;
    await order.save();

    res.status(200).json({
      message: "Order status updated",
      order: mapOrderForUi(order),
    });
  } catch (error) {
    console.error("Update Order Error:", error);
    res.status(500).json({ message: "Server error updating order" });
  }
};

/*
DELETE ORDER
*/
export const deleteOrder = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

    const order = await Order.findOneAndDelete({ _id: req.params.id, companyId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("Delete Order Error:", error);
    res.status(500).json({ message: "Server error deleting order" });
  }
};