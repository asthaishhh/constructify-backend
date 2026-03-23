import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Company from "../models/Company.js";

const authenticateToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.split(" ")[1] : null;

    if (!token) {
      return res.status(401).json({ message: "Access token required" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "JWT_SECRET not set" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Support both payload styles:
    // 1) { id, role }  (recommended)
    // 2) { userId }    (your current style)
    const userId = decoded.id || decoded.userId;

    if (!userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const tokenCompanyId = decoded.companyId ? String(decoded.companyId) : null;
    const dbCompanyId = user.companyId ? String(user.companyId) : null;

    let resolvedCompanyId = dbCompanyId || tokenCompanyId || null;

    // Backward compatibility: legacy users may not have companyId persisted yet.
    // Resolve by matching company email, then persist for future requests.
    if (!resolvedCompanyId) {
      const normalizedEmail = String(user.email || "").toLowerCase().trim();
      if (normalizedEmail) {
        const matchedCompany = await Company.findOne({ email: normalizedEmail }).select("_id");
        if (matchedCompany?._id) {
          resolvedCompanyId = String(matchedCompany._id);
          await User.updateOne({ _id: user._id }, { $set: { companyId: matchedCompany._id } });
        }
      }
    }

    req.user = {
      ...user.toObject(),
      companyId: resolvedCompanyId,
    };
    next();

  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
};

export default authenticateToken;




