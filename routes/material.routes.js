
// export default router;
import express from "express";
import Material from "../models/Material.js";
import authenticateToken from "../middleware/auth.js";
import authorizeRoles from "../middleware/authorize.js";

const router = express.Router();

/* -------------------------
   🔐 Require Login for all
--------------------------*/
router.use(authenticateToken);

/* -------------------------
   ✅ GET all materials
   (admin + user can view)
--------------------------*/
router.get("/", authorizeRoles("admin", "user"), async (req, res) => {
  try {
    const materials = await Material.find().sort({ createdAt: -1 });
    res.json(materials);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* -------------------------
   ✅ POST new material
   (admin only)
--------------------------*/
router.post("/", authorizeRoles("admin"), async (req, res) => {
  try {
    const saved = await Material.create(req.body);
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* -------------------------
   ✅ PUT update material
   (admin only)
--------------------------*/
router.put("/:id", authorizeRoles("admin"), async (req, res) => {
  try {
    const updated = await Material.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Material not found" });
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* -------------------------
   ✅ DELETE material
   (admin only)
--------------------------*/
router.delete("/:id", authorizeRoles("admin"), async (req, res) => {
  try {
    const deleted = await Material.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Material not found" });
    }

    res.json({ message: "Material deleted" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;