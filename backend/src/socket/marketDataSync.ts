// backend/src/socket/marketDataSync.ts

//   startPolling(io)
//     → loadInitialDataFromDB()      ← đọc MongoDB thay vì gọi ASEAN REST
//     → io.on("connection")          ← khi FE connect, gửi snapshot từ cache
//     → markInstrumentChanged()      ← matchingEngine gọi sau khi khớp lệnh
//     → broadcastDeltaImmediately()  ← emit delta sang FE → FE nháy flash cell

import axios from "axios";
import { Server, Socket } from "socket.io";
import Instrument from "../models/Instrument";
import MarketIndex from "../models/MarketIndex";
import Order from "../models/Order";

// ChartInday vẫn lấy từ ASEAN để biểu đồ động đẹp
const BASE_URL = "https://seastock.aseansc.com.vn";
const EXCHANGES = ["HOSE", "HNX", "UPCOM"] as const;
const VALID_ROOMS = ["HOSE", "HNX", "UPCOM", "30", "HNX30"] as const;
const CHART_CODES = ["HOSE", "30", "HNX", "HNX30", "UPCOM"];

// ====================== CACHE IN-MEMORY ======================
// Sau khi đọc từ MongoDB, data được giữ trong Map để serve nhanh cho FE
// Không query MongoDB mỗi lần FE subscribe — chỉ load 1 lần khi server khởi động
// Cấu trúc: exchangeCache["HOSE"].get("VNM") → { symbol, closePrice, bidPrice1, ... }
const exchangeCache: Record<string, Map<string, Record<string, unknown>>> = {
  HOSE: new Map(),
  HNX: new Map(),
  UPCOM: new Map(),
};

// Getter — matchingEngine và orderController dùng để tra giá realtime
export function getExchangeCache() {
  return exchangeCache;
}

// Danh sách mã VN30 / HNX30
let vn30Symbols: string[] = [];
let hnx30Symbols: string[] = [];

// Delta tracking: instruments đã thay đổi kể từ lần broadcast trước
// matchingEngine sẽ gọi markInstrumentChanged() sau khi update MongoDB
const changedInstruments: Record<string, Map<string, Record<string, unknown>>> = {
  HOSE: new Map(),
  HNX: new Map(),
  UPCOM: new Map(),
};

// Cache chart (chartinday vẫn lấy từ ASEAN)
let latestChartData: Record<string, unknown> = {};

let ioRef: Server | null = null;

// ====================== LOAD DATA TỪ MONGODB ======================
async function loadInitialDataFromDB() {
  console.log("📦 Đang load data từ MongoDB...");

  // --- Load danh sách mã VN30 / HNX30 từ ASEAN API ---
  // ASEAN trả { s: "ok", d: ["ACB", "BID", ...] } — d là mảng string symbol
  // VN30 dùng code "30", HNX30 dùng code "HNX30"
  try {
    const [vn30Res, hnx30Res] = await Promise.all([
      axios.get(`${BASE_URL}/datafeed/instruments/30`),
      axios.get(`${BASE_URL}/datafeed/instruments/HNX30`),
    ]);
    if (vn30Res.data.s === "ok" && Array.isArray(vn30Res.data.d)) vn30Symbols = vn30Res.data.d as string[];
    if (hnx30Res.data.s === "ok" && Array.isArray(hnx30Res.data.d)) hnx30Symbols = hnx30Res.data.d as string[];
    console.log(`  ✅ VN30: ${vn30Symbols.length} mã, HNX30: ${hnx30Symbols.length} mã`);
  } catch (err) {
    console.error("  ❌ Lỗi load VN30/HNX30 từ ASEAN API:", err);
  }

  // --- Load toàn bộ cổ phiếu từ collection instruments ---
  for (const exchange of EXCHANGES) {
    try {
      // .lean() trả plain object thay vì Mongoose Document — nhanh hơn đáng kể
      const docs = await Instrument.find({ exchange }).lean();
      const cache = new Map<string, Record<string, unknown>>();
      for (const doc of docs) {
        if (doc.symbol) {
          // Stringify _id để FE không bị lỗi khi JSON.stringify
          cache.set(doc.symbol, { ...doc, _id: doc._id?.toString() });
        }
      }
      exchangeCache[exchange] = cache;
      console.log(`  ✅ Sàn ${exchange}: có ${cache.size} mã cổ phiếu`);
    } catch (err) {
      console.error(`  ❌ Lỗi load ${exchange} từ MongoDB:`, err);
    }
  }
}

