const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    const error = new Error("MONGO_URI is missing.");
    error.code = "MISSING_ENV";
    throw error;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("MongoDB connected ✅");
  } catch (error) {
    console.error("MongoDB connection failed ❌");
    throw error;
  }
};

module.exports = connectDB;
