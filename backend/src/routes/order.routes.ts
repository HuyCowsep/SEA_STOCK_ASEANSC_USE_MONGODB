// src/routes/order.routes.ts

import { Router } from "express";
import { authMiddleware } from "../middleware/auth"; // yêu cầu token full
import { placeOrder, getOrders, cancelOrder, getBalance, getHoldings } from "../controllers/orderController";

const router = Router();
router.use(authMiddleware);

// POST /api/orders          → Đặt lệnh mới
router.post("/", placeOrder);

// GET  /api/orders          → Lấy danh sách lệnh của user
router.get("/", getOrders);

// GET  /api/orders/balance   → Số dư tài khoản (available, locked và tổng)
router.get("/balance", getBalance);

// GET  /api/orders/holdings  → Danh mục cổ phiếu nắm giữ
router.get("/holdings", getHoldings);

// DELETE /api/orders/:id    → Hủy lệnh (chỉ pending/partial)
router.delete("/:id", cancelOrder);

export default router;
