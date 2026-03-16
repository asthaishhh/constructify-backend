import Material from "../models/Material.js";


// CREATE MATERIAL
export const createMaterial = async (req, res) => {
  try {

    const material = new Material(req.body);

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

    const materials = await Material.find().sort({ createdAt: -1 });

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

    const material = await Material.findById(req.params.id);

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

    const material = await Material.findByIdAndUpdate(
      req.params.id,
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

    const material = await Material.findByIdAndDelete(req.params.id);

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