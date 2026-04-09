// backend/src/server.ts

import express, { Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import datafeedRoutes from "./routes/datafeed";
import orderRoutes from "./routes/order.routes";
import depositRoutes from "./routes/deposit.routes";
import { startPolling } from "./socket/polling";
import { startMatchingEngine } from "./socket/matchingEngine";
import { connectDB } from "./config/database";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = 3001;

// === Cấu hình Socket.IO ===
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  },
});

// === Middleware & Routes ===
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/datafeed", datafeedRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/deposit", depositRoutes);

app.get("/", (_req: Request, res: Response) => {
  res.send(`
    <html>
      <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#1a1a2e;color:#e0e0e0;">
        <div style="text-align:center;">
          <h1>🚀 Backend đang chạy</h1>
          <p>AseanSC Backend Server — Port ${PORT}</p>
        </div>
      </body>
    </html>
  `);
});

// === Hàm khởi động hệ thống ===
async function bootstrap() {
  try {
    // Đợi kết nối DB
    await connectDB();

    // Chạy các dịch vụ ngầm (Sau khi đã có DB)
    // Dùng void để báo hiệu đây là tiến trình chạy nền không chặn (Background tasks)
    void startPolling(io);

    void startMatchingEngine(io);

    // 3. Mở cổng Server
    server.listen(PORT, () => {
      console.log(`✅ Backend server đang chạy tại http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Lỗi khởi động hệ thống:", error);
    process.exit(1);
  }
}

// Thực thi
bootstrap();

export default app;
