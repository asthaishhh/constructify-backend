import Employee from "../models/Employee.js";

const getCompanyIdFromReq = (req) => String(req?.user?.companyId || "").trim();


// CREATE EMPLOYEE
export const createEmployee = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company context missing in token" });
    }

    const employee = new Employee({ ...req.body, companyId });
    await employee.save();

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      employee
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error creating employee",
      error: error.message
    });

  }
};



// GET ALL EMPLOYEES
export const getAllEmployees = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company context missing in token" });
    }

    const employees = await Employee.find({ companyId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      employees
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error fetching employees",
      error: error.message
    });

  }
};



// GET SINGLE EMPLOYEE
export const getEmployeeById = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company context missing in token" });
    }

    const employee = await Employee.findOne({ _id: req.params.id, companyId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    res.status(200).json({
      success: true,
      employee
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error fetching employee",
      error: error.message
    });

  }
};



// UPDATE EMPLOYEE
export const updateEmployee = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company context missing in token" });
    }

    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, companyId },
      req.body,
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      employee
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error updating employee",
      error: error.message
    });

  }
};



// DELETE EMPLOYEE
export const deleteEmployee = async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company context missing in token" });
    }

    const employee = await Employee.findOneAndDelete({ _id: req.params.id, companyId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Employee deleted successfully"
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Error deleting employee",
      error: error.message
    });

  }
};