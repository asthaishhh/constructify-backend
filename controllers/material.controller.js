import Material from "../models/Material.js";

const getCompanyIdFromReq = (req) => String(req?.user?.companyId || "").trim();


// CREATE MATERIAL
export const createMaterial = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company context missing in token" });
    }

    const material = new Material({ ...req.body, companyId });

    await material.save();

    res.status(201).json({
      success: true,
      message: "Material added successfully",
      material
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error creating material",
      error: error.message
    });

  }
};



// GET ALL MATERIALS
export const getAllMaterials = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company context missing in token" });
    }

    const materials = await Material.find({ companyId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      materials
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error fetching materials",
      error: error.message
    });

  }
};



// GET SINGLE MATERIAL
export const getMaterialById = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company context missing in token" });
    }

    const material = await Material.findOne({ _id: req.params.id, companyId });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found"
      });
    }

    res.status(200).json({
      success: true,
      material
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error fetching material",
      error: error.message
    });

  }
};



// UPDATE MATERIAL
export const updateMaterial = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company context missing in token" });
    }

    const material = await Material.findOneAndUpdate(
      { _id: req.params.id, companyId },
      req.body,
      { new: true }
    );

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Material updated successfully",
      material
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error updating material",
      error: error.message
    });

  }
};



// DELETE MATERIAL
export const deleteMaterial = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company context missing in token" });
    }

    const material = await Material.findOneAndDelete({ _id: req.params.id, companyId });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Material deleted successfully"
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error deleting material",
      error: error.message
    });

  }
};