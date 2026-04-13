// src/controllers/orderController.ts
// Controller xử lý đặt lệnh, lấy danh sách lệnh, hủy lệnh

import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import Order from "../models/Order";
import Account from "../models/Account";
import Holding from "../models/Holding";
import { getExchangeCache, refreshOrderBookInCache } from "../socket/polling";

// Mức phí giao dịch cố định: 0.15% trên tổng giá trị mỗi lệnh
const FEE_RATE = 0.0015;

// ====================== ĐẶT LỆNH ======================
const placeOrder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { symbol, exchange, side, orderType, price, quantity } = req.body;

    // === Validate đầu vào ===
    if (!symbol || !exchange || !side || !orderType) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc (symbol, exchange, side, orderType)" });
    }

    if (!["HOSE", "HNX", "UPCOM"].includes(exchange)) {
      return res.status(400).json({ message: "Sàn không hợp lệ — chỉ chấp nhận HOSE, HNX, UPCOM" });
    }

    if (!["buy", "sell"].includes(side)) {
      return res.status(400).json({ message: "Side không hợp lệ — chỉ chấp nhận buy, sell" });
    }

    if (!["LO", "ATO", "ATC", "MP"].includes(orderType)) {
      return res.status(400).json({ message: "Loại lệnh không hợp lệ — chỉ chấp nhận LO, ATO, ATC, MP" });
    }

    // Validate giá
    const priceNum = Number(price);
    if (orderType === "LO") {
      if (!priceNum || priceNum <= 0) {
        return res.status(400).json({ message: "Lệnh LO phải có giá > 0" });
      }
    }

    // Validate khối lượng
    const quantityNum = Number(quantity);
    if (!quantityNum || quantityNum < 100 || quantityNum % 100 !== 0) {
      return res.status(400).json({ message: "Khối lượng phải >= 100 và là bội số của 100" });
    }

    // Validate logic giữa loại lệnh và giá
    if (orderType !== "LO" && priceNum && priceNum > 0) {
      return res.status(400).json({
        message: `${orderType} không yêu cầu nhập giá`,
      });
    }

    // === Validate tổng giá trị lệnh ===
    if (orderType === "LO") {
      const totalValue = priceNum * quantityNum;

      const MAX_TOTAL_VALUE = 100_000_000_000; // 100 tỷ

      if (totalValue > MAX_TOTAL_VALUE) {
        return res.status(400).json({
          message: `Giá trị lệnh quá lớn (${totalValue.toLocaleString("vi-VN")} VND). Tối đa cho phép là ${MAX_TOTAL_VALUE.toLocaleString("vi-VN")} VND.`,
        });
      }
    }

    // Hard cap tuyệt đối: 10 triệu cổ phiếu / lệnh
    const ABSOLUTE_MAX_QTY = 10_000_000;
    if (quantityNum > ABSOLUTE_MAX_QTY) {
      return res.status(400).json({
        message: `Khối lượng đặt lệnh quá lớn — tối đa ${ABSOLUTE_MAX_QTY.toLocaleString("vi-VN")} cổ phiếu mỗi lệnh.`,
      });
    }

    // === Kiểm tra mã cổ phiếu có tồn tại trong cache không ===
    const cache = getExchangeCache();
    const symbolUpper = symbol.toUpperCase();
    const exchangeData = cache[exchange];
    if (!exchangeData || !exchangeData.has(symbolUpper)) {
      return res.status(400).json({ message: `Mã ${symbolUpper} không tồn tại trên sàn ${exchange}` });
    }

    // === Lấy instrument từ cache (dùng cho cả validate giá + KL) ===
    const instrument = exchangeData.get(symbolUpper);

    // === Validate giá trong biên trần/sàn (chỉ lệnh LO) ===
    if (orderType === "LO" && instrument) {
      const ceiling = Number(instrument.ceiling) || 0;
      const floor = Number(instrument.floor) || 0;
      if (ceiling > 0 && priceNum > ceiling) {
        return res.status(400).json({ message: `Giá ${priceNum} vượt trần ${ceiling}` });
      }
      if (floor > 0 && priceNum < floor) {
        return res.status(400).json({ message: `Giá ${priceNum} dưới sàn ${floor}` });
      }
    }

    // === Validate khối lượng theo thanh khoản thực tế ===
    if (instrument) {
      const totalTrading = Number(instrument.totalTrading) || 0;

      // Soft cap: không đặt quá 50% tổng KL giao dịch trong ngày (nếu đã có giao dịch)
      // Tránh trường hợp đặt lệnh "mua hết thị trường"
      if (totalTrading > 1000) {
        const softCap = Math.ceil((totalTrading * 0.5) / 100) * 100; // làm tròn lên bội số 100
        if (quantityNum > softCap) {
          return res.status(400).json({
            message: `Khối lượng đặt lệnh (${quantityNum.toLocaleString("vi-VN")}) vượt quá 50% tổng KL giao dịch hôm nay của ${symbolUpper} (${totalTrading.toLocaleString("vi-VN")} cổ phiếu). Khối lượng tối đa cho phép: ${softCap.toLocaleString("vi-VN")}.`,
          });
        }
      }
    }
    // === KHOÁ TÀI SẢN ===
    // Tính giá dùng để khoá (LO → priceNum, ATO/ATC/MP → closePrice)
    const lockPrice = orderType === "LO" ? priceNum : Number(instrument?.closePrice) || 0;
    if (lockPrice <= 0) {
      return res.status(400).json({ message: "Chưa có giá thị trường để xử lý lệnh. Vui lòng thử lại sau." });
    }

    const account = await Account.findOne({ userId });
    if (!account) {
      return res.status(400).json({ message: "Chưa có tài khoản tiền. Vui lòng liên hệ hỗ trợ hoặc nạp tiền trước." });
    }

    if (side === "buy") {
      // MUA: lock tiền = (giá × KL) + phí giao dịch 0.15%
      const totalCost = lockPrice * quantityNum;
      const fee = Math.ceil(totalCost * FEE_RATE); // làm tròn lên để không bao giờ thiếu
      const totalRequired = totalCost + fee;
      if (account.available < totalRequired) {
        const shortfall = totalRequired - account.available;
        return res.status(400).json({
          message: `Số dư không đủ để đặt lệnh mua. Cần ${totalRequired.toLocaleString("vi-VN")} VND (gồm phí ${fee.toLocaleString("vi-VN")} VND), hiện có ${account.available.toLocaleString("vi-VN")} VND (thiếu ${shortfall.toLocaleString("vi-VN")} VND).`,
        });
      }
      account.available -= totalRequired;
      account.locked += totalRequired;
      await account.save();
    } else {
      // BÁN: lock cổ phiếu
      const holding = await Holding.findOne({ userId, symbol: symbolUpper });
      if (!holding || holding.available < quantityNum) {
        const has = holding?.available ?? 0;
        return res.status(400).json({
          message: `Không đủ cổ phiếu ${symbolUpper} để bán. Cần ${quantityNum.toLocaleString("vi-VN")} CP, hiện có ${has.toLocaleString("vi-VN")} CP khả dụng.`,
        });
      }
      holding.available -= quantityNum;
      holding.locked += quantityNum;
      await holding.save();
    }

    // === Lưu lệnh vào MongoDB ===
    const order = await Order.create({
      userId,
      symbol: symbolUpper,
      exchange,
      side,
      orderType,
      price: orderType === "LO" ? priceNum : 0,
      quantity: quantityNum,
      filledQuantity: 0,
      status: "pending",
      matchedPrice: null,
      matchedAt: null,
    });

    // Cập nhật sổ lệnh trong cache ngay khi đặt lệnh → FE nháy flash bid/ask columns
    // Chỉ có ý nghĩa với LO (có giá cụ thể để hiển thị trong order book)
    if (orderType === "LO") {
      refreshOrderBookInCache(exchange, symbolUpper).catch((err) =>
        console.error("[Order] ❌ Lỗi refresh order book sau đặt lệnh:", err)
      );
    }

    return res.status(201).json({
      message: "Đặt lệnh thành công",
      order: {
        id: order._id,
        symbol: order.symbol.toUpperCase(),
        exchange: order.exchange,
        side: order.side,
        orderType: order.orderType,
        price: order.price,
        quantity: order.quantity,
        filledQuantity: order.filledQuantity,
        status: order.status,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    console.error("[Order] ❌ Lỗi đặt lệnh:", error);
    return res.status(500).json({ message: "Lỗi server khi đặt lệnh" });
  }
};

// ====================== LẤY DANH SÁCH LỆNH ======================
const getOrders = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    // Lấy tất cả lệnh của user, mới nhất trước
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).lean();

    return res.json({
      message: "OK",
      orders: orders.map((o) => ({
        id: o._id,
        symbol: o.symbol.toUpperCase(),
        exchange: o.exchange,
        side: o.side,
        orderType: o.orderType,
        price: o.price,
        quantity: o.quantity,
        filledQuantity: o.filledQuantity,
        status: o.status,
        matchedPrice: o.matchedPrice,
        matchedAt: o.matchedAt,
        createdAt: o.createdAt,
      })),
    });
  } catch (error) {
    console.error("[Order] ❌ Lỗi lấy danh sách lệnh:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy lệnh" });
  }
};

