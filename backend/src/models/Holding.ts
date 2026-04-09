// src/models/Holding.ts
// Danh mục cổ phiếu nắm giữ — mỗi user + symbol = 1 record

import mongoose, { Schema, Document, Types } from "mongoose";

export interface IHolding extends Document {
  userId: Types.ObjectId;
  symbol: string;      // VD: "VNM"
  available: number;   // Số CP có thể bán
  locked: number;      // Số CP đang chờ lệnh bán khớp
  avgPrice: number;    // Giá vốn trung bình (VND)
  createdAt: Date;
  updatedAt: Date;
}

const holdingSchema = new Schema<IHolding>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    available: { type: Number, default: 0, min: 0 },
    locked: { type: Number, default: 0, min: 0 },
    avgPrice: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// Đảm bảo mỗi user chỉ có 1 record per symbol
holdingSchema.index({ userId: 1, symbol: 1 }, { unique: true });

const Holding = mongoose.model<IHolding>("Holding", holdingSchema);

export default Holding;
