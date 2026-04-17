//src/components/StockTable.tsx
import {  useState, useEffect, useRef, useMemo, useCallback, useImperativeHandle, forwardRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PushpinOutlined, LockOutlined } from "@ant-design/icons";
import type { UnitSettings, ColumnVisibility } from "../types/tableConfig";
import type { Order, OrderInstrumentInfo, OrderSide } from "../types/order";
import styles from "../scss/StockTable.module.scss";

// ====================== SORT DỮ LIỆU KHI NHẤN VÀO CỘT ======================
type SortDirection = "default" | "asc" | "desc";

// Key sort tương ứng field trong Instrument (hoặc computed)
type SortKey =
  | "symbol"
  | "reference"
  | "ceiling"
  | "floor"
  | "bidPrice3"
  | "bidVol3"
  | "bidPrice2"
  | "bidVol2"
  | "bidPrice1"
  | "bidVol1"
  | "closePrice"
  | "closeVol"
  | "change"
  | "changePercent"
  | "offerPrice1"
  | "offerVol1"
  | "offerPrice2"
  | "offerVol2"
  | "offerPrice3"
  | "offerVol3"
  | "totalTrading"
  | "totalValue" // Tính bằng: totalTrading * averagePrice
  | "TOTAL_BID_QTTY"
  | "TOTAL_OFFER_QTTY"
  | "high"
  | "averagePrice"
  | "low"
  | "foreignBuy"
  | "foreignSell"
  | "foreignRemain";

interface Instrument {
  symbol: string;
  FullName?: string;
  reference: number;
  ceiling: number;
  floor: number;
  bidPrice3: number;
  bidVol3: number;
  bidPrice2: number;
  bidVol2: number;
  bidPrice1: number;
  bidVol1: number;
  closePrice: number;
  closeVol: number;
  change: number;
  changePercent: number;
  offerPrice1: number;
  offerVol1: number;
  offerPrice2: number;
  offerVol2: number;
  offerPrice3: number;
  offerVol3: number;
  totalTrading: number;
  high: number;
  low: number;
  averagePrice: number;
  foreignBuy: number;
  foreignSell: number;
  foreignRemain?: number;
  TOTAL_BID_QTTY?: number;
  TOTAL_OFFER_QTTY?: number;
}

interface StockTableProps {
  instruments: Instrument[];
  pinnedSymbols: Set<string>;
  onTogglePin: (symbol: string) => void;
  loading?: boolean;
  flashingCells: Map<string, { dir: "up" | "down"; seq: number }>;
  unitSettings: UnitSettings;
  columnVisibility: ColumnVisibility;
  selectedExchange: string;
  // --- Order feature ---
  token: string | null;
  activeOrdersMap: Map<string, Order>;
  onOrderClick: (symbol: string, instrumentInfo: OrderInstrumentInfo, side: OrderSide) => void;
}

// Expose ref để Dashboard có thể điều khiển scroll (chế độ trình chiếu + tìm kiếm)
export interface StockTableHandle {
  getScrollElement: () => HTMLDivElement | null;
  scrollToSymbol: (symbol: string) => void;
}

const ROW_HEIGHT = 30;
const NUMBER_FORMATTER_2 = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUMBER_FORMATTER_0 = new Intl.NumberFormat("vi-VN");

