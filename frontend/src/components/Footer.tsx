//src/components/Footer.tsx
import { memo, useEffect, useState } from "react";
import axios from "axios";
import { ClockCircleOutlined } from "@ant-design/icons";
import type { UnitSettings } from "../types/tableConfig";
import styles from "../scss/Footer.module.scss";

const Footer = ({ unitSettings }: { unitSettings: UnitSettings }) => {
  const [displayTime, setDisplayTime] = useState<string>("Đang tải dữ liệu thời gian...");

  useEffect(() => {
    let serverTimeMs: number | null = null;
    let localOriginMs: number | null = null;

    const syncTime = async () => {
      try {
        const res = await axios.get("/api/datafeed/time");
        if (res.data?.d?.currentTimeDb) {
          serverTimeMs = new Date(res.data.d.currentTimeDb).getTime();
          localOriginMs = Date.now();
        }
      } catch (err) {
        console.error("Fetch time error:", err);
      }
    };

    // 🔥 đồng bộ lần đầu
    syncTime();

    // 🔥 đồng bộ lại mỗi 30s
    const resyncInterval = setInterval(syncTime, 30000);

    // 🔥 clock chạy mượt
    const clockInterval = setInterval(() => {
      if (serverTimeMs !== null && localOriginMs !== null) {
        const elapsed = Date.now() - localOriginMs;
        const now = new Date(serverTimeMs + elapsed);
        const d = now.toLocaleDateString("vi-VN");
        const t = now.toLocaleTimeString("vi-VN");
        setDisplayTime(`${d} - ${t}`);
      }
    }, 500);

    return () => {
      clearInterval(clockInterval);
      clearInterval(resyncInterval);
    };
  }, []);

  return (
    <footer className={styles.footer}>
      {/* divider */}
      <div className={styles.divider}></div>
      {/* trái: clock */}
      <div className={styles.clock}>
        <ClockCircleOutlined />
        <span>{displayTime}</span>
      </div>

      {/* phải: unit info */}
      <div className={styles.unit}>
        Đơn vị: Giá x{unitSettings.price.toLocaleString()}&nbsp;&nbsp;&nbsp;Khối lượng x{unitSettings.volume}&nbsp;&nbsp;&nbsp;Giá trị x
        {unitSettings.value.toLocaleString()}
      </div>
    </footer>
  );
};

export default memo(Footer);