// ====================== REFRESH ORDER BOOK — GỌI SAU KHI ĐẶT/HỦY/KHỚP LỆNH ======================
// Tổng hợp tất cả lệnh LO pending/partial cho symbol, tính top 3 bid/ask, cập nhật cache và broadcast
// FE sẽ thấy các cột bidPrice1/bidVol1... offerPrice1/offerVol1... thay đổi ngay khi lệnh được đặt
export async function refreshOrderBookInCache(exchange: string, symbol: string): Promise<void> {
  const cache = exchangeCache[exchange];
  if (!cache || !cache.has(symbol)) return;

  // Lấy tất cả lệnh LO còn pending/partial cho mã này
  const pendingOrders = await Order.find({
    symbol,
    exchange,
    orderType: "LO",
    status: { $in: ["pending", "partial"] },
  }).lean();

  // Nhóm theo giá, cộng KL còn lại
  const bidMap = new Map<number, number>();
  const offerMap = new Map<number, number>();

  for (const order of pendingOrders) {
    const remainQty = order.quantity - order.filledQuantity;
    if (remainQty <= 0) continue;
    if (order.side === "buy") {
      bidMap.set(order.price, (bidMap.get(order.price) || 0) + remainQty);
    } else {
      offerMap.set(order.price, (offerMap.get(order.price) || 0) + remainQty);
    }
  }

  // Bên MUA: giá cao nhất ưu tiên (top bid), bên BÁN: giá thấp nhất ưu tiên (top ask)
  const bids = Array.from(bidMap.entries()).sort((a, b) => b[0] - a[0]);
  const offers = Array.from(offerMap.entries()).sort((a, b) => a[0] - b[0]);

  const updatedFields: Record<string, unknown> = {
    bidPrice1: bids[0]?.[0] ?? 0,
    bidVol1: bids[0]?.[1] ?? 0,
    bidPrice2: bids[1]?.[0] ?? 0,
    bidVol2: bids[1]?.[1] ?? 0,
    bidPrice3: bids[2]?.[0] ?? 0,
    bidVol3: bids[2]?.[1] ?? 0,
    offerPrice1: offers[0]?.[0] ?? 0,
    offerVol1: offers[0]?.[1] ?? 0,
    offerPrice2: offers[1]?.[0] ?? 0,
    offerVol2: offers[1]?.[1] ?? 0,
    offerPrice3: offers[2]?.[0] ?? 0,
    offerVol3: offers[2]?.[1] ?? 0,
  };

  markInstrumentChanged(exchange, symbol, updatedFields);
}

// ====================== MARK CHANGED — GỌI TỪ matchingEngine ======================
// Sau khi matchingEngine update instrument trong MongoDB, gọi hàm này để:
//   1. Đồng bộ thay đổi vào cache in-memory
//   2. Đánh dấu instrument đã thay đổi
//   3. Gọi broadcastDeltaImmediately() → emit socket → FE nháy flash
//
// Đây là cầu nối giữa "khớp lệnh" và "bảng giá nháy flash"
export function markInstrumentChanged(exchange: string, symbol: string, updatedFields: Record<string, unknown>) {
  const cache = exchangeCache[exchange];
  if (!cache) return;

  const existing = cache.get(symbol);
  if (!existing) return;

  // Merge vào cache
  Object.assign(existing, updatedFields);

  // Đánh dấu để broadcast
  if (changedInstruments[exchange]) {
    changedInstruments[exchange].set(symbol, existing);
  }

  // Emit ngay — không chờ interval
  broadcastDeltaImmediately();
}

// ====================== BROADCAST DELTA ======================
// Gửi DELTA (chỉ những instrument đã thay đổi) xuống đúng ROOM, giúp FE nháy flash cell
function broadcastDeltaImmediately() {
  if (!ioRef) return;
  const roomsToUpdate = new Set<string>();

  if (changedInstruments["HOSE"].size > 0) {
    roomsToUpdate.add("HOSE");
    roomsToUpdate.add("30"); // VN30 là tập con của HOSE
  }
  if (changedInstruments["HNX"].size > 0) {
    roomsToUpdate.add("HNX");
    roomsToUpdate.add("HNX30"); // HNX30 là tập con của HNX
  }
  if (changedInstruments["UPCOM"].size > 0) {
    roomsToUpdate.add("UPCOM");
  }

  for (const room of roomsToUpdate) {
    const data = buildDelta(room);
    if (!data) continue;
    ioRef.to(`exchange:${room}`).emit("instruments_data", data);
  }

  // Xoá sau khi đã broadcast
  for (const exchange of EXCHANGES) {
    changedInstruments[exchange].clear();
  }
}

