import Driver from "../models/Driver.js";

const getCompanyIdFromReq = (req) => String(req?.user?.companyId || "").trim();


// CREATE DRIVER
export const createDriver = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ message: "Company context missing in token" });
    }

    const driver = new Driver({ ...req.body, companyId });
    await driver.save();

    res.status(201).json(driver);
  } catch (error) {
    res.status(500).json({
      message: "Error creating driver",
      error: error.message,
    });
  }
};



// GET ALL DRIVERS
export const getAllDrivers = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ message: "Company context missing in token" });
    }

    const drivers = await Driver.find({ companyId }).sort({ createdAt: -1 });
    res.status(200).json(drivers);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching drivers",
      error: error.message,
    });
  }
};



// GET SINGLE DRIVER
export const getDriverById = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ message: "Company context missing in token" });
    }

    const driver = await Driver.findOne({ _id: req.params.id, companyId });

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.status(200).json(driver);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching driver",
      error: error.message,
    });
  }
};



// UPDATE DRIVER
export const updateDriver = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ message: "Company context missing in token" });
    }

    const driver = await Driver.findOneAndUpdate(
      { _id: req.params.id, companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.status(200).json(driver);
  } catch (error) {
    res.status(500).json({
      message: "Error updating driver",
      error: error.message,
    });
  }
};



// DELETE DRIVER
export const deleteDriver = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ message: "Company context missing in token" });
    }

    const driver = await Driver.findOneAndDelete({ _id: req.params.id, companyId });

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.status(200).json({ message: "Driver deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting driver",
      error: error.message,
    });
  }
};