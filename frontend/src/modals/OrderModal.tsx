// src/modals/OrderModal.tsx
import { useState, useEffect, useCallback } from "react";
import { Modal, Tooltip } from "antd";
import axios from "axios";
import type { UnitSettings } from "../types/tableConfig";
import type { Order, OrderInstrumentInfo, OrderSide, OrderType } from "../types/order";
import { useToast } from "../utils/useToast";
import ToastContainer from "../utils/ToastContainer";
import styles from "../scss/OrderModal.module.scss";

interface Props {
  open: boolean;
  symbol: string;
  exchange: string;
  initialSide: OrderSide;
  instrument: OrderInstrumentInfo | null;
  token: string | null;
  unitSettings: UnitSettings;
  onClose: () => void;
  onSuccess: (order: Order) => void;
}

type PlaceOrderApiOrder = {
  id: string;
  symbol: string;
  exchange: string;
  side: OrderSide;
  orderType: OrderType;
  price: number;
  quantity: number;
  filledQuantity?: number;
  status: Order["status"];
  matchedPrice?: number | null;
  matchedAt?: string | null;
  createdAt: string;
};

type PlaceOrderApiResponse = {
  message: string;
  order: PlaceOrderApiOrder;
};

//4 loại lệnh cơ bản nhất: LO (lệnh giới hạn), ATO (at-the-open), ATC (at-the-close), MP (market price)
const ORDER_TYPES: OrderType[] = ["LO", "ATO", "ATC", "MP"];
const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  LO: "LO",
  ATO: "ATO",
  ATC: "ATC",
  MP: "MP",
};

const QUICK_QTYS = [100, 300, 500, 1000, 3000];

