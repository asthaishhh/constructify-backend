import Vehicle from "../models/Vehicle.js";


// CREATE VEHICLE
export const createVehicle = async (req, res) => {
  try {

    const vehicle = new Vehicle(req.body);
    await vehicle.save();

    res.status(201).json({
      success: true,
      message: "Vehicle added successfully",
      vehicle
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error creating vehicle",
      error: error.message
    });

  }
};



// GET ALL VEHICLES
export const getAllVehicles = async (req, res) => {
  try {

    const vehicles = await Vehicle.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      vehicles
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error fetching vehicles",
      error: error.message
    });

  }
};



// GET SINGLE VEHICLE
export const getVehicleById = async (req, res) => {
  try {

    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found"
      });
    }

    res.status(200).json({
      success: true,
      vehicle
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error fetching vehicle",
      error: error.message
    });

  }
};



// UPDATE VEHICLE
export const updateVehicle = async (req, res) => {
  try {

    const vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      vehicle
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error updating vehicle",
      error: error.message
    });

  }
};



// DELETE VEHICLE
export const deleteVehicle = async (req, res) => {
  try {

    const vehicle = await Vehicle.findByIdAndDelete(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Vehicle deleted successfully"
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error deleting vehicle",
      error: error.message
    });

  }
};