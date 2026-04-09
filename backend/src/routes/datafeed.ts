// src/routes/datafeed.ts
// Trả dữ liệu từ MongoDB thay vì proxy ASEAN — không còn phụ thuộc bên ngoài

import { Router, Request, Response } from "express";
import axios from "axios";
import mongoose from "mongoose";
import Instrument from "../models/Instrument";
import MarketIndex from "../models/MarketIndex";

const router = Router();

// ====================== DATAFEED ======================

/**
 * GET /api/datafeed/instruments?exchange=HOSE|HNX|UPCOM
 * GET /api/datafeed/instruments?symbols=AAA,BBB,CCC
 * Trả dữ liệu cổ phiếu từ MongoDB
 */
router.get("/instruments", async (req: Request, res: Response) => {
  try {
    const { exchange, symbols } = req.query as { exchange?: string; symbols?: string };

    let docs: Record<string, unknown>[];

    if (symbols) {
      const symbolList = symbols.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      docs = await Instrument.find({ symbol: { $in: symbolList } }).lean() as unknown as Record<string, unknown>[];
    } else if (exchange) {
      docs = await Instrument.find({ exchange: exchange.toUpperCase() }).lean() as unknown as Record<string, unknown>[];
    } else {
      docs = await Instrument.find({}).lean() as unknown as Record<string, unknown>[];
    }

    res.json({ s: "ok", d: docs });
  } catch (err) {
    console.error("Lỗi fetch instruments từ DB:", err);
    res.status(500).json({ s: "error", message: "Không thể lấy dữ liệu instruments" });
  }
});

/**
 * GET /api/datafeed/instruments/:code
 * Lấy danh sách mã theo nhóm chỉ số (VN30, HNX30...) từ indexcomponents collection
 * Ví dụ: /api/datafeed/instruments/30
 */
router.get("/instruments/:code", async (req: Request, res: Response) => {
  try {
    const code = req.params.code as string;
    // ASEAN API trả d là mảng symbol string: ["ACB","BID",...]
    const response = await axios.get(
      `https://seastock.aseansc.com.vn/datafeed/instruments/${encodeURIComponent(code)}`,
    );
    if (response.data.s !== "ok" || !Array.isArray(response.data.d)) {
      res.json({ s: "ok", d: [] });
      return;
    }
    const symbolList: string[] = response.data.d;
    const docs = await Instrument.find({ symbol: { $in: symbolList } }).lean();
    res.json({ s: "ok", d: docs });
  } catch (err) {
    console.error(`Lỗi fetch instruments/${req.params.code}:`, err);
    res.status(500).json({ s: "error", message: "Không thể lấy dữ liệu instruments" });
  }
});

/**
 * GET /api/datafeed/m-instruments
 * Danh sách mã mua ký quỹ — ko có và ko dùng trong MongoDB
 */
router.get("/m-instruments", async (_req: Request, res: Response) => {
  res.json({ s: "ok", d: [] });
});

/**
 * GET /api/datafeed/indexsnaps/:codes
 * Lấy chỉ số thị trường từ MongoDB (collection "indices")
 * Ví dụ: /api/datafeed/indexsnaps/HOSE,30,HNX,HNX30,UPCOM
 */
router.get("/indexsnaps/:codes", async (req: Request, res: Response) => {
  try {
    const codes = (req.params.codes as string).split(",").map((c) => c.trim()).filter(Boolean);
    const docs = await MarketIndex.find({ marketCode: { $in: codes } }).lean();
    res.json({ s: "ok", d: docs });
  } catch (err) {
    console.error("Lỗi fetch indexsnaps từ MongoDB:", err);
    res.status(500).json({ s: "error", message: "Không thể lấy dữ liệu indexsnaps" });
  }
});

/**
 * GET /api/datafeed/chartinday/:code
 * Vẫn proxy sang ASEAN — dữ liệu chart không lưu DB
 */
router.get("/chartinday/:code", async (req: Request, res: Response) => {
  try {
    const code = req.params.code as string;
    const response = await axios.get(
      `https://seastock.aseansc.com.vn/datafeed/chartinday/${encodeURIComponent(code)}`,
    );
    res.json(response.data);
  } catch (err) {
    console.error(`Lỗi fetch chartinday/${req.params.code}:`, err);
    res.status(500).json({ s: "error", message: "Không thể lấy dữ liệu chart" });
  }
});

// ====================== USERDATA ======================

/**
 * GET /api/datafeed/industry
 * Lấy danh sách CP ngành từ MongoDB (collection "industries")
 */
router.get("/industry", async (_req: Request, res: Response) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      res.status(500).json({ s: "error", message: "MongoDB chưa kết nối" });
      return;
    }
    const docs = await db.collection("industries").find({}).toArray();
    res.json({ s: "ok", d: docs });
  } catch (err) {
    console.error("Lỗi fetch industry từ MongoDB:", err);
    res.status(500).json({ s: "error", message: "Không thể lấy dữ liệu ngành" });
  }
});

/**
 * GET /api/datafeed/time
 * Trả server time hiện tại (không cần ASEAN)
 */
router.get("/time", (_req: Request, res: Response) => {
  res.json({ s: "ok", d: { currentTimeDb: new Date().toISOString() } });
});

export default router;