const OrderModal = ({ open, symbol, exchange, initialSide, instrument, token, unitSettings, onClose, onSuccess }: Props) => {
  const [side, setSide] = useState<OrderSide>(initialSide);
  const [orderType, setOrderType] = useState<OrderType>("LO");
  const [priceInput, setPriceInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("100");
  const [loading, setLoading] = useState(false);
  const { toasts, pushToast, removeToast } = useToast();

  // --- Pre-fill price khi mở modal hoặc chuyển side ---
  const getPrefilledPrice = useCallback(
    (currentSide: OrderSide): string => {
      if (!instrument) return "";
      const raw =
        currentSide === "buy"
          ? instrument.offerPrice1 || instrument.closePrice || instrument.reference
          : instrument.bidPrice1 || instrument.closePrice || instrument.reference;
      if (!raw || raw === 0) return "";
      const display = raw / unitSettings.price;
      return display.toFixed(2);
    },
    [instrument, unitSettings.price],
  );

  // Reset state mỗi lần mở modal
  useEffect(() => {
    if (open) {
      setSide(initialSide);
      setOrderType("LO");
      setPriceInput(getPrefilledPrice(initialSide));
      setQuantityInput("100");
    }
  }, [open, initialSide, getPrefilledPrice]);

  // Khi đổi side → cập nhật giá pre-fill
  const handleSideChange = (newSide: OrderSide) => {
    setSide(newSide);
    if (orderType === "LO") {
      setPriceInput(getPrefilledPrice(newSide));
    }
  };

  // Khi đổi loại lệnh
  const handleOrderTypeChange = (type: OrderType) => {
    setOrderType(type);
    if (type === "LO") {
      setPriceInput(getPrefilledPrice(side));
    } else {
      setPriceInput(""); // ATO/ATC/MP không nhập giá
    }
  };

  const isPriceEnabled = orderType === "LO";

  // Tính raw price từ input của người dùng
  const getRawPrice = (): number => {
    if (!isPriceEnabled) return 0;
    const val = parseFloat(priceInput.replace(",", "."));
    if (isNaN(val) || val <= 0) return -1;
    return Math.round(val * unitSettings.price);
  };

  // Hiển thị giá tham chiếu
  const fmt = (raw: number | undefined): string => {
    if (!raw || raw === 0) return "—";
    return (raw / unitSettings.price).toFixed(2);
  };

  const unitLabel = unitSettings.price === 1000 ? "nghìn đồng" : "đồng";

  // Mức phí giao dịch (đồng bộ với backend)
  const FEE_RATE = 0.0015;

  // Tính tổng giá trị ước tính
  const getTotalValue = (): string => {
    const rawPrice = isPriceEnabled ? getRawPrice() : (instrument?.closePrice ?? 0);
    const qty = parseInt(quantityInput) || 0;
    if (!rawPrice || rawPrice <= 0 || qty <= 0) return "—";
    const total = (rawPrice * qty) / 1_000_000;
    return `${total.toFixed(1)} triệu đồng`;
  };

  // Tính phí giao dịch ước tính
  const getFeeValue = (): string => {
    const rawPrice = isPriceEnabled ? getRawPrice() : (instrument?.closePrice ?? 0);
    const qty = parseInt(quantityInput) || 0;
    if (!rawPrice || rawPrice <= 0 || qty <= 0) return "—";
    const fee = Math.ceil(rawPrice * qty * FEE_RATE);
    return fee.toLocaleString("vi-VN") + " đ";
  };

  const validate = (): string | null => {
    if (isPriceEnabled) {
      const raw = getRawPrice();
      if (raw < 0) return "Vui lòng nhập giá hợp lệ (lớn hơn 0).";
      if (instrument) {
        if (raw < instrument.floor) return `Giá đặt (${fmt(raw)}) thấp hơn giá sàn (${fmt(instrument.floor)}). Vui lòng nhập trong khoảng cho phép.`;
        if (raw > instrument.ceiling)
          return `Giá đặt (${fmt(raw)}) cao hơn giá trần (${fmt(instrument.ceiling)}). Vui lòng nhập trong khoảng cho phép.`;
      }
    }
    const qty = parseInt(quantityInput);
    if (isNaN(qty) || qty <= 0) return "Vui lòng nhập khối lượng hợp lệ (lớn hơn 0).";
    if (qty % 100 !== 0) return "Khối lượng phải là bội số của 100 cổ phiếu (100, 200, 300...).";

    // Hard cap: 10 triệu cổ phiếu
    const ABSOLUTE_MAX = 10_000_000;
    if (qty > ABSOLUTE_MAX) {
      return `Khối lượng đặt lệnh quá lớn — tối đa ${ABSOLUTE_MAX.toLocaleString("vi-VN")} cổ phiếu mỗi lệnh.`;
    }

    // Soft cap: không quá 50% tổng KL giao dịch trong ngày
    if (instrument?.totalTrading && instrument.totalTrading > 1000) {
      const softCap = Math.ceil((instrument.totalTrading * 0.5) / 100) * 100;
      if (qty > softCap) {
        return `Khối lượng đặt (${qty.toLocaleString("vi-VN")}) vượt quá 50% tổng KL giao dịch hôm nay của ${symbol} (${instrument.totalTrading.toLocaleString("vi-VN")} cổ phiếu). Tối đa được phép: ${softCap.toLocaleString("vi-VN")} cổ phiếu.`;
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    if (!token) {
      pushToast("Đặt lệnh thất bại", "Bạn cần đăng nhập để đặt lệnh.", "error");
      return;
    }
    const validationError = validate();
    if (validationError) {
      pushToast("Dữ liệu không hợp lệ", validationError, "error");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        symbol,
        exchange,
        side,
        orderType,
        price: getRawPrice(),
        quantity: parseInt(quantityInput),
      };

      const res = await axios.post<PlaceOrderApiResponse>("/api/orders", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Map response: backend trả { message, order: { id, symbol, ... } }
      const d = res.data.order;
      const order: Order = {
        id: d.id,
        symbol: d.symbol,
        exchange: d.exchange,
        side: d.side,
        orderType: d.orderType,
        price: d.price,
        quantity: d.quantity,
        filledQuantity: d.filledQuantity ?? 0,
        status: d.status,
        matchedPrice: d.matchedPrice ?? null,
        matchedAt: d.matchedAt ?? null,
        createdAt: d.createdAt,
      };

      onSuccess(order);
      onClose();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        pushToast("Đặt lệnh thất bại", err.response?.data?.message ?? "Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng", "error");
      } else {
        pushToast("Đặt lệnh thất bại", "Không thể xử lý yêu cầu. Vui lòng thử lại.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={500}
        wrapClassName={styles.orderModalWrap}
        centered
        destroyOnHidden
        mask={{ closable: false }}
        title={null}
      >
        {/* Tabs MUA / BÁN */}
        <div className={styles.sideTabs}>
          <button
            className={`${styles.sideTab} ${side === "buy" ? styles.sideTabBuyActive : styles.sideTabBuy}`}
            onClick={() => handleSideChange("buy")}
          >
            MUA
          </button>
          <button
            className={`${styles.sideTab} ${side === "sell" ? styles.sideTabSellActive : styles.sideTabSell}`}
            onClick={() => handleSideChange("sell")}
          >
            BÁN
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Mã CK + Tên đầy đủ + Sàn */}
          <div className={styles.symbolRow}>
            <span className={styles.symbolCode}>{symbol}</span>

            {instrument?.FullName && (
              <Tooltip title={instrument.FullName}>
                <span className={styles.symbolName}>{instrument.FullName}</span>
              </Tooltip>
            )}

            <span className={styles.exchangeBadge}>{exchange}</span>
          </div>

          {/* Giá tham chiếu */}
          {instrument && (
            <div className={styles.refPrices}>
              <div className={styles.refItem}>
                <span className={styles.refLabel}>TC</span>
                <span className={styles.refTC}>{fmt(instrument.reference)}</span>
              </div>
              <div className={styles.refItem}>
                <span className={styles.refLabel}>Trần</span>
                <span className={styles.refCeiling}>{fmt(instrument.ceiling)}</span>
              </div>
              <div className={styles.refItem}>
                <span className={styles.refLabel}>Sàn</span>
                <span className={styles.refFloor}>{fmt(instrument.floor)}</span>
              </div>
              <div className={styles.refItem}>
                <span className={styles.refLabel}>Giá khớp</span>
                <span className={styles.refClose}>{fmt(instrument.closePrice)}</span>
              </div>
            </div>
          )}

          {/* Loại lệnh */}
          <div className={styles.formRow}>
            <span className={styles.label}>Loại lệnh</span>
            <div className={styles.orderTypeGroup}>
              {ORDER_TYPES.map((type) => (
                <button
                  key={type}
                  className={`${styles.orderTypeBtn} ${orderType === type ? styles.orderTypeBtnActive : ""}`}
                  onClick={() => handleOrderTypeChange(type)}
                >
                  {ORDER_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Giá */}
          <div className={styles.formRow}>
            <span className={styles.label}>
              Giá <span className={styles.unit}>(đơn vị: {unitLabel})</span>
            </span>
            <input
              type="text"
              className={styles.input}
              value={priceInput}
              onChange={(e) => {
                setPriceInput(e.target.value);
              }}
              disabled={!isPriceEnabled}
              placeholder={isPriceEnabled ? "Nhập giá" : "Giá thị trường (không cần nhập)"}
            />
            {instrument && isPriceEnabled && (
              <span className={styles.priceHint}>
                Trần / Sàn: <span className={styles.ceilingColor}>{fmt(instrument.ceiling)}</span> –{" "}
                <span className={styles.floorColor}>{fmt(instrument.floor)}</span>
              </span>
            )}
          </div>

          {/* Khối lượng */}
          <div className={styles.formRow}>
            <span className={styles.label}>
              Khối lượng <span className={styles.unit}>(cổ phiếu)</span>
            </span>
            <input
              type="text"
              className={styles.input}
              value={quantityInput}
              onChange={(e) => {
                setQuantityInput(e.target.value);
              }}
            />
            <div className={styles.quickQty}>
              {QUICK_QTYS.map((qty) => (
                <button key={qty} className={styles.quickQtyBtn} onClick={() => setQuantityInput(String(qty))}>
                  {qty.toLocaleString("vi-VN")}
                </button>
              ))}
            </div>
          </div>

          {/* Tổng ước tính + phí */}
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Tổng giá trị ước tính</span>
            <span className={styles.totalValue}>{getTotalValue()}</span>
          </div>
          <div className={styles.feeRow}>
            <span className={styles.feeLabel}>Phí giao dịch (0.15%)</span>
            <span className={styles.feeValue}>{getFeeValue()}</span>
          </div>

          {/* Submit */}
          <button
            className={`${styles.submitBtn} ${side === "buy" ? styles.submitBuy : styles.submitSell}`}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Đang đặt lệnh..." : side === "buy" ? "ĐẶT LỆNH MUA" : "ĐẶT LỆNH BÁN"}
          </button>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
};

export default OrderModal;
