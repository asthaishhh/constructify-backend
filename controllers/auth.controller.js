import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Company from "../models/Company.js";

const createSlug = (value = "") =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not set");
  }

  // include role for RBAC
  return jwt.sign(
    { id: user._id, role: user.role, companyId: user.companyId || null },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

export const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Please provide name, email, and password",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        message: "User with this email already exists",
      });
    }

    // your User model hashes password in pre('save')
    const normalizedRole = role === "admin" ? "admin" : "user";

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: normalizedRole,
    });

    const token = generateToken(user);

    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: user._id,
        companyId: user.companyId || null,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }
    res.status(500).json({ message: "Server error during signup" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Please provide email and password",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        companyId: user.companyId || null,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};

export const me = async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      companyId: req.user.companyId || null,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      createdAt: req.user.createdAt,
    },
  });
};

export const getCompanyProfile = async (req, res) => {
  try {
    const userEmail = String(req?.user?.email || "").toLowerCase().trim();
    const companyId = req?.user?.companyId ? String(req.user.companyId) : "";

    let company = null;
    if (companyId) {
      company = await Company.findById(companyId).lean();
    }

    if (!company && userEmail) {
      company = await Company.findOne({ email: userEmail }).lean();
    }

    if (!company) {
      return res.status(404).json({ message: "Company profile not found" });
    }

    return res.json({
      companyProfile: {
        companyName: company.name || "",
        companyTagline: company.companyTagline || "",
        logo: company.logo || "",
        ownerName: company.ownerName || "",
        gstIn: company.gstIn || "",
        address: company.address || "",
        phone: company.phone || "",
        email: company.email || "",
      },
    });
  } catch (error) {
    console.error("getCompanyProfile error:", error);
    return res.status(500).json({ message: "Server error fetching company profile" });
  }
};

export const registerCompany = async (req, res) => {
  try {
    const {
      companyName,
      companyTagline,
      logo,
      ownerName,
      gstIn,
      address,
      phone,
      email,
      password,
    } = req.body || {};

    if (!companyName || !ownerName || !email || !password) {
      return res.status(400).json({
        message: "Please provide companyName, ownerName, email and password",
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const baseSlug = createSlug(companyName);

    if (!baseSlug) {
      return res.status(400).json({ message: "Invalid company name" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        message: "User with this email already exists",
      });
    }

    let slug = baseSlug;
    let slugCounter = 1;
    while (await Company.findOne({ slug })) {
      slug = `${baseSlug}-${slugCounter}`;
      slugCounter += 1;
    }

    const company = await Company.create({
      name: String(companyName).trim(),
      ownerName: String(ownerName).trim(),
      slug,
      companyTagline: String(companyTagline || "").trim(),
      logo: String(logo || "").trim(),
      gstIn: String(gstIn || "").trim(),
      address: String(address || "").trim(),
      phone: String(phone || "").trim(),
      email: normalizedEmail,
    });

    const adminUser = await User.create({
      companyId: company._id,
      name: String(ownerName).trim(),
      email: normalizedEmail,
      password,
      role: "admin",
    });

    const token = generateToken(adminUser);

    return res.status(201).json({
      message: "Company and admin user created successfully",
      token,
      company: {
        id: company._id,
        name: company.name,
        slug: company.slug,
      },
      user: {
        id: adminUser._id,
        companyId: adminUser.companyId,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (error) {
    console.error("Register company error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }
    return res.status(500).json({ message: "Server error during company registration" });
  }
};