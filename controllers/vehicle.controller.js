import Vehicle from "../models/Vehicle.js";

const getCompanyIdFromReq = (req) => String(req?.user?.companyId || "").trim();


// CREATE VEHICLE
export const createVehicle = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ message: "Company context missing in token" });
    }

    const vehicle = new Vehicle({ ...req.body, companyId });
    await vehicle.save();

    res.status(201).json(vehicle);
  } catch (error) {
    res.status(500).json({
      message: "Error creating vehicle",
      error: error.message,
    });
  }
};



// GET ALL VEHICLES
export const getAllVehicles = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ message: "Company context missing in token" });
    }

    const vehicles = await Vehicle.find({ companyId }).sort({ createdAt: -1 });
    res.status(200).json(vehicles);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching vehicles",
      error: error.message,
    });
  }
};



// GET SINGLE VEHICLE
export const getVehicleById = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ message: "Company context missing in token" });
    }

    const vehicle = await Vehicle.findOne({ _id: req.params.id, companyId });

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    res.status(200).json(vehicle);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching vehicle",
      error: error.message,
    });
  }
};



// UPDATE VEHICLE
export const updateVehicle = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ message: "Company context missing in token" });
    }

    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: req.params.id, companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    res.status(200).json(vehicle);
  } catch (error) {
    res.status(500).json({
      message: "Error updating vehicle",
      error: error.message,
    });
  }
};



// DELETE VEHICLE
export const deleteVehicle = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ message: "Company context missing in token" });
    }

    const vehicle = await Vehicle.findOneAndDelete({ _id: req.params.id, companyId });

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    res.status(200).json({ message: "Vehicle deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting vehicle",
      error: error.message,
    });
  }
};