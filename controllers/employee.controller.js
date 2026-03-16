import Employee from "../models/Employee.js";


// CREATE EMPLOYEE
export const createEmployee = async (req, res) => {
  try {

    const employee = new Employee(req.body);
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

    const employees = await Employee.find().sort({ createdAt: -1 });

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

    const employee = await Employee.findById(req.params.id);

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

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
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

    const employee = await Employee.findByIdAndDelete(req.params.id);

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