<!-- markdownlint-disable -->

# AseanSC — Tài liệu dự án

> File này chứa toàn bộ kiến trúc, quyết định kỹ thuật, và kế hoạch phát triển.
> Đọc file này trước khi hỏi AI bất kỳ câu nào về dự án.
> File được hỗ trợ viết bởi github copilot

---

## 1. Tổng quan

**Mục đích**: Clone bảng giá chứng khoán realtime từ [seastock.aseansc.com.vn](https://seastock.aseansc.com.vn/market), thêm tính năng đặt lệnh mock (không kết nối sàn thật).

**Tech stack**:
| Layer | Công nghệ |
|---|---|
| Frontend | React 19, TypeScript, Vite, Ant Design 6, SCSS Modules, TanStack Virtual |
| Backend | Express 5, TypeScript, Socket.IO 4, Mongoose (MongoDB) |
| Database | MongoDB (local `mongodb://127.0.0.1:27017/AseanSC_DB`) |
| Realtime | Backend → ASEAN WebSocket (lấy giá thật) → Backend Socket.IO → Frontend |

**Ports**: Backend `:3001` | Frontend `:5173`

## 2. Kiến trúc tổng quan

```
┌────────────────────────────────────────────────────────────────────┐
│                         ASEAN Securities                           │
│  wss://seastock.aseansc.com.vn/market/socket.io                    │
│  Event "i" = instrument update | Event "idx" = index update        │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ WebSocket (socket.io-client v2)
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Express + Socket.IO)                  │
│                                                                    │
│  aseanSocket.ts ──→ polling.ts (cache + merge) ──→ Socket.IO emit  │
│                                                                    │
│  REST APIs:                                                        │
│    /api/auth/*           → authController (login/register/OTP)     │
│    /api/datafeed/*       → MongoDB queries (KHÔNG còn proxy ASEAN) │
│    /api/orders/*         → orderController (đặt lệnh mock)         │
│                                                                    │
│  Socket events emit cho frontend:                                  │
│    "instruments_data"    → dữ liệu cổ phiếu (snapshot + delta)     │
│    "indexsnaps_data"     → chỉ số thị trường (VN-Index, HNX...)    │
│    "chartinday_data"     → biểu đồ mini trong ngày                 │
│    "order_update"        → cập nhật trạng thái lệnh                │
│                                                                    │
│  matchingEngine.ts       → Mock khớp lệnh, sau match:              │
│                            update MongoDB instruments              │
│                            → markInstrumentChanged() → FE flash    │
│                                                                    │
│  MongoDB Models:                                                   │
│    User        → username, email, password, otp, otpExpire         │
│    Order       → userId, symbol, side, price, quantity, status     │
│    Account     → userId, available, locked, bankAccount            │
│    Holding     → userId, symbol, available, locked, avgPrice       │
│    Instrument  → dữ liệu bảng giá (collection "instruments")       │
│    MarketIndex → chỉ số thị trường (collection "indices")          │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ Socket.IO (v4)
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                        │
│                                                                    │
│  App.tsx → Dashboard.tsx (trang chính duy nhất)                    │
│                                                                    │
│  Components:                                                       │
│    Header           → nav, login/register, user dropdown           │
│    MarketIndexCards → VN-Index, HNX-Index, UPCOM (5 thẻ)           │
│    FilterToolbar    → chọn sàn, ngành, search mã, CW/ETF filter    │
│    StockTable       → bảng giá chính (TanStack Virtual)            │
│    Footer           → thông tin, đơn vị                            │
│                                                                    │
│  Modals:                                                           │
│    LoginModal, ForgotPasswordModal, OpenAccountModal               │
│    DisplaySettingsModal, UnitSettingsModal                         │
│    OrderModal → form đặt lệnh mua/bán                              │
│    UserProfileModal → thông tin + chỉnh sửa cá nhân                │
│    DepositModal → nạp tiền ảo                                      │
│                                                                    │
│  websocket/client.ts → Socket.IO client kết nối backend :3001      │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Luồng dữ liệu realtime (MongoDB-first, không còn ASEAN WS)

### 3.1 Bảng giá cổ phiếu — nguồn MongoDB

```
startPolling(io): loadInitialDataFromDB()
  → Instrument.find({ exchange }) × 3 sàn → populate exchangeCache
  → Client connect → subscribe_exchange → buildFullSnapshot() → emit

Khi khớp lệnh:
matchingEngine → matchFull():
  → Instrument.updateOne({ symbol }, { $set: { closePrice, totalTrading, offerVol1/bidVol1, change, changePercent } })
  → markInstrumentChanged(exchange, symbol, updatedFields)
  → merge vào cache → broadcastDeltaImmediately()
  → io.to("exchange:HOSE").emit("instruments_data", delta)
  → Frontend Dashboard.tsx nhận → merge state → flash cells (420ms)
```

> **Triết lý**: Giá thay đổi khi có lệnh khớp → update DB → push socket delta → FE flash.  
> Dùng socket push thay vì FE polling API, như leader yêu cầu.

### 3.2 Chỉ số thị trường (MarketIndexCards) — nguồn MongoDB

```
Frontend polling REST mỗi 3s → /api/datafeed/indexsnaps/HOSE,30,HNX,HNX30,UPCOM
  → Backend: MarketIndex.find({ marketCode: { $in: codes } }).lean()
  → Trả { s: "ok", d: [...] }
  → Frontend cập nhật advances/declines/noChange/giá/KL

Socket: khi connect → backend emit "indexsnaps_data" từ MarketIndex.find({})
```

**Field names trong MongoDB collection "indices"** (từ ASEAN API format):

```
marketCode           → "HOSE", "30", "HNX", "HNX30", "UPCOM"
marketIndex          → giá trị chỉ số VD "1677.54"
indexChange          → điểm thay đổi
indexPercentChange   → % thay đổi
advances             → số mã tăng ▲
declines             → số mã giảm ▼
noChange             → số mã đứng ■
numberOfCe           → số mã trần
numberOfFl           → số mã sàn
totalVolume          → tổng KL
totalValue           → tổng GT
```

### 3.3 Frontend Socket flow (không đổi)

```
websocket/client.ts → io("http://localhost:3001")
  → connect → emit("subscribe_exchange", "HOSE")
  → nhận "instruments_data" (snapshot lần đầu, delta các lần sau)
  → nhận "indexsnaps_data" (chỉ số thị trường)
  → nhận "chartinday_data" (biểu đồ mini)

Dashboard.tsx:
  → instruments state → StockTable (TanStack Virtual)
  → flashingCells state → highlight cells khi giá thay đổi (420ms)
```

---

## 4. Cấu trúc file hiện tại (có thể thêm trong tương lai)

```
backend/src/
├── server.ts                 # Express + Socket.IO setup, mount routes
├── config/
│   └── database.ts           # MongoDB connection
├── controllers/
│   ├── authController.ts     # register, login, forgot password (OTP email)
│   └── orderController.ts    # [TRỐNG] — cần implement
├── models/
│   ├── User.ts               # username, email, password, otp
│   ├── Order.ts              # [TRỐNG] — cần implement
│   └── Price.ts              # [TRỐNG] — không cần dùng
├── routes/
│   ├── auth.routes.ts        # POST /register, /login, /forgot-password/*
│   ├── datafeed.ts           # Proxy tới ASEAN REST (instruments, indexsnaps, chart...)
│   ├── order.routes.ts       # [TRỐNG] — cần implement
│   └── price.routes.ts       # [TRỐNG] — không cần dùng
├── socket/
│   ├── aseanSocket.ts        # Kết nối WS tới ASEAN (giả lập browser, lấy cookies)
│   └── polling.ts            # Cache + merge + broadcast delta cho frontend
└── utils/
    └── sendMail.ts           # Gửi OTP qua email (nodemailer)

frontend/src/
├── App.tsx                   # Router: / → /dashboard
├── main.tsx                  # Entry point
├── pages/
│   ├── Dashboard.tsx         # Trang chính: Header + Cards + Filter + Table + Footer
│   └── ComingSoon.tsx        # Catch-all route
├── components/
│   ├── Header.tsx            # Nav bar, login/register buttons, user dropdown
│   ├── MarketIndexCards.tsx   # 5 thẻ chỉ số: VN-INDEX, VN30, HNX, HNX30, UPCOM
│   ├── FilterToolbar.tsx     # Chọn sàn, ngành, search, CW/ETF, settings
│   ├── StockTable.tsx        # Bảng giá chính (virtual scroll, flash cells)
│   ├── Footer.tsx            # Footer
│   └── UserDropdown.tsx      # Dropdown user sau khi login
├── modals/
│   ├── LoginModal.tsx        # Đăng nhập / Đăng ký (tabs)
│   ├── ForgotPasswordModal.tsx # Quên mật khẩu (OTP email)
│   ├── OpenAccountModal.tsx  # Mở tài khoản
│   ├── DisplaySettingsModal.tsx # Cài đặt hiển thị cột
│   └── UnitSettingsModal.tsx # Cài đặt đơn vị (KL, giá, GT)
├── websocket/
│   └── client.ts             # Socket.IO client → backend :3001
├── types/
│   ├── tableConfig.ts        # UnitSettings, ColumnVisibility interfaces
│   └── marketStatus.ts       # Map mã trạng thái thị trường → text
├── i18n/
│   ├── vi.ts                 # Tiếng Việt
│   └── en.ts                 # English
└── scss/                     # SCSS modules cho từng component
```

---

## 5. Auth flow hiện tại

- JWT token, lưu `localStorage("token")`
- `POST /api/auth/register` → tạo user, trả token
- `POST /api/auth/login` → kiểm tra bcrypt, trả token
- `POST /api/auth/forgot-password/request-otp` → gửi OTP qua email (nodemailer)
- `POST /api/auth/forgot-password/reset` → đổi mật khẩu bằng OTP
- Chưa có **auth middleware** (cần tạo cho order routes)

---

## 6. Kế hoạch: Tính năng đặt lệnh mock

### 6.1 Nguyên tắc

- **GIỮ NGUYÊN** ASEAN socket → bảng giá vẫn lấy giá thật realtime
- **KHÔNG** tạo fake data, **KHÔNG** bỏ ASEAN
- Lệnh đặt bởi user → lưu vào MongoDB → **mock matching engine** so sánh giá đặt vs giá thật từ cache ASEAN → cập nhật trạng thái lệnh
- "Effect lên bảng giá" = hiển thị indicator trên bảng (highlight hàng, icon trạng thái) + panel sổ lệnh riêng

### 6.2 Flow đặt lệnh

```
User chọn mã (VD: VNM) → nhập giá: 75.5, KL: 100, loại: LO
    │
    ▼
Frontend POST /api/orders (kèm JWT token)
    │
    ▼
Backend validate → lưu MongoDB (status: "pending")
    │
    ▼
matchingEngine (chạy mỗi 1-2s):
    │  Duyệt tất cả lệnh pending
    │  Lấy giá realtime từ exchangeCache (polling.ts)
    │  Lệnh MUA: orderPrice >= cache[symbol].offerPrice1 → khớp
    │  Lệnh BÁN: orderPrice <= cache[symbol].bidPrice1  → khớp
    │
    ▼
Cập nhật DB (status: "matched") → emit socket "order_update" cho user
    │
    ▼
Frontend nhận → cập nhật sổ lệnh + highlight trên bảng giá
```

### 6.3 Các file cần implement

#### Backend

| File                           | Nội dung                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| models/Order.ts                | Định nghĩa schema Order (userId, symbol, exchange, side, orderType, price, quantity, status...) |
| controllers/orderController.ts | Xử lý logic: placeOrder (tạo lệnh), getOrders (lấy danh sách), cancelOrder (huỷ lệnh)           |
| routes/order.routes.ts         | Định nghĩa API: POST /, GET /, DELETE /:id và gắn auth middleware                               |
| middleware/auth.ts             | Xác thực JWT, gắn req.userId vào request                                                        |
| socket/matchingEngine.ts       | Chạy định kỳ (1–2s), duyệt lệnh pending, so sánh giá cache, khớp lệnh và emit socket            |

#### Frontend

| File                          | Nội dung                                                      |
| ----------------------------- | ------------------------------------------------------------- |
| `modals/OrderModal.tsx`       | **[MỚI]** Form đặt lệnh: chọn mã, side, loại lệnh, giá, KL    |
| `components/OrderBook.tsx`    | **[MỚI]** Panel sổ lệnh: danh sách lệnh + trạng thái realtime |
| `scss/OrderModal.module.scss` | **[MỚI]** Style cho modal đặt lệnh                            |
| `scss/OrderBook.module.scss`  | **[MỚI]** Style cho sổ lệnh                                   |

#### Files cần sửa

| File                                     | Thay đổi                                                       |
| ---------------------------------------- | -------------------------------------------------------------- |
| `backend/src/server.ts`                  | Mount order routes: `app.use("/api/orders", orderRoutes)`      |
| `backend/src/socket/polling.ts`          | Export `exchangeCache` để matchingEngine truy cập giá realtime |
| `frontend/src/pages/Dashboard.tsx`       | Thêm state/callback cho OrderModal, OrderBook                  |
| `frontend/src/components/StockTable.tsx` | Thêm nút "Mua/Bán" hoặc highlight hàng có lệnh                 |

### 6.4 Order Schema

```typescript
{
  userId:         ObjectId (ref: User),
  symbol:         string,            // VD: "VNM"
  exchange:       "HOSE" | "HNX" | "UPCOM",
  side:           "buy" | "sell",
  orderType:      "LO" | "ATO" | "ATC" | "MP",  // Lệnh giới hạn / ATO / ATC / Thị trường
  price:          number,            // Giá đặt (×1000 VND). LO bắt buộc, ATO/ATC/MP = 0
  quantity:       number,            // KL đặt (bội số 100 cho HOSE, 100 cho HNX/UPCOM)
  filledQuantity: number,            // KL đã khớp (default 0)
  status:         "pending" | "partial" | "matched" | "cancelled",
  matchedPrice:   number | null,     // Giá khớp thực tế
  createdAt:      Date,
  matchedAt:      Date | null,
}
```

### 6.5 Mock Matching Logic

```
Mỗi 1-2 giây:
1. Query tất cả orders có status = "pending" hoặc "partial"
2. Với mỗi order:
   a. Lấy instrument từ exchangeCache[order.exchange].get(order.symbol)
   b. Nếu không tìm thấy hoặc market đóng → skip
   c. Lệnh MUA (buy):
      - Nếu order.price >= instrument.offerPrice1 && instrument.offerVol1 > 0
      - → Khớp (toàn phần hoặc một phần tuỳ KL)
      - matchedPrice = offerPrice1
   d. Lệnh BÁN (sell):
      - Nếu order.price <= instrument.bidPrice1 && instrument.bidVol1 > 0
      - → Khớp
      - matchedPrice = bidPrice1
   e. Lệnh ATO/ATC/MP:
      - Khớp luôn tại closePrice (giá hiện tại)
3. Cập nhật DB → emit socket "order_update" cho userId
```

### 6.6 Frontend order flow

```
User click mã trên bảng giá → mở OrderModal
  → Điền giá, KL, chọn Mua/Bán
  → POST /api/orders (kèm token)
  → Nhận response OK → thêm vào OrderBook (status: pending)
  → Socket nhận "order_update" → cập nhật status realtime
  → Bảng giá: highlight hàng mã đang có lệnh
```

---

## 7. File không cần dùng

- `models/Price.ts` — **Không cần**. Giá realtime lấy từ ASEAN cache trong memory, không lưu DB.
- `routes/price.routes.ts` — **Không cần**. Tương tự.

---

## 8. Dependencies hiện tại

### Backend (`package.json`)

```
express@5, socket.io@4, socket.io-client@2 (cho ASEAN v2),
mongoose, axios, bcrypt, jsonwebtoken, nodemailer, cors, dotenv
```

### Frontend (`package.json`)

```
react@19, react-dom@19, vite, typescript,
antd@6, @ant-design/icons, @tanstack/react-virtual,
socket.io-client@3.1.2, axios, react-router-dom@7,
react-intl, react-redux, @reduxjs/toolkit, sass
```

---

## 9. Lưu ý kỹ thuật quan trọng

1. **ASEAN dùng Socket.IO v2** (Engine.IO protocol 3). Backend phải dùng `socket.io-client@2` (require, không import) để kết nối.

2. **Backend ↔ Frontend dùng Socket.IO v4** (bình thường). Frontend dùng `socket.io-client@3`.

3. **exchangeCache** trong `polling.ts` là nguồn giá realtime duy nhất. matchingEngine cần access cache này (export hoặc getter function).

4. **Flash cells**: Frontend detect thay đổi giá và highlight 420ms. Logic ở `Dashboard.tsx` (`applyFlashUpdates`).

5. **Virtual scroll**: StockTable dùng `@tanstack/react-virtual` để render hàng nghìn mã mà không lag.

6. **JWT Secret**: Đọc từ `process.env.JWT_SECRET`. Cần có file `.env` trong `backend/`.

7. **ASEAN WS field names** đã xác nhận (xem mục 3.1). Không đoán — luôn tra WS_FIELD_MAP.

8. **IDX event AV/DV = khối lượng**, KHÔNG phải số mã trần/sàn. Đã xác nhận qua debug log.

---

## 10. Thiết kế & triển khai tính năng đặt lệnh mock

> Mục này mô tả chi tiết cách tính năng đặt lệnh được thiết kế và triển khai, để giải thích với leader/tech review.

### 10.1 Triết lý thiết kế

Mục tiêu là mô phỏng trải nghiệm giao dịch chứng khoán thực tế nhất có thể mà **không kết nối tới sàn thật**, cụ thể:

- **Giá là thật**: hoàn toàn lấy từ ASEAN WebSocket realtime, không fake data
- **Lệnh là mock**: lưu vào MongoDB của mình, khớp bằng engine tự viết
- **Tiền là ảo**: user tự nạp qua flow giả lập chuyển khoản ngân hàng (không xác minh thật)
- **Trạng thái thật**: pending → matched/cancelled, cập nhật qua Socket.IO realtime

### 10.2 Luồng hoàn chỉnh từ đầu đến cuối

```
[1] User đăng ký → Account tạo tự động với số dư = 0 đồng
         │
         ▼
[2] User liên kết ngân hàng ảo (nhập STK + chọn bank)
    → POST /api/deposit/link-bank → lưu bankAccount, bankName vào Account
         │
         ▼
[3] User nạp tiền ảo
    → POST /api/deposit → validate hạn mức (tối đa 5 tỷ/lần, 10 tỷ/ngày)
    → account.available += amount
         │
         ▼
[4] User click nút M/B trên bảng giá → mở OrderModal
    → Chọn side (Mua/Bán), loại lệnh (LO/ATO/ATC/MP), nhập giá + KL
    → Frontend validate sơ bộ (giá trong trần/sàn, KL bội số 100, v.v.)
         │
         ▼
[5] POST /api/orders (kèm JWT token)
    → Backend validate đầy đủ:
        - Mã tồn tại trên sàn (tra exchangeCache realtime)
        - Giá nằm trong [sàn, trần]
        - KL không vượt 50% tổng KL ngày / không quá 10 triệu CP
        - Tài khoản đủ tiền (buy) hoặc đủ cổ (sell)
    → Lock tài sản ngay lập tức:
        - BUY: account.available -= lockPrice×qty, account.locked += lockPrice×qty
        - SELL: holding.available -= qty, holding.locked += qty
    → Order.create({ status: "pending" })
    → Trả về order object cho frontend
         │
         ▼
[6] Frontend nhận response → thêm ngay vào sổ lệnh (OrderBook), không cần F5
    → OrderBook hiện row với status "Chờ khớp lệnh"
    → StockTable hiện dấu chấm cam trên cột "Lệnh" của mã đó
         │
         ▼
[7] matchingEngine.ts chạy setInterval mỗi 2 giây:
    → Query tất cả orders status = pending/partial
    → Với mỗi order, lấy giá realtime từ exchangeCache:
        - BUY LO: nếu order.price >= offerPrice1 → khớp tại offerPrice1
        - SELL LO: nếu order.price <= bidPrice1  → khớp tại bidPrice1
        - ATO/ATC/MP: khớp luôn tại closePrice
    → Chuyển đổi tài sản khi khớp:
        - BUY: account.locked -= lockedAmt, holding.available += qty
          (nếu giá khớp thấp hơn giá đặt → hoàn phần chênh lệch về available)
          cập nhật giá vốn trung bình (weighted avg price)
        - SELL: holding.locked -= qty, account.available += matchedPrice×qty
    → Cập nhật order.status = "matched", lưu matchedPrice, matchedAt
    → io.emit("order_update", { orderId, userId, status, matchedPrice, ... })
         │
         ▼
[8] Frontend nhận socket event "order_update"
    → Dashboard.tsx lắng nghe → cập nhật orders state realtime
    → OrderBook tự cập nhật: "Chờ khớp" → "Đã khớp", hiện giá khớp
    → Dấu chấm trên bảng giá biến mất (vì không còn pending)
```

### 10.3 Quản lý tài sản — cơ chế Lock/Unlock

Đây là phần quan trọng nhất để tránh tình huống user "tiêu tiền ảo 2 lần":

| Hành động     | Tài khoản tiền                                           | Danh mục cổ phiếu                       |
| ------------- | -------------------------------------------------------- | --------------------------------------- |
| Đặt lệnh MUA  | `available -= lockPrice×qty` → `locked += lockPrice×qty` | Không đổi                               |
| Đặt lệnh BÁN  | Không đổi                                                | `available -= qty` → `locked += qty`    |
| Huỷ lệnh MUA  | `locked -= refund` → `available += refund`               | Không đổi                               |
| Huỷ lệnh BÁN  | Không đổi                                                | `locked -= qty` → `available += qty`    |
| Khớp lệnh MUA | `locked -= lockAmt`, hoàn chênh lệch về `available`      | `available += qty`, cập nhật `avgPrice` |
| Khớp lệnh BÁN | `available += matchedPrice×qty`                          | `locked -= qty`                         |

1. lockPrice × qty: tổng số tiền cần để mua cổ phiếu -> trừ tiền từ available chuyển sang locked
2. qty là số cổ phiếu muốn bán -> trừ khỏi số cổ có thể bán chuyển sang trạng thái locked
3. refund = số tiền đã bị lock trước đó -> tiền được mở khoá từ locked trả về availble
4. Trừ toàn bộ tiền đã lock (locked -= lockAmt), nếu giá khớp thấp hơn thì hoàn phần dư về available. available += qty là cộng cổ phiếu vào, cập nhật giá TB
5. nhận tiền từ việc bán + vào availble, giảm số cổ đã bị giữ (locked) ->cổ mất, tiền về TK

> **Tại sao phải lock?** Nếu không lock, user có 100 triệu có thể đặt 10 lệnh mỗi lệnh 100 triệu → hệ thống cho phép "âm tài khoản". Lock đảm bảo tài sản luôn được đặt đúng 1 nơi tại 1 thời điểm.

### 10.4 MongoDB Models liên quan

**Account** (1:1 với User):

```typescript
{
  userId: ObjectId,
  available: number,      // Tiền dùng được
  locked: number,         // Tiền đang giữ cho lệnh mua chờ khớp
  bankAccount: string,    // STK ngân hàng liên kết
  bankName: string,
  dailyDeposited: number, // Đã nạp hôm nay (reset mỗi ngày)
  lastDepositDate: string // "YYYY-MM-DD"
}
```

**Holding** (N per User, mỗi mã 1 row):

```typescript
{
  userId: ObjectId,
  symbol: string,         // "VNM", "FPT"...
  available: number,      // Cổ phiếu dùng được (bán được)
  locked: number,         // Cổ phiếu đang giữ cho lệnh bán chờ khớp
  avgPrice: number,       // Giá vốn trung bình (weighted avg)
}
// Index unique: { userId, symbol }
```

**Order**:

```typescript
{
  userId: ObjectId,
  symbol, exchange, side, orderType,
  price, quantity, filledQuantity,
  status: "pending" | "partial" | "matched" | "cancelled",
  matchedPrice, matchedAt, createdAt
}
```

### 10.5 API Endpoints

| Method | Route                  | Chức năng                    | Auth |
| ------ | ---------------------- | ---------------------------- | ---- |
| POST   | /api/orders            | Đặt lệnh mới                 | ✅   |
| GET    | /api/orders            | Lấy lịch sử lệnh             | ✅   |
| DELETE | /api/orders/:id        | Huỷ lệnh pending             | ✅   |
| GET    | /api/orders/balance    | Số dư tài khoản              | ✅   |
| GET    | /api/orders/holdings   | Danh mục cổ phiếu            | ✅   |
| GET    | /api/deposit/info      | Thông tin bank + hạn mức     | ✅   |
| POST   | /api/deposit/link-bank | Liên kết tài khoản ngân hàng | ✅   |
| POST   | /api/deposit           | Nạp tiền ảo                  | ✅   |

### 10.6 Vấn đề kỹ thuật đã gặp & cách xử lý

**Vấn đề 1: Nút Mua/Bán phải click nhiều lần mới mở modal**

- **Nguyên nhân**: Component `Row` được define bên trong `StockTable`. Dữ liệu realtime thay đổi `flashingCells` mỗi 420ms → `StockTable` re-render → React xóa và tạo lại DOM của mỗi row. Trong lúc click: `mousedown` xong thì re-render xảy ra → button DOM bị unmount → `mouseup` rơi vào element trống → `onClick` không fire.
- **Giải pháp**: Đổi `onClick` → `onMouseDown` + `e.preventDefault()`. `onMouseDown` fire ngay khi nhấn xuống, trước khi bất kỳ re-render nào kịp xảy ra.

**Vấn đề 2: Sau khi đặt lệnh, sổ lệnh hiện row nhưng không có giá trị — phải F5 mới có**

- **Nguyên nhân**: Backend trả `{ message, order: { id, symbol, ... } }` nhưng frontend đọc `res.data._id`, `res.data.symbol` (bỏ qua wrapper `order`) → tất cả field đều `undefined`.
- **Giải pháp**: Đổi `const d = res.data` → `const d = res.data.order` trong `OrderModal.tsx`.

**Vấn đề 3: OrderBook collapse (Thu gọn) làm ẩn hoàn toàn header**

- **Nguyên nhân**: `.orderBook` có `overflow: hidden` + `height: 36px` inline → header bị clip nếu cao hơn 36px.
- **Giải pháp**: Xóa `overflow: hidden` khỏi `.orderBook`, dùng wrapper `.expandableArea` bọc phần nội dung có thể collapse. Header luôn render tự nhiên không bị clip.

### 10.7 Giới hạn hệ thống (Mock limitations)

| Giới hạn          | Giá trị                   | Lý do                       |
| ----------------- | ------------------------- | --------------------------- |
| KL tối đa / lệnh  | 10,000,000 CP             | Tránh đặt số ảo phi thực tế |
| KL tối đa / lệnh  | 50% tổng KL ngày của mã   | Tránh "thao túng"           |
| Nạp tối thiểu     | 100,000 VND / lần         | UX hợp lý                   |
| Nạp tối đa        | 5,000,000,000 VND / lần   | Giới hạn thực tế            |
| Nạp tối đa        | 10,000,000,000 VND / ngày | Giới hạn hằng ngày          |
| Matching interval | 2 giây                    | Cân bằng realtime vs tải DB |

---

_Cập nhật lần cuối: 03/04/2026_

## 11. Cập nhật bổ sung

- Hệ thống đã được áp dụng phí giao dịch 0,15% cho mỗi lần thực hiện lệnh, bao gồm cả lệnh mua và lệnh bán. Việc bổ sung phí này giúp mô phỏng sát hơn với môi trường giao dịch thực tế trên thị trường chứng khoán, đồng thời tạo tiền đề cho việc xử lý các logic tài chính phức tạp hơn trong tương lai.
- Đã triển khai chức năng thông tin cá nhân (Profile), cho phép người dùng theo dõi và quản lý các dữ liệu cơ bản liên quan đến tài khoản. Cho phép chỉnh sửa 1 số thông tin trực tiếp ngay trên MODAL
- Giao diện đã được cập nhật để hiển thị số dư tài khoản một cách trực quan và rõ ràng hơn. Việc này giúp người dùng dễ dàng nắm bắt tình trạng tài chính hiện tại, có thể thấy biến động số dư ngay khi khớp lệnh BUY/SELL

_Cập nhật lần cuối: 07/04/2026_

## 11. Cập nhật bổ sung tính năng P2P

1. runP2PMatching(io) — chạy trước mock matching mỗi 2 giây

- Lấy tất cả lệnh LO đang pending/partial
- Nhóm theo exchange:symbol (ví dụ: HOSE:AAA)
- Với mỗi nhóm, sort lệnh mua theo giá cao → thấp, lệnh bán theo giá thấp → cao, cùng giá thì lệnh cũ hơn ưu tiên (price-time priority)
- Dùng 2 con trỏ bi, si duyệt qua từng cặp:
  - Nếu cùng user → skip (chống self-dealing)
  - Nếu giá mua < giá bán → break (không còn cặp nào khớp nữa)
  - Nếu khớp được → gọi matchP2P

2. matchP2P(...) — xử lý tài sản 2 bên

- Giá khớp = giá của lệnh đặt trước (passive order)
- Bên MUA: unlock locked, hoàn dư nếu giá khớp thấp hơn giá đặt, cộng holding
- Bên BÁN: trừ locked cổ phiếu, cộng tiền sau phí vào available
- Cập nhật closePrice trong MongoDB + push delta qua socket → FE flash giá
- Emit order_update cho cả 2 users

3. Thứ tự trong interval
   ① runP2PMatching() ← ưu tiên người vs người
   ② tryMatchOrder() ← lệnh còn lại mới so vs giá cache

## 12. Cập nhật để chạy được lỗi sau: "bảng giá chỉ nháy flash khi lệnh khớp, còn khi chỉ mới đặt lệnh pending thì các cột bid/ask (KL1/KL2/KL3, Giá1/Giá2/Giá3 bên mua và bán) không cập nhật gì hết"

1. polling.ts thêm hàm refreshOrderBookInCache(exchange, symbol)

- Query tất cả lệnh LO pending/partial cho mã đó
- Nhóm theo giá, cộng KL còn lại
- Tính top 3 bid (mua — giá cao nhất trước) và top 3 offer (bán — giá thấp nhất trước)
- Cập nhật bidPrice1/bidVol1/bidPrice2/bidVol2/bidPrice3/bidVol3 và offerPrice1/offerVol1... vào cache
- Gọi markInstrumentChanged → broadcast delta → FE nháy flash

2. orderController.ts — Gọi refreshOrderBookInCache:

- Sau khi placeOrder lưu lệnh thành công → cập nhật bid/ask ngay lập tức
- Sau khi cancelOrder hủy lệnh → xóa khỏi order book

3. matchingEngine.ts — Gọi refreshOrderBookInCache:

- Sau P2P match → lệnh đã khớp biến khỏi order book
- Sau mock match → tương tự

----> Kết quả: User đặt lệnh MUA 100 KL giá 75.5 → bidPrice1 = 75.5, bidVol1 = 100 hiện lên bảng ngay, nháy flash 420ms. Khi lệnh khớp/hủy → columns cập nhật lại chính xác.

_Cập nhật lần cuối: 13/04/2026_