// ====================== BUILD RESPONSE ======================
// Full snapshot — gửi 1 lần duy nhất khi client mới subscribe vào room
function buildFullSnapshot(room: string): { s: string; d: Record<string, unknown>[]; _serverEmitTime: number; _type: "snapshot" } | null {
  const timestamp = Date.now();

  if (room === "30") {
    const hoseCache = exchangeCache["HOSE"];
    const instruments = vn30Symbols.map((sym) => hoseCache.get(sym)).filter(Boolean) as Record<string, unknown>[];
    return instruments.length > 0 ? { s: "ok", d: instruments, _serverEmitTime: timestamp, _type: "snapshot" } : null;
  } else if (room === "HNX30") {
    const hnxCache = exchangeCache["HNX"];
    const instruments = hnx30Symbols.map((sym) => hnxCache.get(sym)).filter(Boolean) as Record<string, unknown>[];
    return instruments.length > 0 ? { s: "ok", d: instruments, _serverEmitTime: timestamp, _type: "snapshot" } : null;
  } else {
    const cache = exchangeCache[room];
    if (!cache || cache.size === 0) return null;
    return { s: "ok", d: Array.from(cache.values()), _serverEmitTime: timestamp, _type: "snapshot" };
  }
}

// Delta — nhỏ hơn nhiều so với snapshot, chỉ chứa những mã cổ phiếu vừa thay đổi
function buildDelta(room: string): { s: string; d: Record<string, unknown>[]; _serverEmitTime: number; _type: "delta" } | null {
  const timestamp = Date.now();
  let deltaItems: Record<string, unknown>[] = [];

  if (room === "30") {
    const vn30Set = new Set(vn30Symbols);
    deltaItems = Array.from(changedInstruments["HOSE"].values()).filter((inst) => vn30Set.has(inst.symbol as string));
  } else if (room === "HNX30") {
    const hnx30Set = new Set(hnx30Symbols);
    deltaItems = Array.from(changedInstruments["HNX"].values()).filter((inst) => hnx30Set.has(inst.symbol as string));
  } else {
    const delta = changedInstruments[room];
    if (!delta) return null;
    deltaItems = Array.from(delta.values());
  }

  if (deltaItems.length === 0) return null;
  return { s: "ok", d: deltaItems, _serverEmitTime: timestamp, _type: "delta" };
}

// ====================== ĐẦU VÀO ======================
export async function startPolling(io: Server) {
  ioRef = io;

  // Bước 1: Load toàn bộ data từ MongoDB vào cache
  await loadInitialDataFromDB();
  console.log("[DONE Load initial] ✅ Cache đã sẵn sàng từ MongoDB");

  // Bước 2: Socket.IO handler — phục vụ FE clients
  io.on("connection", (socket: Socket) => {
    console.log("[DONE Socket] Client đã kết nối | id:", socket.id);

    // Gửi chart data nếu đã có sẵn trong cache
    if (Object.keys(latestChartData).length > 0) socket.emit("chartinday_data", latestChartData);

    // Gửi index data từ MongoDB ngay khi client connect lần đầu
    MarketIndex.find({})
      .lean()
      .then((indices) => {
        if (indices.length > 0) {
          socket.emit("indexsnaps_data", {
            s: "ok",
            d: indices.map((idx) => ({ ...idx, _id: idx._id?.toString() })),
          });
        }
      })
      .catch(() => {});

    // Client subscribe vào exchange room → gửi FULL SNAPSHOT 1 lần
    socket.on("subscribe_exchange", (exchange: string) => {
      if (!VALID_ROOMS.includes(exchange as (typeof VALID_ROOMS)[number])) return;
      VALID_ROOMS.forEach((ex) => socket.leave(`exchange:${ex}`));
      socket.join(`exchange:${exchange}`);
      const data = buildFullSnapshot(exchange);
      if (data) socket.emit("instruments_data", data);
    });

    socket.on("disconnect", () => {
      console.log("[Socket] Client đã ngắt kết nối | id:", socket.id);
    });
    socket.on("error", (err: unknown) => {
      console.error("[Socket] Có lỗi:", err);
    });
  });

  // Bước 3: ChartInday — vẫn poll từ ASEAN mỗi 5 giây để biểu đồ động
  setInterval(async () => {
    try {
      const results = await Promise.all(
        CHART_CODES.map(async (code) => {
          const res = await axios.get(`${BASE_URL}/datafeed/chartinday/${code}`);
          return { code, data: res.data };
        }),
      );
      const chartData: Record<string, unknown> = {};
      results.forEach(({ code, data }) => {
        chartData[code] = data;
      });
      latestChartData = chartData;
      io.emit("chartinday_data", chartData);
    } catch (err) {
      console.error("[Polling] Lỗi polling chartinday:", err);
    }
  }, 5000);
}
