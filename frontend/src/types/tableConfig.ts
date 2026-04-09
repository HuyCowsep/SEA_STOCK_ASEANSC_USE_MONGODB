// Shared types & constants cho Dashboard — tách ra để tránh react-refresh warning

export interface UnitSettings {
  volume: 1 | 10 | 100;
  price: 1 | 1000;
  value: 1000000 | 1000000000;
}

// Cài đặt hiển thị cột — true = hiện, false = ẩn (per sub-column)
export interface ColumnVisibility {
  // Standalone
  symbol: boolean;
  exchange: boolean;        // Sàn (giao dịch)
  reference: boolean;       // TC
  ceiling: boolean;         // Trần
  floor: boolean;           // Sàn (giá sàn)
  totalTrading: boolean;    // Tổng KL
  totalValue: boolean;      // Tổng GT (= totalTrading × averagePrice)
  // Bên mua
  bidPrice1: boolean;
  bidPrice2: boolean;
  bidPrice3: boolean;
  bidVol1: boolean;
  bidVol2: boolean;
  bidVol3: boolean;
  // Khớp lệnh
  matchPrice: boolean;
  matchVol: boolean;
  matchChange: boolean;
  matchChangePercent: boolean;
  // Bên bán
  offerPrice1: boolean;
  offerPrice2: boolean;
  offerPrice3: boolean;
  offerVol1: boolean;
  offerVol2: boolean;
  offerVol3: boolean;
  // Giá
  priceHigh: boolean;
  priceAvg: boolean;
  priceLow: boolean;
  // Dư
  surplusBid: boolean;
  surplusOffer: boolean;
  // ĐTNN
  foreignBuy: boolean;
  foreignSell: boolean;
  foreignRemain: boolean;
}

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  symbol: true,
  exchange: false, // Mặc định ẩn
  reference: true,
  ceiling: true,
  floor: true,
  totalTrading: true,
  totalValue: false, // Mặc định ẩn
  bidPrice1: true, bidPrice2: true, bidPrice3: true,
  bidVol1: true, bidVol2: true, bidVol3: true,
  matchPrice: true, matchVol: true, matchChange: true, matchChangePercent: true,
  offerPrice1: true, offerPrice2: true, offerPrice3: true,
  offerVol1: true, offerVol2: true, offerVol3: true,
  priceHigh: true, priceAvg: true, priceLow: true,
  surplusBid: false, surplusOffer: false,       // Mặc định ẩn
  foreignBuy: true, foreignSell: true,
  foreignRemain: false,                          // Mặc định ẩn
};
