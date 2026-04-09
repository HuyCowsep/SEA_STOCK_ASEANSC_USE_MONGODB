// backend/src/models/Instrument.ts
// Mongoose model cho collection instruments — dữ liệu cổ phiếu tự chủ (không còn phụ thuộc ASEAN)
// Mỗi document = 1 mã cổ phiếu, fields khớp hoàn toàn với cấu trúc JSON import từ ASEAN API

import mongoose, { Document, Schema } from "mongoose";

export interface IInstrument extends Document {
  symbol: string;
  exchange: string;
  FullName?: string;
  StockId?: string;
  tradingdate?: string;
  FloorCode?: string;
  StockType?: string;

  // Giá
  ceiling: number;
  floor: number;
  reference: number;
  closePrice: number;
  closeVol?: number;
  open?: number;
  high?: number;
  low?: number;
  averagePrice?: number;
  change?: number;
  changePercent?: number;

  // Bảng giá mua (bid)
  bidPrice1?: number;
  bidVol1?: number;
  bidPrice2?: number;
  bidVol2?: number;
  bidPrice3?: number;
  bidVol3?: number;

  // Bảng giá bán (offer)
  offerPrice1?: number;
  offerVol1?: number;
  offerPrice2?: number;
  offerVol2?: number;
  offerPrice3?: number;
  offerVol3?: number;

  // Dư mua/bán tổng
  TOTAL_BID_QTTY?: number;
  TOTAL_OFFER_QTTY?: number;

  // Khối lượng & giá trị giao dịch
  totalTrading?: number;
  totalTradingValue?: number;

  // Nước ngoài
  foreignBuy?: number;
  foreignSell?: number;
  foreignRemain?: number;
  foreignRoom?: number;

  // Giao dịch thỏa thuận (Put-through)
  PT_MATCH_PRICE?: number;
  PT_MATCH_QTTY?: number;
  PT_TOTAL_TRADED_QTTY?: number;
  PT_TOTAL_TRADED_VALUE?: number;

  // Metadata
  Status?: string;
  symbolStatusCode?: string;
  ListedShare?: string;
  TotalListingQtty?: string;
  IssuerName?: string;
  ExercisePrice?: string;

  ts?: number;
  kid?: string;
}

const InstrumentSchema = new Schema<IInstrument>(
  {
    symbol: { type: String, required: true },
    exchange: { type: String, required: true, enum: ["HOSE", "HNX", "UPCOM"] },
    FullName: String,
    StockId: String,
    tradingdate: String,
    FloorCode: String,
    StockType: String,

    ceiling: { type: Number, default: 0 },
    floor: { type: Number, default: 0 },
    reference: { type: Number, default: 0 },
    closePrice: { type: Number, default: 0 },
    closeVol: { type: Number, default: 0 },
    open: { type: Number, default: 0 },
    high: { type: Number, default: 0 },
    low: { type: Number, default: 0 },
    averagePrice: { type: Number, default: 0 },
    change: { type: Number, default: 0 },
    changePercent: { type: Number, default: 0 },

    bidPrice1: { type: Number, default: 0 },
    bidVol1: { type: Number, default: 0 },
    bidPrice2: { type: Number, default: 0 },
    bidVol2: { type: Number, default: 0 },
    bidPrice3: { type: Number, default: 0 },
    bidVol3: { type: Number, default: 0 },

    offerPrice1: { type: Number, default: 0 },
    offerVol1: { type: Number, default: 0 },
    offerPrice2: { type: Number, default: 0 },
    offerVol2: { type: Number, default: 0 },
    offerPrice3: { type: Number, default: 0 },
    offerVol3: { type: Number, default: 0 },

    TOTAL_BID_QTTY: { type: Number, default: 0 },
    TOTAL_OFFER_QTTY: { type: Number, default: 0 },

    totalTrading: { type: Number, default: 0 },
    totalTradingValue: { type: Number, default: 0 },

    foreignBuy: { type: Number, default: 0 },
    foreignSell: { type: Number, default: 0 },
    foreignRemain: { type: Number, default: 0 },
    foreignRoom: { type: Number, default: 0 },

    PT_MATCH_PRICE: { type: Number, default: 0 },
    PT_MATCH_QTTY: { type: Number, default: 0 },
    PT_TOTAL_TRADED_QTTY: { type: Number, default: 0 },
    PT_TOTAL_TRADED_VALUE: { type: Number, default: 0 },

    Status: String,
    symbolStatusCode: String,
    ListedShare: String,
    TotalListingQtty: String,
    IssuerName: String,
    ExercisePrice: String,

    ts: Number,
    kid: String,
  },
  {
    // Tắt timestamps tự động — dùng tradingdate của ASEAN thay thế
    timestamps: false,
    // strict: false cho phép lưu thêm các field ASEAN gửi mà ta chưa khai báo
    strict: false,
  },
);

// Index để query nhanh theo sàn và theo mã
InstrumentSchema.index({ exchange: 1 });
InstrumentSchema.index({ symbol: 1 }, { unique: true });

// Mongoose sẽ map vào collection "instruments" (tự động thêm "s")
const Instrument = mongoose.model<IInstrument>("Instrument", InstrumentSchema);
export default Instrument;
