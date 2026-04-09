//src/components/MarketIndexCards.tsx
import { memo, useEffect, useMemo, useState } from "react";
import { CaretUpFilled, CaretDownFilled } from "@ant-design/icons";
import styles from "../scss/MarketIndexCards.module.scss";
import socket from "../websocket/client";
import axios from "axios";
import { mapMarketStatus as mapStatus } from "../types/marketStatus";

// Interface chung
interface MarketIndex {
  marketCode: string;
  marketIndex: string;
  indexChange: string;
  indexPercentChange: string;
  totalVolume: string;
  totalValue: string;
  indexColor: "up" | "down" | "ref";

  advances: string;
  declines: string;
  noChange: string;
  advancesCeiling?: string; // số mã trần (từ socket field AV)
  declinesFloor?: string; // số mã sàn (từ socket field DV)

  numberOfCe?: string; // Số mã trần (CE)
  numberOfFl?: string; // Số mã sàn (FL)

  MC?: string;
  MI?: string;
  ICH?: string;
  IPC?: string;
  TV?: string;
  TVA?: string;
  AV?: string; // advances
  DE?: string; // declines
  NC?: string; // noChange
  FL?: string; // numberOfFl
  CE?: string; // numberOfCe
  MS?: string;
  IT?: string;
  status?: string;
  time?: string;
}

interface MarketIndexCardProps {
  indexName: string;
  marketCode: string;
  marketIndex: string;
  indexChange: string;
  indexPercentChange: string;
  totalVolume: string;
  totalValue: string;
  indexColor: "up" | "down" | "ref";
  advances: string;
  declines: string;
  noChange: string;
  numberOfCe: string; // bắt buộc hiển thị, nếu ko có thì ""
  numberOfFl: string;
  statusText: string; // Trạng thái thị trường để điều chỉnh màu sắc nếu cần
  chartResponse?: Record<string, unknown>; // chart data từ socket
}

// Order và mapping tên hiển thị
const INDEX_ORDER = ["HOSE", "30", "HNX", "HNX30", "UPCOM"];
const INDEX_NAMES: Record<string, string> = {
  HOSE: "VN-INDEX",
  "30": "VN30-INDEX",
  HNX: "HNX-INDEX",
  HNX30: "HNX30-INDEX",
  UPCOM: "UPCOM",
};

