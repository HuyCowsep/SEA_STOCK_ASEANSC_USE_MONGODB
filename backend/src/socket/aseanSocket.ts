// backend/src/socket/aseanSocket.ts

// Kết nối tới WebSocket của ASEAN Securities để nhận data cổ phiếu realtime.
// Server ASEAN dùng Sails.js + Socket.IO v2 (Engine.IO protocol 3).
// Backend mình đóng vai "browser giả" — lấy cookies → mở WebSocket → lắng nghe event.

// FLOW:
// 1. fetchSessionCookies(): GET / và GET /__getcookie để lấy cookies LB + WAF
// 2. connectToAsean(): Mở WebSocket tới wss://seastock.aseansc.com.vn/market/socket.io/
// 3. Sau khi connect → subscribe vào các channels (idx:HOSE, e:HOSE, ...)
// 4. Lắng nghe event "i" (instrument update) và "idx" (index update)
// 5. Gọi callbacks để polling.ts xử lý tiếp (merge cache → broadcast frontend)

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ioClient = require("socket.io-client");
import axios from "axios";

// Path Socket.IO là /market/socket.io
// URL WebSocket hoàn chỉnh: wss://seastock.aseansc.com.vn/market/socket.io/?...&transport=websocket
const ASEAN_BASE = "https://seastock.aseansc.com.vn";
const ASEAN_SOCKET_PATH = "/market/socket.io";

// Channels cần subscribe sau khi kết nối thành công
// idx:* = index data (VN-Index, HNX-Index, ...), e:* = exchange data (danh sách cổ phiếu)
const INDEX_CHANNELS = ["idx:HOSE", "idx:30", "idx:HNX", "idx:HNX30", "idx:UPCOM"];
const EXCHANGE_CHANNELS = ["e:HOSE", "e:HNX", "e:UPCOM"];

export interface InstrumentUpdateData {
  a: string; // action: "u" = update
  d: Array<Record<string, unknown>>; // array of instrument deltas
}

export interface AseanSocketCallbacks {
  onInstrumentUpdate: (data: InstrumentUpdateData) => void;
  onIndexUpdate: (data: unknown) => void;
  onConnect: () => void;
  onDisconnect: (reason: string) => void;
}

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Lấy cookies theo đúng flow của sails.io.js SDK:
 * - Step 1: GET / → server trả cookies WAF/Load Balancer (BIGipServer, TS...)
 * - Step 2: GET /__getcookie → Sails.js tạo session (sails.io.js SDK luôn gọi bước này trước khi connect socket)
 * Không gọi /__getcookie → server sẽ từ chối kết nối WebSocket.
 */
async function fetchSessionCookies(): Promise<{ cookies: string }> {
  const allCookies = new Map<string, string>();

  const mergeCookies = (setCookies: string[] | undefined) => {
    if (!setCookies) return;
    for (const c of setCookies) {
      const nameVal = c.split(";")[0];
      const eqIdx = nameVal.indexOf("=");
      if (eqIdx > 0) {
        allCookies.set(nameVal.substring(0, eqIdx).trim(), nameVal);
      }
    }
  };

  const cookieString = () => Array.from(allCookies.values()).join("; ");

  const commonHeaders = {
    "User-Agent": BROWSER_UA,
    Origin: ASEAN_BASE,
    Referer: `${ASEAN_BASE}/market`,
  };

  // Step 1: GET / → lấy cookies Load Balancer + WAF (đã chạy được đoạn này và có Log)
  try {
    const res = await axios.get(ASEAN_BASE, {
      headers: { ...commonHeaders, Accept: "text/html" },
      maxRedirects: 5,
      validateStatus: () => true,
    });
    mergeCookies(res.headers["set-cookie"]);
  } catch (err) {
    console.error("[ASEAN_WS] Step 1 failed:", (err as Error).message);
  }

  // Step 2: GET /__getcookie → Sails.js tạo session cookie (đã chạy được đoạn này và có Log)
  // Bước này trả 401 nhưng vẫn set cookie — đó là bình thường, không cần login
  try {
    const res = await axios.get(`${ASEAN_BASE}/__getcookie`, {
      headers: { ...commonHeaders, Accept: "*/*", Cookie: cookieString() },
      validateStatus: () => true,
    });
    mergeCookies(res.headers["set-cookie"]);
  } catch (err) {
    console.error("[ASEAN_WS] Step 2 failed:", (err as Error).message);
  }
  return { cookies: cookieString() };
}