// ====================== HỦY LỆNH ======================
const cancelOrder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const orderId = req.params.id;

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy lệnh" });
    }

    if (order.status === "matched") {
      return res.status(400).json({ message: "Lệnh đã khớp — không thể hủy" });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({ message: "Lệnh đã bị hủy trước đó" });
    }

    order.status = "cancelled";
    await order.save();

    // === Mở khoá tài sản khi hủy lệnh ===
    if (order.side === "buy") {
      // Hoàn tiền locked → available
      const lockPrice = order.orderType === "LO" ? order.price : order.matchedPrice || order.price;
      const remainQty = order.quantity - order.filledQuantity;
      const refundAmount = lockPrice * remainQty;
      if (refundAmount > 0) {
        await Account.updateOne({ userId }, { $inc: { available: refundAmount, locked: -refundAmount } });
      }
    } else {
      // Hoàn cổ phiếu locked → available
      const remainQty = order.quantity - order.filledQuantity;
      if (remainQty > 0) {
        await Holding.updateOne({ userId, symbol: order.symbol }, { $inc: { available: remainQty, locked: -remainQty } });
      }
    }

    // Cập nhật order book sau khi hủy để bid/ask columns phản ánh đúng
    if (order.orderType === "LO") {
      refreshOrderBookInCache(order.exchange, order.symbol).catch((err) =>
        console.error("[Order] ❌ Lỗi refresh order book sau hủy lệnh:", err)
      );
    }

    return res.json({
      message: "Hủy lệnh thành công",
      order: {
        id: order._id,
        symbol: order.symbol.toUpperCase(),
        status: order.status,
      },
    });
  } catch (error) {
    console.error("[Order] ❌ Lỗi hủy lệnh:", error);
    return res.status(500).json({ message: "Lỗi server khi hủy lệnh" });
  }
};

export { placeOrder, getOrders, cancelOrder, getBalance, getHoldings };

// ====================== LẤY SỐ DƯ TÀI KHOẢN ======================
async function getBalance(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    const account = await Account.findOne({ userId });
    if (!account) {
      return res.json({ available: 0, locked: 0, total: 0 });
    }
    return res.json({
      available: account.available,
      locked: account.locked,
      total: account.available + account.locked,
    });
  } catch (error) {
    console.error("[Order] ❌ Lỗi lấy số dư:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy số dư" });
  }
}

// ====================== LẤY DANH MỤC CỔ PHIẾU ======================
async function getHoldings(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    const holdings = await Holding.find({ userId }).lean();
    return res.json(
      holdings
        .filter((h) => h.available > 0 || h.locked > 0)
        .map((h) => ({
          symbol: h.symbol,
          available: h.available,
          locked: h.locked,
          avgPrice: h.avgPrice,
          total: h.available + h.locked,
        })),
    );
  } catch (error) {
    console.error("[Order] ❌ Lỗi lấy danh mục:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy danh mục" });
  }
}
