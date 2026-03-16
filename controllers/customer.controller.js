import Customer from "../models/Customer.js";


// CREATE CUSTOMER
export const createCustomer = async (req, res) => {
  try {

    const customer = new Customer(req.body);
    await customer.save();

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      customer
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error creating customer",
      error: error.message
    });

  }
};



// GET ALL CUSTOMERS
export const getAllCustomers = async (req, res) => {
  try {

    const customers = await Customer.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      customers
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error fetching customers",
      error: error.message
    });

  }
};



// GET SINGLE CUSTOMER
export const getCustomerById = async (req, res) => {
  try {

    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    res.status(200).json({
      success: true,
      customer
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error fetching customer",
      error: error.message
    });

  }
};



// UPDATE CUSTOMER
export const updateCustomer = async (req, res) => {
  try {

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      customer
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error updating customer",
      error: error.message
    });

  }
};



// DELETE CUSTOMER
export const deleteCustomer = async (req, res) => {
  try {

    const customer = await Customer.findByIdAndDelete(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer deleted successfully"
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error deleting customer",
      error: error.message
    });

  }
};
