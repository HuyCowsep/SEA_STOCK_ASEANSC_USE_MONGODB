// src/config/database.ts
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/AseanSC_DB";

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGO_URI);

    console.log("✅ MongoDB connected thành công");
  } catch (error) {
    console.error("❌ Lỗi kết nối MongoDB:", error);
    process.exit(1); // kill server nếu connect fail
  }
};
