import express from "express";
import authenticateToken from "../middleware/auth.js";
import authorizeRoles from "../middleware/authorize.js";
import {
  createDriver,
  getAllDrivers,
  getDriverById,
  updateDriver,
  deleteDriver,
} from "../controllers/driver.controller.js";
import {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
} from "../controllers/vehicle.controller.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/drivers", authorizeRoles("admin", "user"), getAllDrivers);
router.get("/drivers/:id", authorizeRoles("admin", "user"), getDriverById);
router.post("/drivers", authorizeRoles("admin", "user"), createDriver);
router.put("/drivers/:id", authorizeRoles("admin", "user"), updateDriver);
router.delete("/drivers/:id", authorizeRoles("admin"), deleteDriver);

router.get("/vehicles", authorizeRoles("admin", "user"), getAllVehicles);
router.get("/vehicles/:id", authorizeRoles("admin", "user"), getVehicleById);
router.post("/vehicles", authorizeRoles("admin", "user"), createVehicle);
router.put("/vehicles/:id", authorizeRoles("admin", "user"), updateVehicle);
router.delete("/vehicles/:id", authorizeRoles("admin"), deleteVehicle);

export default router;
