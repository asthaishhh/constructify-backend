import Order from "../models/order.js";
import Material from "../models/Material.js";

/*
CREATE ORDER
*/
export const createOrder = async (req, res) => {
  try {
    const { customerId, materials, status } = req.body;

    if (!customerId || !materials || materials.length === 0) {
      return res.status(400).json({ message: "Customer and materials required" });
    }

    let totalAmount = 0;

    for (const item of materials) {
      const material = await Material.findById(item.materialId);

      if (!material) {
        return res.status(404).json({ message: `Material not found: ${item.materialId}` });
      }

      if (material.quantity < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${material.name}`,
        });
      }

      // deduct inventory
      material.quantity -= item.quantity;
      await material.save();

      totalAmount += item.quantity * material.price;
    }

    const newOrder = new Order({
      customerId,
      materials,
      totalAmount,
      status: status || "pending",
      createdAt: new Date(),
    });

    await newOrder.save();

    res.status(201).json({
      message: "Order created successfully",
      order: newOrder,
    });
  } catch (error) {
    console.error("Create Order Error:", error);
    res.status(500).json({ message: "Server error creating order" });
  }
};

/*
GET ALL ORDERS
*/
export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("customerId", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(orders);
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
    const order = await Order.findById(req.params.id).populate(
      "customerId",
      "name email"
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json(order);
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
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({
      message: "Order status updated",
      order,
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
    const order = await Order.findByIdAndDelete(req.params.id);

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