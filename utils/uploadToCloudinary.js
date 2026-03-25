import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.js";

const uploadToCloudinary = (fileBuffer, folder = "mern_uploads") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};

export default uploadToCloudinary;