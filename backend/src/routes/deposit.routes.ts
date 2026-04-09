// src/routes/deposit.routes.ts
// Routes nạp tiền ảo + liên kết ngân hàng — tất cả yêu cầu đăng nhập

import { Router } from "express";
import { authMiddleware } from "../middleware/auth"; // yêu cầu token full
import { linkBank, deposit, getDepositInfo } from "../controllers/depositController";

const router = Router();
router.use(authMiddleware);

// GET  /api/deposit/info      → Thông tin bank + hạn mức + số dư
router.get("/info", getDepositInfo);

// POST /api/deposit/link-bank → Liên kết tài khoản ngân hàng
router.post("/link-bank", linkBank);

// POST /api/deposit           → Nạp tiền ảo
router.post("/", deposit);

export default router;
