// src/socket/matchingEngine.ts
// Mock matching engine — so sánh giá đặt vs giá thật từ ASEAN cache
// Chạy mỗi 2 giây, duyệt tất cả lệnh pending/partial và khớp nếu điều kiện thỏa

import { Server } from "socket.io";
import Order, { IOrder } from "../models/Order";
import Account from "../models/Account";
import Holding from "../models/Holding";
import Instrument from "../models/Instrument";
import { getExchangeCache, markInstrumentChanged } from "./polling";

// Mức phí giao dịch cố định: 0.15% trên tổng giá trị mỗi lệnh (đồng bộ với orderController)
const FEE_RATE = 0.0015;

let engineInterval: ReturnType<typeof setInterval> | null = null;

export function startMatchingEngine(io: Server) {
  if (engineInterval) {
    console.log("[MatchingEngine] ⚠️ Engine đã chạy rồi, bỏ qua");
    return;
  }

  console.log("[MatchingEngine] 🚀 Khởi động mock matching engine (interval: 2s)");

  engineInterval = setInterval(async () => {
    try {
      // Lấy tất cả lệnh đang chờ khớp
      const pendingOrders = await Order.find({
        status: { $in: ["pending", "partial"] },
      }).sort({ createdAt: 1 }); // xử lý các lệnh cũ nhất -> mới nhất

      if (pendingOrders.length === 0) return;

      const cache = getExchangeCache();

      for (const order of pendingOrders) {
        await tryMatchOrder(order, cache, io);
      }
    } catch (err) {
      console.error("[MatchingEngine] ❌ Lỗi trong vòng lặp matching:", err);
    }
  }, 2000);
}

// Thử khớp 1 lệnh dựa trên giá realtime từ cache
async function tryMatchOrder(order: IOrder, cache: Record<string, Map<string, Record<string, unknown>>>, io: Server) {
  const exchangeData = cache[order.exchange];
  if (!exchangeData) return;

  const instrument = exchangeData.get(order.symbol);
  if (!instrument) return;

  // Lệnh ATO/ATC/MP — khớp ngay tại giá closePrice (giá khớp hiện tại)
  if (order.orderType === "ATO" || order.orderType === "ATC" || order.orderType === "MP") {
    const closePrice = Number(instrument.closePrice) || 0;
    if (closePrice <= 0) return; // chưa có giá → bỏ qua

    await matchFull(order, closePrice, io);
    return;
  }

  // Lệnh LO — so sánh giá đặt vs giá bid/offer: bán tốt nhất (offerPrice1) nếu mua, hoặc giá mua tốt nhất (bidPrice1) nếu bán
  if (order.side === "buy") {
    // MUA: giá đặt >= giá bán tốt nhất (offerPrice1) → khớp
    const offerPrice = Number(instrument.offerPrice1) || 0;
    const offerVol = Number(instrument.offerVol1) || 0;

    if (offerPrice <= 0 || offerVol <= 0) return; // chưa có giá bán → bỏ qua
    if (order.price >= offerPrice) {
      await matchFull(order, offerPrice, io);
    }
  } else {
    // BÁN: giá đặt <= giá mua tốt nhất (bidPrice1) → khớp
    const bidPrice = Number(instrument.bidPrice1) || 0;
    const bidVol = Number(instrument.bidVol1) || 0;

    if (bidPrice <= 0 || bidVol <= 0) return; // chưa có giá mua → bỏ qua
    if (order.price <= bidPrice) {
      await matchFull(order, bidPrice, io);
    }
  }
}

