// src/controllers/depositController.ts
// Quản lý nạp tiền ảo + liên kết ngân hàng

import { Request, Response } from "express";
import Account from "../models/Account";

// === GIỚI HẠN NẠP TIỀN ===
const MAX_DEPOSIT_PER_TRANSACTION = 5_000_000_000; // 5 tỷ / lần
const MIN_DEPOSIT_PER_TRANSACTION = 100_000; // 100k / lần
const MAX_DEPOSIT_PER_DAY = 10_000_000_000; // 10 tỷ / ngày

// Helper: lấy ngày hiện tại dạng "YYYY-MM-DD"
const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Format số VND cho message
const fmtVND = (n: number) => n.toLocaleString("vi-VN") + " VND";

// ============================================================
// POST /api/deposit/link-bank — Liên kết tài khoản ngân hàng
// Body: { bankAccount: "123456789", bankName: "Vietcombank" }
// ============================================================
const linkBank = async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;

    const bankAccount = typeof req.body?.bankAccount === "string" ? req.body.bankAccount.trim() : "";
    const bankName = typeof req.body?.bankName === "string" ? req.body.bankName.trim() : "";

    if (!bankAccount) {
      return res.status(400).json({ message: "Vui lòng nhập số tài khoản ngân hàng" });
    }
    if (!bankName) {
      return res.status(400).json({ message: "Vui lòng chọn ngân hàng" });
    }

    // Validate: chỉ chấp nhận số, 6-20 ký tự
    if (!/^\d{6,20}$/.test(bankAccount)) {
      return res.status(400).json({ message: "Số tài khoản không hợp lệ (6-20 chữ số)" });
    }

    const account = await Account.findOne({ userId });
    if (!account) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    account.bankAccount = bankAccount;
    account.bankName = bankName;
    await account.save();

    return res.json({
      message: `Đã liên kết tài khoản ${bankName} — ****${bankAccount.slice(-4)}`,
      bankAccount: account.bankAccount,
      bankName: account.bankName,
    });
  } catch (error) {
    console.error("[deposit.linkBank] error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

// ============================================================
// POST /api/deposit — Nạp tiền ảo
// Body: { amount: 50000000 }
// Yêu cầu: đã liên kết ngân hàng, validate giới hạn/ngày
// ============================================================
const deposit = async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;

    const rawAmount = req.body?.amount;
    const amount = typeof rawAmount === "number" ? rawAmount : typeof rawAmount === "string" ? Number(rawAmount) : NaN;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Số tiền không hợp lệ" });
    }

    // Giới hạn / lần
    if (amount < MIN_DEPOSIT_PER_TRANSACTION) {
      return res.status(400).json({
        message: `Nạp số tiền tối thiểu ${fmtVND(MIN_DEPOSIT_PER_TRANSACTION)} / lần`,
      });
    }
    if (amount > MAX_DEPOSIT_PER_TRANSACTION) {
      return res.status(400).json({
        message: `Nạp số tiền tối đa ${fmtVND(MAX_DEPOSIT_PER_TRANSACTION)} / lần`,
      });
    }

    // Chỉ chấp nhận bội số 1000
    if (amount % 1000 !== 0) {
      return res.status(400).json({ message: "Số tiền phải là bội số của 1,000 VND" });
    }

    const account = await Account.findOne({ userId });
    if (!account) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    // Phải liên kết ngân hàng trước
    if (!account.bankAccount) {
      return res.status(400).json({ message: "Vui lòng liên kết tài khoản ngân hàng trước khi nạp tiền" });
    }

    // Giới hạn / ngày — reset nếu sang ngày mới
    const today = getTodayStr();
    if (account.lastDepositDate !== today) {
      account.dailyDeposited = 0;
      account.lastDepositDate = today;
    }

    const remainingToday = MAX_DEPOSIT_PER_DAY - account.dailyDeposited;
    if (amount > remainingToday) {
      return res.status(400).json({
        message: `Bạn đã vượt hạn mức nạp trong ngày. Còn lại hôm nay: ${fmtVND(remainingToday)} (Tối đa ${fmtVND(MAX_DEPOSIT_PER_DAY)} / ngày)`,
      });
    }

    // Cộng tiền
    account.available += amount;
    account.dailyDeposited += amount;
    await account.save();

    return res.json({
      message: `Nạp tiền thành công, số tiền: ${fmtVND(amount)}`,
      available: account.available,
      locked: account.locked,
      total: account.available + account.locked,
      dailyDeposited: account.dailyDeposited,
      dailyRemaining: MAX_DEPOSIT_PER_DAY - account.dailyDeposited,
    });
  } catch (error) {
    console.error("[deposit.deposit] error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

// ============================================================
// GET /api/deposit/info — Lấy thông tin nạp tiền (bank + hạn mức)
// ============================================================
const getDepositInfo = async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;

    const account = await Account.findOne({ userId });
    if (!account) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    // Reset daily nếu sang ngày mới
    const today = getTodayStr();
    if (account.lastDepositDate !== today) {
      account.dailyDeposited = 0;
      account.lastDepositDate = today;
      await account.save();
    }

    return res.json({
      bankAccount: account.bankAccount,
      bankName: account.bankName,
      hasBankLinked: !!account.bankAccount,
      available: account.available,
      locked: account.locked,
      total: account.available + account.locked,
      dailyDeposited: account.dailyDeposited,
      dailyRemaining: MAX_DEPOSIT_PER_DAY - account.dailyDeposited,
      limits: {
        minPerTransaction: MIN_DEPOSIT_PER_TRANSACTION,
        maxPerTransaction: MAX_DEPOSIT_PER_TRANSACTION,
        maxPerDay: MAX_DEPOSIT_PER_DAY,
      },
    });
  } catch (error) {
    console.error("[deposit.getDepositInfo] error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

export { linkBank, deposit, getDepositInfo };
