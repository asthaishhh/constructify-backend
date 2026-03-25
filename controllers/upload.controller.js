import { uploadToCloudinary } from "../utils/cloudinary.js";
import User from "../models/User.js";

export const registerCompany = async (req, res) => {
  try {
    let logoUrl = "";
    let logoPublicId = "";

    if (req.file) {
      const uploaded = await uploadToCloudinary(req.file.buffer);
      logoUrl = uploaded.secure_url;
      logoPublicId = uploaded.public_id;
    }

    const {
      companyName,
      companyTagline,
      ownerName,
      gstIn,
      address,
      phone,
      email,
      password,
    } = req.body;

    // your existing registration logic here...
    // hash password, create admin/company user, etc.

    const companyProfile = {
      companyName,
      companyTagline,
      logo: logoUrl,
      logoPublicId,
      ownerName,
      gstIn,
      address,
      phone,
      email,
    };

    // save this in DB however your schema is set up

    return res.status(201).json({
      message: "Company registered successfully",
      companyProfile,
    });
  } catch (error) {
    console.error("registerCompany error:", error);
    return res.status(500).json({
      message: "Server error during company registration",
    });
  }
};