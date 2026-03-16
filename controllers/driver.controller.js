import Driver from "../models/driver.js";


// CREATE DRIVER
export const createDriver = async (req, res) => {
  try {

    const driver = new Driver(req.body);
    await driver.save();

    res.status(201).json({
      success: true,
      message: "Driver added successfully",
      driver
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error creating driver",
      error: error.message
    });

  }
};



// GET ALL DRIVERS
export const getAllDrivers = async (req, res) => {
  try {

    const drivers = await Driver.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      drivers
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error fetching drivers",
      error: error.message
    });

  }
};



// GET SINGLE DRIVER
export const getDriverById = async (req, res) => {
  try {

    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.status(200).json({
      success: true,
      driver
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error fetching driver",
      error: error.message
    });

  }
};



// UPDATE DRIVER
export const updateDriver = async (req, res) => {
  try {

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Driver updated successfully",
      driver
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error updating driver",
      error: error.message
    });

  }
};



// DELETE DRIVER
export const deleteDriver = async (req, res) => {
  try {

    const driver = await Driver.findByIdAndDelete(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Driver deleted successfully"
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error deleting driver",
      error: error.message
    });

  }
};