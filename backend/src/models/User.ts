// src/models/User.ts

import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  // Thông tin cá nhân bổ sung — mặc định rỗng, user tự cập nhật sau
  fullName: string;
  nickname: string;
  phone: string;
  dateOfBirth: string;   // "YYYY-MM-DD"
  cccd: string;          // Căn cước công dân
  status: "active" | "inactive";
  otp?: string;
  otpExpire?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"],
    },
    password: { type: String, required: true },
    fullName:    { type: String, default: "", trim: true },
    nickname:    { type: String, default: "", trim: true },
    phone:       { type: String, default: "" },
    dateOfBirth: { type: String, default: "" },
    cccd:        { type: String, default: "" },
    status:      { type: String, enum: ["active", "inactive"], default: "active" },
    otp:         { type: String },
    otpExpire:   { type: Date },
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;

