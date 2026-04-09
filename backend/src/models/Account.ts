// src/models/Account.ts
// Tài khoản tiền của user — quản lý số dư, ngân hàng liên kết, nạp tiền ảo

import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAccount extends Document {
  userId: Types.ObjectId;
  available: number;      // Tiền có thể dùng (VND)
  locked: number;         // Tiền đang bị giữ cho lệnh mua chờ khớp (VND)
  bankAccount: string;    // Số tài khoản ngân hàng đã liên kết (rỗng = chưa liên kết)
  bankName: string;       // Tên ngân hàng (VD: "Vietcombank", "BIDV"...)
  dailyDeposited: number; // Tổng tiền đã nạp trong ngày hiện tại (VND)
  lastDepositDate: string; // Ngày nạp gần nhất ("YYYY-MM-DD") — dùng để reset dailyDeposited
  createdAt: Date;
  updatedAt: Date;
}

const accountSchema = new Schema<IAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    available: { type: Number, default: 0, min: 0 },
    locked: { type: Number, default: 0, min: 0 },
    bankAccount: { type: String, default: "" },
    bankName: { type: String, default: "" },
    dailyDeposited: { type: Number, default: 0, min: 0 },
    lastDepositDate: { type: String, default: "" },
  },
  { timestamps: true },
);

const Account = mongoose.model<IAccount>("Account", accountSchema);

export default Account;
