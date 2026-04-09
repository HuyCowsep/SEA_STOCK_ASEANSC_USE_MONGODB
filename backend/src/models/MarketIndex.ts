// backend/src/models/MarketIndex.ts
// Mongoose model cho collection indices — dữ liệu chỉ số thị trường (VN-INDEX, HNX-INDEX...)
// Fields khớp với cấu trúc JSON từ ASEAN /datafeed/indexsnaps

import mongoose, { Document, Schema } from "mongoose";

export interface IMarketIndex extends Document {
  marketCode: string; // "HOSE", "30" (VN30), "HNX", "HNX30", "UPCOM"
  tradingdate?: string;
  marketIndex?: string; // Giá trị chỉ số, VD: "1677.54"
  indexTime?: string; // Giờ cập nhật, VD: "15:05:05"
  indexColor?: string; // "up" | "down" | "ref"
  indexChange?: string; // Điểm thay đổi
  indexPercentChange?: string; // % thay đổi
  totalTrade?: string;
  totalVolume?: string;
  totalValue?: string;
  marketStatus?: string; // "K" = kết thúc, "O" = mở, v.v.
  advances?: string; // Số mã tăng
  declines?: string; // Số mã giảm
  noChange?: string; // Số mã đứng
  advancesVolumn?: string;
  declinesVolumn?: string;
  noChangeVolumn?: string;
  marketId?: string;
  numberOfCe?: string; // Số mã trần
  numberOfFl?: string; // Số mã sàn
  PRV_PRIOR_MARKET_INDEX?: string;
  PT_TOTAL_QTTY?: string;
  PT_TOTAL_VALUE?: string;
  PT_TOTAL_TRADE?: string;
  ts?: number;
  kid?: string;
}

const MarketIndexSchema = new Schema<IMarketIndex>(
  {
    marketCode: { type: String, required: true, unique: true },
    tradingdate: String,
    marketIndex: String,
    indexTime: String,
    indexColor: String,
    indexChange: String,
    indexPercentChange: String,
    totalTrade: String,
    totalVolume: String,
    totalValue: String,
    marketStatus: String,
    advances: String,
    declines: String,
    noChange: String,
    advancesVolumn: String,
    declinesVolumn: String,
    noChangeVolumn: String,
    marketId: String,
    numberOfCe: String,
    numberOfFl: String,
    PRV_PRIOR_MARKET_INDEX: String,
    PT_TOTAL_QTTY: String,
    PT_TOTAL_VALUE: String,
    PT_TOTAL_TRADE: String,
    ts: Number,
    kid: String,
  },
  {
    timestamps: false,
    strict: false,
    collection: "indices", // User imported JSON vào collection "indices", không phải "marketindices"
  },
);

// Map sang collection "indices" (tên do user chọn khi import JSON)
const MarketIndex = mongoose.model<IMarketIndex>("MarketIndex", MarketIndexSchema);
export default MarketIndex;
