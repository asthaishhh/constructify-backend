import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB");

    try {
      // Remove role field from all users
      const result = await User.updateMany({}, { $unset: { role: 1 } });
      console.log(`Removed role field from ${result.modifiedCount} users`);

      console.log("Role field removal completed successfully");
    } catch (error) {
      console.error("Error removing role field:", error);
    } finally {
      mongoose.connection.close();
      console.log("Database connection closed");
    }
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
  });
