// // backend/routes/transportation.js
// import express from "express";
// import Driver from "../middleware/models/Driver.js";
// import Vehicle from "../middleware/models/Vehicle.js";

// const router = express.Router();

// // --- Driver Routes ---

// // GET all drivers
// router.get("/drivers", async (req, res) => {
//   try {
//     const drivers = await Driver.find();
//     res.json(drivers);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// // POST a new driver
// router.post("/drivers", async (req, res) => {
//   const driver = new Driver(req.body);
//   try {
//     const newDriver = await driver.save();
//     res.status(201).json(newDriver);
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }
// });

// // PUT (update) a driver
// router.put("/drivers/:id", async (req, res) => {
//   try {
//     const updatedDriver = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true });
//     if (!updatedDriver) return res.status(404).json({ message: "Driver not found" });
//     res.json(updatedDriver);
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }
// });

// // DELETE a driver
// router.delete("/drivers/:id", async (req, res) => {
//   try {
//     const driver = await Driver.findByIdAndDelete(req.params.id);
//     if (!driver) return res.status(404).json({ message: "Driver not found" });
//     res.json({ message: "Deleted Driver" });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// // --- Vehicle Routes ---

// // GET all vehicles
// router.get("/vehicles", async (req, res) => {
//   try {
//     const vehicles = await Vehicle.find();
//     res.json(vehicles);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// // POST a new vehicle
// router.post("/vehicles", async (req, res) => {
//   const vehicle = new Vehicle(req.body);
//   try {
//     const newVehicle = await vehicle.save();
//     res.status(201).json(newVehicle);
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }
// });

// // PUT (update) a vehicle
// router.put("/vehicles/:id", async (req, res) => {
//   try {
//     const updatedVehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, { new: true });
//     if (!updatedVehicle) return res.status(404).json({ message: "Vehicle not found" });
//     res.json(updatedVehicle);
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }
// });

// // DELETE a vehicle
// router.delete("/vehicles/:id", async (req, res) => {
//   try {
//     const vehicle = await Vehicle.findByIdAndDelete(req.params.id);
//     if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });
//     res.json({ message: "Deleted Vehicle" });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// export default router;