// Component con: MarketIndexCard
const MarketIndexCard = ({
  indexName,
  marketCode,
  marketIndex,
  indexChange,
  indexPercentChange,
  totalVolume,
  totalValue,
  indexColor,
  advances,
  declines,
  noChange,
  numberOfCe = "", // default rỗng nếu API chưa có
  numberOfFl = "",
  statusText = "Đang tải...",
  chartResponse,
}: MarketIndexCardProps) => {
  // Tính chartPoints + refLineY từ chartResponse
  const { chartPoints, refLineY } = useMemo(() => {
    if (!chartResponse) return { chartPoints: "", refLineY: 35 };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = chartResponse as any;
      if (data[marketCode] && data[marketCode].d && data[marketCode].d[marketCode] && data[marketCode].d[marketCode].close) {
        const closeData = data[marketCode].d[marketCode].close;
        const timeData: string[] | undefined = data[marketCode].d[marketCode].formattedtime;
        const unixTimeData: number[] | undefined = data[marketCode].d[marketCode].unixtime;
        const min = Math.min(...closeData);
        const max = Math.max(...closeData);
        const range = max - min || 1;

        // ======== BẮT ĐẦU: xử lý biến X theo trục thời gian ========
        // Phiên VN: 09:00-11:30 (150') và 13:00-15:00 (120').
        // Tính X theo timeline (formattedtime/unixtime), không dàn theo số lượng điểm.
        // Để tránh bị dồn bên trái đầu phiên, chuẩn hóa theo số phút đã trôi qua tới điểm mới nhất (không dùng cố định 270').
        const FULL_DAY_TRADING_MINUTES = 270;
        const parseHHMMSS = (t: string): number | null => {
          const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(t); //chỉ lấy HH:MM
          if (!m) return null;
          const hh = Number(m[1]);
          const mm = Number(m[2]);
          if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
          return hh * 60 + mm;
        };
        const toMinuteIndex = (minuteOfDay: number): number => {
          const OPEN = 9 * 60; // 09:00
          const LUNCH_START = 11 * 60 + 30; // 11:30
          const LUNCH_END = 13 * 60; // 13:00
          const CLOSE = 15 * 60; // 15:00

          if (minuteOfDay <= OPEN) return 0;
          if (minuteOfDay < LUNCH_START) return minuteOfDay - OPEN;
          if (minuteOfDay < LUNCH_END) return LUNCH_START - OPEN; // giờ nghỉ trưa: giữ tại cuối phiên sáng
          if (minuteOfDay < CLOSE) return LUNCH_START - OPEN + (minuteOfDay - LUNCH_END);
          return FULL_DAY_TRADING_MINUTES;
        };

        const minuteIndices: Array<number | null> = closeData.map((_: number, index: number) => {
          if (timeData && typeof timeData[index] === "string") {
            const mod = parseHHMMSS(timeData[index]);
            return mod == null ? null : toMinuteIndex(mod);
          }
          if (unixTimeData && typeof unixTimeData[index] === "number") {
            const d = new Date(unixTimeData[index] * 1000);
            return toMinuteIndex(d.getHours() * 60 + d.getMinutes());
          }
          return null;
        });

        // Lấy phút giao dịch lớn nhất hiện có để làm mốc chuẩn hóa X.
        const maxMinuteIndex = Math.max(1, ...minuteIndices.map((v) => (typeof v === "number" ? v : 0)));
        const points = closeData.map((price: number, index: number) => {
          const minuteIndex = minuteIndices[index];
          // Fallback khi thiếu time array: quay về cách cũ (dàn đều theo index).
          const x =
            minuteIndex == null
              ? (index / Math.max(closeData.length - 1, 1)) * 120
              : (Math.max(0, Math.min(maxMinuteIndex, minuteIndex)) / maxMinuteIndex) * 120;
          // ======== KẾT THÚC: xử lý biến X theo trục thời gian ========

          const y = 50 - ((price - min) / range) * 40;
          return `${x},${y}`;
        });

        // Giá tham chiếu = điểm đầu tiên trong ngày (giá đóng cửa phiên trước)
        const refPrice = closeData[0];
        const refY = 50 - ((refPrice - min) / range) * 40;

        return { chartPoints: points.join(" "), refLineY: refY };
      }
    } catch (err) {
      console.error(`Error processing chart for ${marketCode}:`, err);
    }
    return { chartPoints: "", refLineY: 35 };
  }, [chartResponse, marketCode]);

  const getColorClass = () => {
    switch (indexColor) {
      case "up":
        return styles.colorUp;
      case "down":
        return styles.colorDown;
      case "ref":
        return styles.colorRef;
      default:
        return styles.colorUp;
    }
  };

  const getRealColor = () => {
    const change = parseFloat(indexChange || "0");

    if (change > 0) return "up";
    if (change < 0) return "down";
    return "ref";
  };

  const getIconColor = () => {
    const color = getRealColor();

    switch (color) {
      case "up":
        return "#02f206";
      case "down":
        return "red";
      case "ref":
        return "#ffff00";
      default:
        return "#ffff00";
    }
  };

  const getIcon = () => {
    const color = getRealColor();

    switch (color) {
      case "up":
        return <CaretUpFilled />;
      case "down":
        return <CaretDownFilled />;
      case "ref":
        return <span style={{ fontSize: 14 }}>■</span>;
      default:
        return <span style={{ fontSize: 14 }}>■</span>;
    }
  };

  const formatVolume = (value?: string | null) => {
    if (!value || Number(value) === 0) return "-";
    return Number(value).toLocaleString("en-US");
  };

  const formatValue = (value?: string | null) => {
    const num = parseFloat(value || "");
    if (!value || isNaN(num) || num === 0) return "-";

    return (num / 1e9).toLocaleString("en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  };
  const formatChange = (change: string) => {
    const num = parseFloat(change);
    return num >= 0 ? `+${change}` : change;
  };
  const formatPercentChange = (change: string) => {
    const num = parseFloat(change);
    return num >= 0 ? `+${change}` : change;
  };

  return (
    <div className={`${styles.card} ${getColorClass()}`}>
      <div className={styles.content}>
        {/* LEFT 70% */}
        <div className={styles.info}>
          <div className={styles.line1}>
            <div className={styles.indexNameWithIcon}>
              <span className={styles.indexName}>{indexName}</span>
              <span className={styles.icon} style={{ color: getIconColor() }}>
                {getIcon()} {marketIndex}
              </span>
            </div>
          </div>

          <div className={styles.line2}>
            <span style={{ color: getIconColor() }}>
              {indexChange != null ? formatChange(indexChange) : 0} ({indexPercentChange != null ? formatPercentChange(indexPercentChange) : "-"}
              %)
            </span>
          </div>

          <div className={styles.line3}>
            <span className={styles.number}>{totalVolume != null ? formatVolume(totalVolume) : "-"}</span>
            <span className={styles.unit}>&nbsp;CP</span>
            &nbsp;
            <span className={styles.number}>{totalValue != null ? formatValue(totalValue) : "-"}</span>
            <span className={styles.unit}>&nbsp;Tỷ</span>
          </div>

          <div className={styles.line4}>
            <span className={styles.advances}>
              ▲ {advances ?? 0}
              <span className={styles.ce}>({numberOfCe ?? 0})</span>
            </span>

            <span className={styles.noChange}>■ {noChange ?? 0}</span>

            <span className={styles.declines}>
              ▼ {declines ?? 0}
              <span className={styles.fl}>({numberOfFl ?? 0})</span>
            </span>
          </div>
        </div>

        {/* RIGHT 30% */}
        <div className={styles.chartWrapper}>
          <div className={styles.miniChart}>
            <svg viewBox="0 0 120 50" preserveAspectRatio="none">
              <polyline points={chartPoints} fill="none" stroke={getIconColor()} strokeWidth="1.6" />
              <line x1="0" y1={refLineY} x2="120" y2={refLineY} stroke="#ebce5b" strokeDasharray="4,3" strokeWidth="0.6" />
            </svg>
          </div>
          <div className={styles.statusLabel}>{statusText}</div>
        </div>
      </div>
    </div>
  );
};

// Component chính
const MarketIndexCards = () => {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartDataMap, setChartDataMap] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let isMounted = true;

    // 1. Load full data lần đầu (có numberOfCe, numberOfFl, advances đầy đủ)
    const loadInitialIndexsnaps = async () => {
      try {
        const res = await axios.get("/api/datafeed/indexsnaps/HOSE,30,HNX,HNX30,UPCOM");
        if (res.data.s === "ok" && res.data.d && isMounted) {
          processIndexData(res.data.d);
        }
      } catch (err) {
        console.error("Lỗi load initial indexsnaps:", err);
      }
    };

    // 2. Xử lý data (dùng chung cho initial + delta)
    const processIndexData = (rawData: MarketIndex[]) => {
      const sortedIndices = INDEX_ORDER.map((code) => rawData.find((item: MarketIndex) => item.marketCode === code || item.MC === code)).filter(
        Boolean,
      ) as MarketIndex[];

      const enriched: MarketIndex[] = sortedIndices.map((item) => {
        const changeStr = (item.indexChange || item.ICH || "0").toString();
        const changeNum = parseFloat(changeStr);

        return {
          marketCode: item.marketCode || item.MC || "",
          marketIndex: (item.marketIndex || item.MI || "0").toString(),
          indexChange: changeStr,
          indexPercentChange: (item.indexPercentChange || item.IPC || "0").toString(),
          totalVolume: (item.totalVolume || item.TV || "0").toString(),
          totalValue: (item.totalValue || item.TVA || "0").toString(),

          // Tính indexColor đúng type
          indexColor: changeNum > 0 ? "up" : changeNum < 0 ? "down" : "ref",

          // Quan trọng: Dùng đúng field từ cả REST và Socket
          advances: (item.advances || item.AV || "0").toString(),
          declines: (item.declines || item.DE || "0").toString(),
          noChange: (item.noChange || item.NC || "0").toString(),
          numberOfCe: (item.numberOfCe || item.CE || "0").toString(),
          numberOfFl: (item.numberOfFl || item.FL || "0").toString(),

          MC: item.MC,
          MI: item.MI,
          ICH: item.ICH,
          IPC: item.IPC,
          TV: item.TV,
          TVA: item.TVA,
          AV: item.AV,
          DE: item.DE,
          NC: item.NC,
          status: item.MS,
          time: item.IT,
        };
      });

      setIndices(enriched);
      setLoading(false);
    };

    // 3. Lắng nghe realtime từ socket (delta) — chỉ số chính + số mã tăng/đứng/giảm
    // Lưu ý: numberOfCe/numberOfFl (số mã trần/sàn) KHÔNG có trong socket idx — giữ nguyên từ polling
    const handleIndexsnaps = (data: { s: string; d?: MarketIndex[] }) => {
      if (data.s !== "ok" || !data.d) return;

      setIndices((prev) => {
        return prev.map((oldItem) => {
          const update = data.d!.find((i) => (i.marketCode || i.MC) === oldItem.marketCode);
          if (!update) return oldItem;

          const change = (update.indexChange || update.ICH || oldItem.indexChange || "0").toString();
          const changeNum = parseFloat(change || "0");

          return {
            ...oldItem,
            // Chỉ số chính
            marketIndex: (update.marketIndex || update.MI || oldItem.marketIndex).toString(),
            indexChange: change,
            indexPercentChange: (update.indexPercentChange || update.IPC || oldItem.indexPercentChange).toString(),
            totalVolume: (update.totalVolume || update.TV || oldItem.totalVolume).toString(),
            totalValue: (update.totalValue || update.TVA || oldItem.totalValue).toString(),
            indexColor: changeNum > 0 ? "up" : changeNum < 0 ? "down" : "ref",
            status: (update.status || update.MS || oldItem.status || "").toString(),
            time: (update.time || update.IT || oldItem.time || "").toString(),
            // Hàng cuối: số mã tăng/đứng/giảm (có trong socket)
            advances: update.advances !== undefined ? update.advances.toString() : oldItem.advances,
            noChange: update.noChange !== undefined ? update.noChange.toString() : oldItem.noChange,
            declines: update.declines !== undefined ? update.declines.toString() : oldItem.declines,
            // numberOfCe/numberOfFl (số mã trần/sàn) giữ nguyên — được cập nhật bằng polling bên dưới
          };
        });
      });
    };

    const handleChartData = (data: Record<string, unknown>) => {
      setChartDataMap(data);
    };
    // Tải dữ liệu ban đầu
    loadInitialIndexsnaps();

    // - numberOfCe/numberOfFl (số mã trần/sàn): không có trong socket idx
    // - advances/declines/noChange: socket idx chỉ gửi khi thay đổi, REST cho ground truth
    const pollingInterval = setInterval(async () => {
      try {
        const res = await axios.get("/api/datafeed/indexsnaps/HOSE,30,HNX,HNX30,UPCOM");
        if (res.data.s !== "ok" || !res.data.d) return;
        const pollingData: MarketIndex[] = res.data.d;
        setIndices((prev) => {
          return prev.map((oldItem) => {
            const update = pollingData.find((i) => i.marketCode === oldItem.marketCode || i.MC === oldItem.marketCode);
            if (!update) return oldItem;
            return {
              ...oldItem,
              advances: (update.advances ?? oldItem.advances).toString(),
              declines: (update.declines ?? oldItem.declines).toString(),
              noChange: (update.noChange ?? oldItem.noChange).toString(),
              numberOfCe: (update.numberOfCe ?? oldItem.numberOfCe ?? "").toString(),
              numberOfFl: (update.numberOfFl ?? oldItem.numberOfFl ?? "").toString(),
            };
          });
        });
      } catch (err) {
        console.error("Polling indexsnaps lỗi:", err);
      }
    }, 5000);

    // Lắng nghe socket
    socket.on("indexsnaps_data", handleIndexsnaps);
    socket.on("chartinday_data", handleChartData);

    return () => {
      isMounted = false;
      clearInterval(pollingInterval);
      socket.off("indexsnaps_data", handleIndexsnaps);
      socket.off("chartinday_data", handleChartData);
    };
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingMessage}>Đang tải dữ liệu chỉ số thị trường...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.cardsWrapper}>
        {indices.map((index) => (
          <MarketIndexCard
            key={index.marketCode}
            indexName={INDEX_NAMES[index.marketCode]}
            marketCode={index.marketCode}
            marketIndex={index.marketIndex}
            indexChange={index.indexChange}
            indexPercentChange={index.indexPercentChange}
            totalVolume={index.totalVolume}
            totalValue={index.totalValue}
            indexColor={index.indexColor}
            advances={index.advances}
            declines={index.declines}
            noChange={index.noChange}
            numberOfCe={index.numberOfCe || ""}
            numberOfFl={index.numberOfFl || ""}
            statusText={mapStatus(index.status || index.MS)}
            chartResponse={chartDataMap}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(MarketIndexCards);
