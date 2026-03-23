
// export default router;
import express from "express";
import Material from "../models/Material.js";
import authenticateToken from "../middleware/auth.js";
import authorizeRoles from "../middleware/authorize.js";

const router = express.Router();

const getCompanyIdFromReq = (req) => String(req?.user?.companyId || "").trim();

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
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

    const materials = await Material.find({ companyId }).sort({ createdAt: -1 });
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
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

    const payload = {
      ...req.body,
      companyId,
      name: String(req.body?.name || "").trim().toLowerCase(),
      ...(req.body?.price !== undefined
        ? { price: Number.isFinite(Number(req.body.price)) ? Number(req.body.price) : undefined }
        : {}),
    };

    const saved = await Material.create(payload);
    res.status(201).json(saved);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        message: "Material already exists for this company. Update quantity instead of adding duplicate.",
      });
    }
    res.status(400).json({ message: err.message });
  }
});

/* -------------------------
   ✅ PUT update material
   (admin only)
--------------------------*/
router.put("/:id", authorizeRoles("admin"), async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

    const payload = {
      ...req.body,
      ...(req.body?.name !== undefined
        ? { name: String(req.body.name || "").trim().toLowerCase() }
        : {}),
      ...(req.body?.price !== undefined
        ? { price: Number.isFinite(Number(req.body.price)) ? Number(req.body.price) : undefined }
        : {}),
    };

    const updated = await Material.findOneAndUpdate(
      { _id: req.params.id, companyId },
      payload,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Material not found" });
    }

    res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        message: "Material name already exists for this company.",
      });
    }
    res.status(400).json({ message: err.message });
  }
});

/* -------------------------
   ✅ DELETE material
   (admin only)
--------------------------*/
router.delete("/:id", authorizeRoles("admin"), async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) return res.status(403).json({ message: "Company context missing in token" });

    const deleted = await Material.findOneAndDelete({ _id: req.params.id, companyId });

    if (!deleted) {
      return res.status(404).json({ message: "Material not found" });
    }

    res.json({ message: "Material deleted" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;