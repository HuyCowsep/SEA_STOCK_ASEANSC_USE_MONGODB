<!-- markdownlint-disable -->

# AseanSC Fix

Mô phỏng một nền tảng giao dịch chứng khoán realtime theo mô hình bảng giá + đặt lệnh thử nghiệm.
Dự án lấy dữ liệu thị trường realtime từ ASEAN Securities, sau đó cung cấp trải nghiệm frontend giống một sàn giao dịch: theo dõi giá, đặt lệnh Mua/Bán, quản lý số dư, danh mục và hồ sơ người dùng.

## 1. Dự án này làm gì?

- Hiển thị bảng giá realtime (HOSE/HNX/UPCOM) với cập nhật liên tục. Nháy flash khi có thay đổi
- Cho phép đăng ký/đăng nhập, quên mật khẩu qua OTP email.
- Cho phép đặt lệnh mock (Mua/Bán) và theo dõi trạng thái lệnh theo thời gian thực.
- Có mock matching engine để khớp lệnh dựa trên dữ liệu giá thực tế.
- Quản lý tài khoản tiền: liên kết ngân hàng, nạp tiền ảo, theo dõi `available/locked`.
- Hiển thị hồ sơ người dùng + thông tin tài khoản giao dịch.

## 2. Kiến trúc tổng quan

- `frontend` (React + Vite + TypeScript + Ant Design + SCSS Modules)
- `backend` (Express + TypeScript + Socket.IO + MongoDB/Mongoose)
- `ASEAN market feed` (nguồn dữ liệu giá realtime)

Luồng chính:

1. Backend kết nối nguồn dữ liệu thị trường ASEAN, cache và broadcast qua Socket.IO.
2. Frontend nhận realtime event để cập nhật bảng giá/sổ lệnh.
3. Người dùng đặt lệnh qua REST API, backend lưu lệnh vào MongoDB.
4. Matching engine kiểm tra điều kiện khớp và phát `order_update` realtime.

## 3. Công nghệ sử dụng

- Frontend: `React 19`, `Vite`, `TypeScript`, `Ant Design`, `Sass`, `socket.io-client`, `Axios`
- Backend: `Express 5`, `TypeScript`, `Socket.IO`, `Mongoose`, `JWT`, `bcrypt`, `Nodemailer`
- Database: `MongoDB`

## 4. Cấu trúc thư mục

```text
AseanSC_fix/
├─ frontend/                  # UI dashboard, modals, bảng giá, sổ lệnh
├─ backend/                   # API, auth, order/deposit controllers, socket services
├─ sequence_diagram_dat_lenh.jpg
└─ README.md
```

## 5. API chính

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/profile`
- `POST /api/auth/change-password`
- `POST /api/auth/forgot-password/request-otp`
- `POST /api/auth/forgot-password/reset`

Datafeed:

- `GET /api/datafeed/instruments`
- `GET /api/datafeed/indexsnaps/:codes`
- `GET /api/datafeed/chartinday/:code`
- `GET /api/datafeed/industry`

Order:

- `POST /api/orders`
- `GET /api/orders`
- `DELETE /api/orders/:id`
- `GET /api/orders/balance`
- `GET /api/orders/holdings`

Deposit:

- `GET /api/deposit/info`
- `POST /api/deposit/link-bank`
- `POST /api/deposit`

## 6. Realtime events chính

- `instruments_data`: cập nhật dữ liệu bảng giá (snapshot + delta)
- `indexsnaps_data`: cập nhật các chỉ số thị trường
- `chartinday_data`: dữ liệu biểu đồ trong ngày
- `order_update`: cập nhật trạng thái khớp lệnh

## 7. Cách chạy local

Yêu cầu:

- Node.js 18+
- MongoDB local hoặc remote

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Mặc định:

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`

## 8. Biến môi trường backend (gợi ý)

Tạo `.env` trong `backend/`:

```env
JWT_SECRET=your_jwt_secret
MONGO_URI=mongodb://127.0.0.1:27017/AseanSC_DB
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

## 9. Mục tiêu sản phẩm

Đây là dự án mô phỏng giao dịch để:

- luyện fullstack realtime (REST + Socket + DB)
- kiểm thử luồng nghiệp vụ đặt lệnh
- xây nền tảng có thể mở rộng thành hệ thống giao dịch giấy (paper trading) hoàn chỉnh.

## 10. Lưu ý

- Lệnh hiện tại là mô phỏng, không gửi lên sàn giao dịch thật.
- Dữ liệu giá được lấy từ nguồn market feed và cập nhật realtime của seastock.
- Dự án ưu tiên trải nghiệm realtime, theo dõi trạng thái tài khoản sau từng hành động đặt/hủy/khớp lệnh.
# SEA_STOCK_ASEANSC_USE_MONGODB sử dụng mongodb hoàn toàn cho bảng stock, không còn động chạm gì tới asean socket để có thể cập nhập được KL khi mua/bán khớp lệnh thành công
