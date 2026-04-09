// src/models/Order.ts
// Schema lệnh đặt chứng khoán (mock) — lưu vào MongoDB

import mongoose, { Schema, Document, Types } from "mongoose";

export interface IOrder extends Document {
  userId: Types.ObjectId;
  symbol: string; // VD: "VNM"
  exchange: "HOSE" | "HNX" | "UPCOM";
  side: "buy" | "sell";
  orderType: "LO" | "ATO" | "ATC" | "MP"; // Giới hạn / ATO / ATC / Thị trường
  price: number; // Giá đặt (×1000 VND). LO bắt buộc, ATO/ATC/MP = 0
  quantity: number; // KL đặt (bội số 100)
  filledQuantity: number; // KL đã khớp
  status: "pending" | "partial" | "matched" | "cancelled";
  matchedPrice: number | null; // Giá khớp thực tế
  matchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    exchange: { type: String, required: true, enum: ["HOSE", "HNX", "UPCOM"] },
    side: { type: String, required: true, enum: ["buy", "sell"] },
    orderType: { type: String, required: true, enum: ["LO", "ATO", "ATC", "MP"] },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 100 },
    filledQuantity: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "partial", "matched", "cancelled"],
      index: true,
    },
    matchedPrice: { type: Number, default: null },
    matchedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Compound index: query lệnh pending/partial nhanh hơn cho matching engine
orderSchema.index({ status: 1, createdAt: 1 });

const Order = mongoose.model<IOrder>("Order", orderSchema);

export default Order;