/**
 * Kết nối tới ASEAN WebSocket và subscribe vào các channels
 * Dùng Sails.js virtual request format để subscribe
 */
export async function connectToAsean(callbacks: AseanSocketCallbacks) {
  // === Bước 1: Lấy cookies từ ASEAN (giả lập browser) ===
  const { cookies } = await fetchSessionCookies();

  // Query params giả lập sails.io.js SDK — ASEAN server kiểm tra các params này
  const queryParams: Record<string, string> = {
    __sails_io_sdk_version: "1.2.1",
    __sails_io_sdk_platform: "browser",
    __sails_io_sdk_language: "javascript",
  };

  // === Bước 2: Tạo kết nối Socket.IO tới ASEAN ===
  // Dùng socket.io-client v2 (require, không phải import) vì ASEAN chạy Engine.IO v3
  // - ioClient(ASEAN_BASE): kết nối tới https://seastock.aseansc.com.vn (root URL)
  // - path: "/market/socket.io"
  // - → URL thật: wss://seastock.aseansc.com.vn/market/socket.io/?...&transport=websocket
  // - forceNode: true: dùng ws module của Node.js thay vì native WebSocket (tránh lỗi Node v23)
  // - extraHeaders: gửi cookies + User-Agent giả browser để ASEAN chấp nhận kết nối
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socket: any = ioClient(ASEAN_BASE, {
    path: ASEAN_SOCKET_PATH,
    transports: ["websocket"],
    forceNode: true,
    extraHeaders: {
      Origin: ASEAN_BASE,
      Referer: `${ASEAN_BASE}/market`,
      "User-Agent": BROWSER_UA,
      ...(cookies ? { Cookie: cookies } : {}),
    },
    query: queryParams,
    reconnection: true, // tự reconnect khi mất kết nối
    reconnectionDelay: 2000, // đợi 2s trước khi reconnect
    reconnectionDelayMax: 10000,
    reconnectionAttempts: 5,
  });

  // === Error handlers — chỉ log khi có lỗi ===
  socket.on("connect_error", (err: unknown) => console.log("[ASEAN_WS] Kết nối thất bại:", err));
  socket.on("reconnect_failed", () => console.log("[ASEAN_WS] Reconnect thất bại"));

  // === Bước 3: Khi kết nối thành công → subscribe channels ===
  socket.on("connect", () => {
    callbacks.onConnect(); // Đã có log
    // Subscribe index channels (idx:HOSE, idx:HNX, ...)
    socket.emit("get", {
      url: "/client/subscribe",
      method: "get",
      headers: {},
      data: { op: "subscribe", args: INDEX_CHANNELS },
    });

    // Subscribe exchange channels (e:HOSE, e:HNX, e:UPCOM)
    // Mỗi channel = 1 sàn giao dịch, server sẽ push event "i" khi có cổ phiếu thay đổi
    for (const channel of EXCHANGE_CHANNELS) {
      socket.emit("get", {
        url: "/client/subscribe",
        method: "get",
        headers: {},
        data: { op: "subscribe", args: [channel] },
      });
    }
  });

  // === Bước 4: Lắng nghe event realtime từ ASEAN ===
  // Event "i" = Instrument update (cổ phiếu thay đổi giá/khối lượng)
  // Data format: { a: "u", d: [{ SB: "VNM", CP: 85000, CV: 100, EX: "HOSE", ... }] }
  //   a = action ("u" = update)
  //   d = mảng các instrument đã thay đổi
  //   SB = symbol, CP = closePrice, CV = closeVol, EX = exchange, ...
  socket.on("i", (data: unknown) => {
    callbacks.onInstrumentUpdate(data as InstrumentUpdateData); //đã có log
  });

  socket.on("idx", (data: unknown) => {
    callbacks.onIndexUpdate(data); // đã có log
  });

  // Khi mất kết nối — socket.io-client v2 sẽ tự reconnect (reconnection: true)
  socket.on("disconnect", (reason: string) => {
    callbacks.onDisconnect(reason);
  });

  return socket;
}