// Khớp toàn bộ lệnh + chuyển đổi tài sản
async function matchFull(order: IOrder, matchedPrice: number, io: Server) {
  const matchedQty = order.quantity - order.filledQuantity;
  const matchedValue = matchedPrice * matchedQty;

  order.status = "matched";
  order.filledQuantity = order.quantity;
  order.matchedPrice = matchedPrice;
  order.matchedAt = new Date();
  await order.save();

  // === CHUYỂN ĐỔI TÀI SẢN ===
  const userId = order.userId;

  if (order.side === "buy") {
    // MUA khớp:
    // - Số tiền thực trả = matchedPrice × matchedQty + phí
    // - Số tiền đã lock = lockPrice × matchedQty + phí (tính theo lockPrice)
    // - Hoàn lại phần chênh lệch (nếu giá khớp thấp hơn giá đặt)
    const lockPrice = order.orderType === "LO" ? order.price : matchedPrice;
    const lockedFee = Math.ceil(lockPrice * matchedQty * FEE_RATE);
    const lockedAmount = lockPrice * matchedQty + lockedFee; // tổng tiền đã lock khi đặt lệnh

    const actualFee = Math.ceil(matchedPrice * matchedQty * FEE_RATE); // phí thực tế tính theo giá khớp
    const actualDeducted = matchedPrice * matchedQty + actualFee; // tiền thực trả (CP + phí)
    const refund = lockedAmount - actualDeducted; // hoàn lại phần dư (nếu có)

    await Account.updateOne({ userId }, { $inc: { locked: -lockedAmount, available: refund } });

    // Cập nhật hoặc tạo holding — tính giá vốn trung bình (không tính phí sàn vào avgPrice)
    const holding = await Holding.findOne({ userId, symbol: order.symbol });
    if (holding) {
      const totalQty = holding.available + matchedQty;
      const totalCost = holding.avgPrice * holding.available + matchedPrice * matchedQty;
      holding.avgPrice = totalQty > 0 ? Math.round(totalCost / totalQty) : 0;
      holding.available += matchedQty;
      await holding.save();
    } else {
      await Holding.create({
        userId,
        symbol: order.symbol,
        available: matchedQty,
        locked: 0,
        avgPrice: matchedPrice,
      });
    }

    console.log(
      `[MatchingEngine] 💰 Khớp Lệnh MUA: Đã trừ -${lockedAmount.toLocaleString()}, Hoàn dư +${refund.toLocaleString()}, Phí: ${actualFee.toLocaleString()}, Nhận +${matchedQty} ${order.symbol}`,
    );

    // Cập nhật bảng giá MongoDB + push delta qua socket → để FE nháy flash
    const buyInstr = await Instrument.findOne({ symbol: order.symbol }).lean();
    if (buyInstr) {
      const newTotalTrading = (Number(buyInstr.totalTrading) || 0) + matchedQty;
      const newOfferVol1 = Math.max(0, (Number(buyInstr.offerVol1) || 0) - matchedQty);
      const ref = Number(buyInstr.reference) || 0;
      const buyUpdated: Record<string, unknown> = {
        closePrice: matchedPrice,
        totalTrading: newTotalTrading,
        offerVol1: newOfferVol1,
        change: ref ? matchedPrice - ref : 0,
        changePercent: ref ? ((matchedPrice - ref) / ref) * 100 : 0,
      };
      await Instrument.updateOne({ symbol: order.symbol }, { $set: buyUpdated });
      markInstrumentChanged(order.exchange, order.symbol, buyUpdated);
    }
  } else {
    // BÁN khớp: cổ phiếu locked được giải phóng, tiền nhận = matchedValue - phí 0.15%
    const fee = Math.ceil(matchedValue * FEE_RATE);
    const netReceived = matchedValue - fee; // tiền thực nhận sau khi trừ phí

    await Holding.updateOne({ userId, symbol: order.symbol }, { $inc: { locked: -matchedQty } });
    await Account.updateOne({ userId }, { $inc: { available: netReceived } });

    console.log(
      `[MatchingEngine] 💰 Khớp Lệnh BÁN: Trừ -${matchedQty} ${order.symbol}, Phí: ${fee.toLocaleString()}, +${netReceived.toLocaleString()} thực nhận`,
    );

    // Cập nhật bảng giá MongoDB + push delta qua socket → để FE nháy flash
    const sellInstr = await Instrument.findOne({ symbol: order.symbol }).lean();
    if (sellInstr) {
      const newTotalTrading = (Number(sellInstr.totalTrading) || 0) + matchedQty;
      const newBidVol1 = Math.max(0, (Number(sellInstr.bidVol1) || 0) - matchedQty);
      const ref = Number(sellInstr.reference) || 0;
      const sellUpdated: Record<string, unknown> = {
        closePrice: matchedPrice,
        totalTrading: newTotalTrading,
        bidVol1: newBidVol1,
        change: ref ? matchedPrice - ref : 0,
        changePercent: ref ? ((matchedPrice - ref) / ref) * 100 : 0,
      };
      await Instrument.updateOne({ symbol: order.symbol }, { $set: sellUpdated });
      markInstrumentChanged(order.exchange, order.symbol, sellUpdated);
    }
  }

  console.log(
    `[MatchingEngine] ✅ KHỚP LỆNH — orderId: ${order._id} | ${order.side} ${order.symbol} | ` +
      `giá đặt: ${order.price} → giá khớp: ${matchedPrice} | KL: ${order.quantity}`,
  );

  // Emit socket event cho frontend của user đó
  // Frontend lắng nghe event "order_update" để cập nhật sổ lệnh realtime
  io.emit("order_update", {
    orderId: order._id,
    userId: order.userId.toString(),
    symbol: order.symbol,
    exchange: order.exchange,
    side: order.side,
    orderType: order.orderType,
    price: order.price,
    quantity: order.quantity,
    filledQuantity: order.filledQuantity,
    status: order.status,
    matchedPrice: order.matchedPrice,
    matchedAt: order.matchedAt,
  });
}

export function stopMatchingEngine() {
  if (engineInterval) {
    clearInterval(engineInterval);
    engineInterval = null;
    console.log("[MatchingEngine] 🛑 Đã dừng matching engine");
  }
}
