// frontend/src/types/order.ts
// Các interface dùng chung cho tính năng đặt lệnh mock

export type OrderStatus = "pending" | "partial" | "matched" | "cancelled";
export type OrderSide = "buy" | "sell";
export type OrderType =
  | "LO"
  // "ATO" | "ATC"
  | "MP";

export interface Order {
  id: string;
  symbol: string;
  exchange: string;
  side: OrderSide;
  orderType: OrderType;
  price: number; // Giá đặt (VND). LO: giá thật, ATO/ATC/MP: 0
  quantity: number; // Khối lượng đặt
  filledQuantity: number; // Khối lượng đã khớp
  status: OrderStatus;
  matchedPrice: number | null; // Giá khớp thực tế
  matchedAt: string | null;
  createdAt: string;
}

// Thông tin instrument truyền vào OrderModal để hiển thị giá tham chiếu + validate
export interface OrderInstrumentInfo {
  symbol: string;
  FullName?: string;
  reference: number;
  ceiling: number;
  floor: number;
  closePrice: number;
  bidPrice1: number;
  offerPrice1: number;
  totalTrading?: number; // Tổng KL giao dịch trong ngày — dùng để validate soft cap
}

// Payload nhận từ socket event "order_update" (backend emit sau khi khớp lệnh)
export interface OrderUpdatePayload {
  orderId: string; // id của lệnh (dùng để update trong state)
  userId: string;
  symbol: string;
  exchange: string;
  side: OrderSide;
  orderType: OrderType;
  price: number;
  quantity: number;
  filledQuantity: number;
  status: OrderStatus;
  matchedPrice: number | null;
  matchedAt: string | null;
  cashIn?: number;
  cashOut?: number;
  fee?: number;
  refund?: number;
  lockedReleased?: number;
  matchedQtyDelta?: number;
}