const StockTable = forwardRef<StockTableHandle, StockTableProps>(
  ({ instruments, pinnedSymbols, onTogglePin, flashingCells, loading = false, unitSettings, columnVisibility: v, selectedExchange, token, activeOrdersMap, onOrderClick }, ref) => {
    // TanStack Virtual setup - PHẢI được gọi không điều kiện TRƯỚC bất kỳ return sớm nào
    const parentRef = useRef<HTMLDivElement>(null);

    // Label sàn giao dịch
    const exchangeLabel = selectedExchange === "30" ? "HOSE" : selectedExchange === "HNX30" ? "HNX" : selectedExchange;

    // Tính grid-template-columns dynamic theo từng sub-column đang hiển thị
    const gridTemplate = useMemo(() => {
      const cols: string[] = [];
      cols.push("35fr"); // pin (luôn hiện)
      cols.push("55fr"); // lệnh (luôn hiện)
      if (v.symbol) cols.push("65fr");
      if (v.exchange) cols.push("55fr");
      if (v.reference) cols.push("55fr");
      if (v.ceiling) cols.push("55fr");
      if (v.floor) cols.push("55fr");
      // bid
      if (v.bidPrice3) cols.push("50fr");
      if (v.bidVol3) cols.push("55fr");
      if (v.bidPrice2) cols.push("50fr");
      if (v.bidVol2) cols.push("55fr");
      if (v.bidPrice1) cols.push("50fr");
      if (v.bidVol1) cols.push("55fr");
      // match
      if (v.matchPrice) cols.push("50fr");
      if (v.matchVol) cols.push("55fr");
      if (v.matchChange) cols.push("50fr");
      if (v.matchChangePercent) cols.push("55fr");
      // ask
      if (v.offerPrice1) cols.push("50fr");
      if (v.offerVol1) cols.push("55fr");
      if (v.offerPrice2) cols.push("50fr");
      if (v.offerVol2) cols.push("55fr");
      if (v.offerPrice3) cols.push("50fr");
      if (v.offerVol3) cols.push("55fr");
      // totalTrading, totalValue
      if (v.totalTrading) cols.push("65fr");
      if (v.totalValue) cols.push("65fr");
      // surplus
      if (v.surplusBid) cols.push("50fr");
      if (v.surplusOffer) cols.push("50fr");
      // price
      if (v.priceHigh) cols.push("50fr");
      if (v.priceAvg) cols.push("55fr");
      if (v.priceLow) cols.push("50fr");
      // foreign
      if (v.foreignBuy) cols.push("65fr");
      if (v.foreignSell) cols.push("65fr");
      if (v.foreignRemain) cols.push("85fr");
      return cols.join(" ");
    }, [v]);

    // Tính span cho từng nhóm header (chỉ đếm sub-columns đang hiện)
    const bidSpan = [v.bidPrice3, v.bidVol3, v.bidPrice2, v.bidVol2, v.bidPrice1, v.bidVol1].filter(Boolean).length;
    const matchSpan = [v.matchPrice, v.matchVol, v.matchChange, v.matchChangePercent].filter(Boolean).length;
    const askSpan = [v.offerPrice1, v.offerVol1, v.offerPrice2, v.offerVol2, v.offerPrice3, v.offerVol3].filter(Boolean).length;
    const surplusSpan = [v.surplusBid, v.surplusOffer].filter(Boolean).length;
    const priceSpan = [v.priceHigh, v.priceAvg, v.priceLow].filter(Boolean).length;
    const foreignSpan = [v.foreignBuy, v.foreignSell, v.foreignRemain].filter(Boolean).length;

    // ====================== SORT STATE ======================
    const [sortKey, setSortKey] = useState<SortKey | null>(null);
    const [sortDir, setSortDir] = useState<SortDirection>("default");
    const [sortAnimating, setSortAnimating] = useState(false); //animation

    // Vòng đời: Mặc định → tăng dần → giảm dần → Mặc định
    const handleSort = useCallback((key: SortKey) => {
      setSortAnimating(true); // bật hiệu ứng fade trước khi sort
      if (sortKey !== key) {
        // Nhấn cột mới → bắt đầu "tăng dần"
        setSortKey(key);
        setSortDir("asc");
      } else {
        // Cùng cột → vòng đời tiếp là giảm dần
        setSortDir((prev) => {
          if (prev === "asc") return "desc";
          if (prev === "desc") {
            setSortKey(null); // Về mặc định → xóa sort key
            return "default";
          }
          return "asc";
        });
      }
    }, [sortKey]);

    // Tắt hiệu ứng fade sau khi animation chạy xong
    useEffect(() => {
      if (!sortAnimating) return;
      const timer = setTimeout(() => setSortAnimating(false), 300);
      return () => clearTimeout(timer);
    }, [sortAnimating]);

    // Icon hiển thị cạnh tên cột
    const sortIcon = (key: SortKey) => {
      if (sortKey !== key || sortDir === "default") return "";
      return sortDir === "asc" ? " ↑" : " ↓";
    };

    // Phân chia các instruments thành pinned và normal
    const { pinnedInstruments, normalInstruments } = (() => {
      const pinned = instruments.filter((stock) => pinnedSymbols.has(stock.symbol));
      const normal = instruments.filter((stock) => !pinnedSymbols.has(stock.symbol));
      return { pinnedInstruments: pinned, normalInstruments: normal };
    })();

    // ====================== SẮP XẾP ======================
    const sortedNormalInstruments = useMemo(() => {
      if (!sortKey || sortDir === "default") return normalInstruments;

      const sorted = [...normalInstruments].sort((a, b) => {
        let valA: number | string;
        let valB: number | string;

        if (sortKey === "symbol") {
          // alphabet toàn bộ chuỗi (AAA < AAB < ABC)
          valA = a.symbol;
          valB = b.symbol;
          const cmp = valA.localeCompare(valB);
          return sortDir === "asc" ? cmp : -cmp;
        }

        // Tính toán field: tổng giá trị = totalTrading × averagePrice
        if (sortKey === "totalValue") {
          valA = (a.totalTrading || 0) * (a.averagePrice || 0);
          valB = (b.totalTrading || 0) * (b.averagePrice || 0);
        } else {
          valA = (a[sortKey as keyof Instrument] as number) || 0;
          valB = (b[sortKey as keyof Instrument] as number) || 0;
        }

        return sortDir === "asc" ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      });

      return sorted;
    }, [normalInstruments, sortKey, sortDir]);

    // Virtualizer for normal rows only
    const virtualizer = useVirtualizer({
      count: sortedNormalInstruments.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => ROW_HEIGHT,
      overscan: 8,
    });

    // Expose scroll container + scrollToSymbol ra ngoài qua ref (dùng cho chế độ trình chiếu + tìm kiếm)
    useImperativeHandle(ref, () => ({
      getScrollElement: () => parentRef.current,
      scrollToSymbol: (symbol: string) => {
        // Tìm index của mã trong danh sách đã sắp xếp (không tính pinned)
        const index = sortedNormalInstruments.findIndex((s) => s.symbol === symbol);
        if (index >= 0) {
          // Nhảy thẳng đến vị trí của mã đó — đưa lên sát header (dòng đầu tiên trong viewport)
          virtualizer.scrollToIndex(index, { align: "start" });
        }
      },
    }));

    // Hiển thị trạng thái đang tải
    if (loading) {
      return (
        <div className={styles.container} style={{ padding: "20px", textAlign: "center", color: "#d1d5db" }}>
          Đang tải dữ liệu...
        </div>
      );
    }

    // Hiển thị trạng thái trống
    if (!instruments || instruments.length === 0) {
      return (
        <div className={styles.container} style={{ padding: "20px", textAlign: "center", color: "#d1d5db" }}>
          Không có dữ liệu
        </div>
      );
    }

    const formatNumber = (value: number | undefined) => {
      if (value === undefined || value === null || value === 0) return "";
      const divided = value / unitSettings.price; // chia cho đơn vị giá để hiển thị
      return NUMBER_FORMATTER_2.format(divided);
    };

    const formatVolume = (value: number | undefined) => {
      if (value === undefined || value === null || value === 0) return "";
      const divided = value / unitSettings.volume; // chia cho đơn vị khối lượng để hiển thị
      return NUMBER_FORMATTER_0.format(divided);
    };

    //Dùng cho cột tổng GT
    const formatValue = (value: number | undefined) => {
      if (value === undefined || value === null || value === 0) return "";
      const divided = value / unitSettings.value;
      if (unitSettings.value === 1_000_000) {
        // triệu → làm tròn số nguyên
        return NUMBER_FORMATTER_0.format(Math.round(divided));
      }
      if (unitSettings.value === 1_000_000_000) {
        // tỷ → làm tròn 2 chữ số thập phân
        const rounded = Math.round(divided * 100) / 100;
        return NUMBER_FORMATTER_2.format(rounded);
      }
      return NUMBER_FORMATTER_0.format(divided);
    };

    const formatChange = (value: number | undefined) => {
      if (value === undefined || value === null || value === 0) return "";

      const divided = value / unitSettings.price; // chia cho đơn vị giá để hiển thị
      const rounded = Math.round(divided * 100) / 100;
      const sign = rounded > 0 ? "+" : ""; // Thêm dấu + nếu > 0
      return `${sign}${rounded.toFixed(2)}`;
    };

    const formatChangePercent = (value: number | undefined) => {
      if (value === undefined || value === null || value === 0) return "";

      const rounded = Math.round(value * 100) / 100;
      const sign = rounded > 0 ? "+" : "";

      return `${sign}${rounded.toFixed(2)}%`;
    };

    // Làm tròn giá về 2 chữ số thập phân để tránh lỗi floating point (2.8800000001 !== 2.88)
    const n = (v: number | undefined) => {
      if (v === undefined || v === null || v === 0) return undefined;
      return Math.round(v * 100) / 100;
    };

    const getStockColor = (price: number | undefined, reference: number | undefined, ceiling: number | undefined, floor: number | undefined) => {
      const p = n(price);
      const r = n(reference);
      const c = n(ceiling);
      const f = n(floor);

      if (p === undefined || r === undefined) return styles.tc;

      // Ưu tiên: trần → sàn → tham chiếu → tăng/giảm
      if (c !== undefined && p === c) return styles.ceiling; // tím
      if (f !== undefined && p === f) return styles.floor; // xanh lơ
      if (p === r) return styles.tc; // vàng

      if (p > r) return styles.up; // xanh lá
      if (p < r) return styles.down; // đỏ

      return styles.tc;
    };

    const getChangeColorByValue = (change?: number) => {
      if (change === undefined || change === null) return styles.neutral;
      if (change === 0) return styles.tc;

      return change > 0 ? styles.up : styles.down;
    };

    // Component hàng cho TanStack Virtual
    const Row = ({ stock }: { stock: Instrument }) => {
      if (!stock) return null;

      const cellFlash = (field: string, colorPrice?: number) => {
        const flash = flashingCells.get(`${stock.symbol}:${field}`);
        if (!flash) return "";
        const dir = flash.dir;
        if (colorPrice !== undefined) {
          const p = n(colorPrice);
          const r = n(stock.reference);
          const c = n(stock.ceiling);
          const f = n(stock.floor);
          if (p !== undefined && r !== undefined) {
            if (c !== undefined && p === c) return styles.flashCellCeiling;
            if (f !== undefined && p === f) return styles.flashCellFloor;
            if (p === r) return styles.flashCellTC;
            if (p > r) return styles.flashCellUp;
            return styles.flashCellDown;
          }
        }
        return dir === "up" ? styles.flashCellUp : styles.flashCellDown;
      };

      const db = styles.darkBg;
      const sc = (p: number | undefined) => getStockColor(p, stock.reference, stock.ceiling, stock.floor);

      return (
        <div className={styles.bodyRow} style={{ gridTemplateColumns: gridTemplate }}>
          {/* Pin */}
          <div className={styles.cellPin}>
            <button
              className={`${styles.pinButton} ${pinnedSymbols.has(stock.symbol) ? styles.pinned : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTogglePin(stock.symbol);
              }}
              title="Ghim/Bỏ ghim"
            >
              <PushpinOutlined />
            </button>
          </div>

          {/* Lệnh — luôn hiện */}
          <div className={styles.cellLenh}>
            {!token ? (
              <button className={styles.orderLockBtn} title="Vui lòng đăng nhập để đặt lệnh">
                <LockOutlined style={{ fontSize: 12, color: "#4b5563" }} />
              </button>
            ) : (
              <>
                {activeOrdersMap.has(stock.symbol) && (
                  <span className={styles.orderDot} title="Bạn đang có lệnh chờ khớp ở mã này" />
                )}
                <button
                  className={styles.orderBuyBtn}
                  title="Đặt lệnh Mua"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onOrderClick(
                      stock.symbol,
                      { symbol: stock.symbol, FullName: stock.FullName, reference: stock.reference, ceiling: stock.ceiling, floor: stock.floor, closePrice: stock.closePrice, bidPrice1: stock.bidPrice1, offerPrice1: stock.offerPrice1, totalTrading: stock.totalTrading },
                      "buy",
                    );
                  }}
                >
                  M
                </button>
                <button
                  className={styles.orderSellBtn}
                  title="Đặt lệnh Bán"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onOrderClick(
                      stock.symbol,
                      { symbol: stock.symbol, FullName: stock.FullName, reference: stock.reference, ceiling: stock.ceiling, floor: stock.floor, closePrice: stock.closePrice, bidPrice1: stock.bidPrice1, offerPrice1: stock.offerPrice1, totalTrading: stock.totalTrading },
                      "sell",
                    );
                  }}
                >
                  B
                </button>
              </>
            )}
          </div>

          {/* Mã CK */}
          {v.symbol && (
            <div
              className={`${styles.cellSymbol} ${styles.bold} ${sc(stock.closePrice)}`}
              title={stock.FullName ? `${stock.symbol} - ${stock.FullName}` : stock.symbol}
            >
              {stock.symbol}
            </div>
          )}

          {/* Sàn (Exchange) */}
          {v.exchange && <div className={styles.cellExchange}>{exchangeLabel}</div>}

          {/* TC */}
          {v.reference && <div className={`${styles.cellTC} ${db}`}>{formatNumber(stock.reference)}</div>}

          {/* Trần */}
          {v.ceiling && <div className={`${styles.cellCeiling} ${db}`}>{formatNumber(stock.ceiling)}</div>}

          {/* Sàn (giá sàn) */}
          {v.floor && <div className={`${styles.cellFloor} ${db}`}>{formatNumber(stock.floor)}</div>}

          {/* Bên mua — per sub-column */}
          {v.bidPrice3 && (
            <div className={`${styles.cellPrice} ${sc(stock.bidPrice3)} ${cellFlash("bidPrice3", stock.bidPrice3)}`}>
              {formatNumber(stock.bidPrice3)}
            </div>
          )}
          {v.bidVol3 && (
            <div className={`${styles.cellVolume} ${sc(stock.bidPrice3)} ${cellFlash("bidVol3", stock.bidPrice3)}`}>
              {formatVolume(stock.bidVol3)}
            </div>
          )}
          {v.bidPrice2 && (
            <div className={`${styles.cellPrice} ${sc(stock.bidPrice2)} ${cellFlash("bidPrice2", stock.bidPrice2)}`}>
              {formatNumber(stock.bidPrice2)}
            </div>
          )}
          {v.bidVol2 && (
            <div className={`${styles.cellVolume} ${sc(stock.bidPrice2)} ${cellFlash("bidVol2", stock.bidPrice2)}`}>
              {formatVolume(stock.bidVol2)}
            </div>
          )}
          {v.bidPrice1 && (
            <div className={`${styles.cellPrice} ${styles.highlight} ${sc(stock.bidPrice1)} ${cellFlash("bidPrice1", stock.bidPrice1)}`}>
              {formatNumber(stock.bidPrice1)}
            </div>
          )}
          {v.bidVol1 && (
            <div className={`${styles.cellVolume} ${styles.highlight} ${sc(stock.bidPrice1)} ${cellFlash("bidVol1", stock.bidPrice1)}`}>
              {formatVolume(stock.bidVol1)}
            </div>
          )}

          {/* Khớp lệnh — per sub-column */}
          {v.matchPrice && (
            <div className={`${styles.cellPrice} ${db} ${sc(stock.closePrice)} ${cellFlash("closePrice", stock.closePrice)}`}>
              {formatNumber(stock.closePrice)}
            </div>
          )}
          {v.matchVol && (
            <div className={`${styles.cellVolume} ${db} ${sc(stock.closePrice)} ${cellFlash("closeVol", stock.closePrice)}`}>
              {formatVolume(stock.closeVol)}
            </div>
          )}
          {v.matchChange && (
            <div className={`${styles.cell} ${db} ${getChangeColorByValue(stock.change)} ${cellFlash("change", stock.closePrice)}`}>
              {formatChange(stock.change)}
            </div>
          )}
          {v.matchChangePercent && (
            <div className={`${styles.cell} ${db} ${getChangeColorByValue(stock.change)} ${cellFlash("changePercent", stock.closePrice)}`}>
              {formatChangePercent(stock.changePercent)}
            </div>
          )}

          {/* Bên bán — per sub-column */}
          {v.offerPrice1 && (
            <div className={`${styles.cellPrice} ${styles.highlight} ${sc(stock.offerPrice1)} ${cellFlash("offerPrice1", stock.offerPrice1)}`}>
              {formatNumber(stock.offerPrice1)}
            </div>
          )}
          {v.offerVol1 && (
            <div className={`${styles.cellVolume} ${styles.highlight} ${sc(stock.offerPrice1)} ${cellFlash("offerVol1", stock.offerPrice1)}`}>
              {formatVolume(stock.offerVol1)}
            </div>
          )}
          {v.offerPrice2 && (
            <div className={`${styles.cellPrice} ${sc(stock.offerPrice2)} ${cellFlash("offerPrice2", stock.offerPrice2)}`}>
              {formatNumber(stock.offerPrice2)}
            </div>
          )}
          {v.offerVol2 && (
            <div className={`${styles.cellVolume} ${sc(stock.offerPrice2)} ${cellFlash("offerVol2", stock.offerPrice2)}`}>
              {formatVolume(stock.offerVol2)}
            </div>
          )}
          {v.offerPrice3 && (
            <div className={`${styles.cellPrice} ${sc(stock.offerPrice3)} ${cellFlash("offerPrice3", stock.offerPrice3)}`}>
              {formatNumber(stock.offerPrice3)}
            </div>
          )}
          {v.offerVol3 && (
            <div className={`${styles.cellVolume} ${sc(stock.offerPrice3)} ${cellFlash("offerVol3", stock.offerPrice3)}`}>
              {formatVolume(stock.offerVol3)}
            </div>
          )}

          {/* Tổng KL */}
          {v.totalTrading && <div className={`${styles.cellTotalVolume} ${cellFlash("totalTrading")}`}>{formatVolume(stock.totalTrading)}</div>}

          {/* Tổng GT (= totalTrading × averagePrice) */}
          {v.totalValue && (
            <div className={`${styles.cellTotalValue} ${cellFlash("totalTrading")}`}>
              {formatValue((stock.totalTrading || 0) * (stock.averagePrice || 0))}
            </div>
          )}

          {/* Dư — per sub-column */}
          {v.surplusBid && <div className={`${styles.cellSurplus} ${cellFlash("TOTAL_BID_QTTY")}`}>{formatVolume(stock.TOTAL_BID_QTTY)}</div>}
          {v.surplusOffer && <div className={`${styles.cellSurplus} ${cellFlash("TOTAL_OFFER_QTTY")}`}>{formatVolume(stock.TOTAL_OFFER_QTTY)}</div>}

          {/* Giá — per sub-column */}
          {v.priceHigh && (
            <div className={`${styles.cellPrice} ${db} ${sc(stock.high)} ${cellFlash("high", stock.high)}`}>{formatNumber(stock.high)}</div>
          )}
          {v.priceAvg && (
            <div className={`${styles.cellPrice} ${db} ${sc(stock.averagePrice)} ${cellFlash("averagePrice", stock.averagePrice)}`}>
              {formatNumber(stock.averagePrice)}
            </div>
          )}
          {v.priceLow && <div className={`${styles.cellPrice} ${db} ${sc(stock.low)} ${cellFlash("low", stock.low)}`}>{formatNumber(stock.low)}</div>}

          {/* ĐTNN — per sub-column */}
          {v.foreignBuy && <div className={`${styles.cellForeignBuy} ${cellFlash("foreignBuy")}`}>{formatVolume(stock.foreignBuy)}</div>}
          {v.foreignSell && <div className={`${styles.cellForeignSell} ${cellFlash("foreignSell")}`}>{formatVolume(stock.foreignSell)}</div>}
          {v.foreignRemain && (
            <div className={`${styles.cellForeignRemain} ${cellFlash("foreignRemain", stock.closePrice)}`}>{formatVolume(stock.foreignRemain)}</div>
          )}
        </div>
      );
    };

    return (
      <div className={styles.tableWrapper}>
        {/* Header Container */}
        <div className={styles.headerContainer}>
          <div className={styles.headerGrid} style={{ gridTemplateColumns: gridTemplate }}>
            {/* Merged cells (span 2 rows) — cột đơn lẻ: click sort trực tiếp */}
            <div className={styles.colPin}></div>
            <div className={styles.colLenh}>Lệnh</div>
            {v.symbol && (
              <div className={`${styles.colSymbol} ${styles.sortable}`} onClick={() => handleSort("symbol")}>
                Mã CK{sortIcon("symbol")}
              </div>
            )}
            {v.exchange && <div className={styles.colExchange}>Sàn</div>}
            {v.reference && (
              <div className={`${styles.colTC} ${styles.sortable}`} onClick={() => handleSort("reference")}>
                TC{sortIcon("reference")}
              </div>
            )}
            {v.ceiling && (
              <div className={`${styles.colCeiling} ${styles.sortable}`} onClick={() => handleSort("ceiling")}>
                Trần{sortIcon("ceiling")}
              </div>
            )}
            {v.floor && (
              <div className={`${styles.colFloor} ${styles.sortable}`} onClick={() => handleSort("floor")}>
                Sàn{sortIcon("floor")}
              </div>
            )}

            {/* Group headers (row 1, dynamic span) */}
            {bidSpan > 0 && (
              <div className={styles.groupHeader} style={{ gridColumn: `span ${bidSpan}` }}>
                Bên mua
              </div>
            )}
            {matchSpan > 0 && (
              <div className={styles.groupHeader} style={{ gridColumn: `span ${matchSpan}` }}>
                Khớp lệnh
              </div>
            )}
            {askSpan > 0 && (
              <div className={styles.groupHeader} style={{ gridColumn: `span ${askSpan}` }}>
                Bên bán
              </div>
            )}

            {/* Tổng KL & Tổng GT (merged 2 rows) — cột đơn lẻ: click sort trực tiếp */}
            {v.totalTrading && (
              <div className={`${styles.colTotalVolume} ${styles.sortable}`} onClick={() => handleSort("totalTrading")}>
                Tổng KL{sortIcon("totalTrading")}
              </div>
            )}
            {v.totalValue && (
              <div className={`${styles.colTotalValue} ${styles.sortable}`} onClick={() => handleSort("totalValue")}>
                Tổng GT{sortIcon("totalValue")}
              </div>
            )}

            {surplusSpan > 0 && (
              <div className={styles.groupHeader} style={{ gridColumn: `span ${surplusSpan}` }}>
                Dư
              </div>
            )}
            {priceSpan > 0 && (
              <div className={styles.groupHeader} style={{ gridColumn: `span ${priceSpan}` }}>
                Giá
              </div>
            )}
            {foreignSpan > 0 && (
              <div className={styles.groupHeader} style={{ gridColumn: `span ${foreignSpan}` }}>
                ĐTNN
              </div>
            )}

            {/* Sub-headers (row 2) — Bên mua: click sort trên sub-header */}
            {v.bidPrice3 && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("bidPrice3")}>Giá 3{sortIcon("bidPrice3")}</div>}
            {v.bidVol3 && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("bidVol3")}>KL 3{sortIcon("bidVol3")}</div>}
            {v.bidPrice2 && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("bidPrice2")}>Giá 2{sortIcon("bidPrice2")}</div>}
            {v.bidVol2 && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("bidVol2")}>KL 2{sortIcon("bidVol2")}</div>}
            {v.bidPrice1 && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("bidPrice1")}>Giá 1{sortIcon("bidPrice1")}</div>}
            {v.bidVol1 && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("bidVol1")}>KL 1{sortIcon("bidVol1")}</div>}

            {/* Sub-headers — Khớp lệnh */}
            {v.matchPrice && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("closePrice")}>Giá{sortIcon("closePrice")}</div>}
            {v.matchVol && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("closeVol")}>KL{sortIcon("closeVol")}</div>}
            {v.matchChange && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("change")}>+/-{sortIcon("change")}</div>}
            {v.matchChangePercent && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("changePercent")}>%{sortIcon("changePercent")}</div>}

            {/* Sub-headers — Bên bán */}
            {v.offerPrice1 && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("offerPrice1")}>Giá 1{sortIcon("offerPrice1")}</div>}
            {v.offerVol1 && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("offerVol1")}>KL 1{sortIcon("offerVol1")}</div>}
            {v.offerPrice2 && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("offerPrice2")}>Giá 2{sortIcon("offerPrice2")}</div>}
            {v.offerVol2 && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("offerVol2")}>KL 2{sortIcon("offerVol2")}</div>}
            {v.offerPrice3 && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("offerPrice3")}>Giá 3{sortIcon("offerPrice3")}</div>}
            {v.offerVol3 && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("offerVol3")}>KL 3{sortIcon("offerVol3")}</div>}

            {/* Sub-headers — Dư */}
            {v.surplusBid && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("TOTAL_BID_QTTY")}>Mua{sortIcon("TOTAL_BID_QTTY")}</div>}
            {v.surplusOffer && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("TOTAL_OFFER_QTTY")}>Bán{sortIcon("TOTAL_OFFER_QTTY")}</div>}

            {/* Sub-headers — Giá */}
            {v.priceHigh && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("high")}>Cao{sortIcon("high")}</div>}
            {v.priceAvg && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("averagePrice")}>TB{sortIcon("averagePrice")}</div>}
            {v.priceLow && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("low")}>Thấp{sortIcon("low")}</div>}

            {/* Sub-headers — ĐTNN */}
            {v.foreignBuy && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("foreignBuy")}>Mua{sortIcon("foreignBuy")}</div>}
            {v.foreignSell && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("foreignSell")}>Bán{sortIcon("foreignSell")}</div>}
            {v.foreignRemain && <div className={`${styles.subHeader} ${styles.sortable}`} onClick={() => handleSort("foreignRemain")}>Room{sortIcon("foreignRemain")}</div>}
          </div>
        </div>

        {/* Phần chứa các hàng được ghim */}
        {pinnedInstruments.length > 0 && (
          <div className={`${styles.pinnedRowsContainer}${sortAnimating ? ` ${styles.sortFade}` : ""}`}>
            {pinnedInstruments.map((stock) => (
              <Row key={stock.symbol} stock={stock} />
            ))}
          </div>
        )}

        {/* TanStack Virtual Container - Scrollable */}
        <div ref={parentRef} className={`${styles.virtualContainer}${sortAnimating ? ` ${styles.sortFade}` : ""}`} style={{ overflow: "auto" }}>
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <Row stock={sortedNormalInstruments[virtualItem.index]} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
);

StockTable.displayName = "StockTable";
export default StockTable;
