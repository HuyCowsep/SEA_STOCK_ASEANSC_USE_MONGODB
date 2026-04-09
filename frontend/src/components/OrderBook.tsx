// src/components/OrderBook.tsx
import { useState, useMemo } from "react";
import axios from "axios";
import type { UnitSettings } from "../types/tableConfig";
import type { Order, OrderStatus, OrderSide } from "../types/order";
import styles from "../scss/OrderBook.module.scss";
import Swal from "sweetalert2";

interface Props {
  token: string | null;
  orders: Order[];
  onCancelOrder: (id: string) => void;
  unitSettings: UnitSettings;
}

type FilterTab = "all" | "pending" | "matched" | "cancelled";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "pending", label: "Chờ khớp" },
  { key: "matched", label: "Đã khớp" },
  { key: "cancelled", label: "Đã hủy" },
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Chờ khớp lệnh",
  partial: "Khớp 1 phần",
  matched: "Đã khớp",
  cancelled: "Đã hủy",
};

const SIDE_LABELS: Record<OrderSide, string> = {
  buy: "MUA",
  sell: "BÁN",
};

const NUMBER_FORMATTER = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const OrderBook = ({ token, orders, onCancelOrder, unitSettings }: Props) => {
  const [expanded, setExpanded] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());

  const filteredOrders = useMemo(() => {
    if (activeFilter === "all") return orders;
    if (activeFilter === "pending") return orders.filter((o) => o.status === "pending" || o.status === "partial");
    if (activeFilter === "matched") return orders.filter((o) => o.status === "matched");
    if (activeFilter === "cancelled") return orders.filter((o) => o.status === "cancelled");
    return orders;
  }, [orders, activeFilter]);

  const handleCancel = async (orderId: string) => {
    if (!token) return;
    //Confirm trước
    const result = await Swal.fire({
      title: "Xác nhận huỷ lệnh",
      text: "Lệnh này sẽ bị huỷ ngay lập tức",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Huỷ lệnh",
      cancelButtonText: "Không",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#374151",
      background: "#111827",
      color: "#e5e7eb",
    });

    // ❌ Nếu không confirm thì dừng luôn
    if (!result.isConfirmed) return;
    //Confirm rồi mới chạy tiếp
    setCancellingIds((prev) => new Set([...prev, orderId]));

    try {
      await axios.delete(`/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      onCancelOrder(orderId);

      Swal.fire({
        icon: "success",
        title: "Đã huỷ lệnh",
        timer: 1200,
        showConfirmButton: false,
        background: "#111827",
        color: "#e5e7eb",
      });
    } catch {
      Swal.fire({
        icon: "error",
        title: "Huỷ lệnh thất bại",
        text: "Vui lòng thử lại",
        background: "#111827",
        color: "#e5e7eb",
      });
    } finally {
      setCancellingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const formatPrice = (raw: number | null): string => {
    if (!raw || raw === 0) return "—";
    return NUMBER_FORMATTER.format(raw / unitSettings.price);
  };

  const formatQty = (qty: number): string => {
    if (!qty) return "0";
    return new Intl.NumberFormat("vi-VN").format(qty / unitSettings.volume);
  };

  if (!token) return null;

  return (
    <div className={styles.orderBook}>
      {/* Header — luôn hiện, không bao giờ bị clip */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          Sổ lệnh
          {orders.filter((o) => o.status === "pending" || o.status === "partial").length > 0 && (
            <span style={{ marginLeft: 8, color: "#fbbf24", fontSize: 12 }}>
              ( đang chờ khớp: {orders.filter((o) => o.status === "pending" || o.status === "partial").length} lệnh )
            </span>
          )}
        </span>
        <button className={styles.toggleBtn} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "▼ Thu gọn sổ lệnh" : "▲ Mở rộng sổ lệnh"}
        </button>
      </div>

      <div className={`${styles.expandableArea} ${!expanded ? styles.expandableAreaCollapsed : ""}`}>
        <div className={styles.expandableInner}>
          {/* Filter tabs */}
          <div className={styles.filterTabs}>
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`${styles.filterTabTitleName} ${activeFilter === tab.key ? styles.filterTabActive : ""}`}
                onClick={() => setActiveFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Danh sách lệnh */}
          <div className={styles.orderList}>
            {/* Header cột */}
              
            <div className={styles.listHeader}>
              <span className={styles.colHeader}>Side (bên)</span>
              <span className={styles.colHeader}>Mã CK</span>
              <span className={styles.colHeader}>Loại lệnh</span>
              <span className={styles.colHeader}>Giá đặt</span>
              <span className={styles.colHeader}>KL đặt</span>
              <span className={styles.colHeader}>Giá khớp</span>
              <span className={styles.colHeader}>Trạng thái</span>
              <span className={styles.colHeader}>Thao tác</span>
            </div>

            {filteredOrders.length === 0 ? (
              <div className={styles.emptyState}>
                Không có lệnh{activeFilter !== "all" ? ` (${FILTER_TABS.find((t) => t.key === activeFilter)?.label})` : ""}
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div key={order.id} className={styles.orderRow}>
                  {/* Side badge */}
                  <span className={`${styles.sideBadge} ${order.side === "buy" ? styles.sideBadgeBuy : styles.sideBadgeSell}`}>
                    {SIDE_LABELS[order.side]}
                  </span>

                  {/* Symbol */}
                  <span className={styles.cellSymbol}>{order.symbol}</span>

                  {/* Order type */}
                  <span className={styles.cellType}>{order.orderType}</span>

                  {/* Giá đặt */}
                  <span className={styles.cellNum}>{formatPrice(order.price)}</span>

                  {/* KL đặt / đã khớp */}
                  <span className={styles.cellNum}>
                    {formatQty(order.quantity)}
                    {order.filledQuantity > 0 && <span className={styles.cellMatched}> / {formatQty(order.filledQuantity)}</span>}
                  </span>

                  {/* Giá khớp */}
                  <span className={order.matchedPrice ? styles.cellMatched : styles.cellNumDim}>{formatPrice(order.matchedPrice)}</span>

                  {/* Trạng thái */}
                  <span
                    className={`${styles.statusBadge} ${
                      order.status === "pending"
                        ? styles.statusPending
                        : order.status === "partial"
                          ? styles.statusPartial
                          : order.status === "matched"
                            ? styles.statusMatched
                            : styles.statusCancelled
                    }`}
                  >
                    {STATUS_LABELS[order.status]}
                  </span>

                  {/* Nút hủy (chỉ pending/partial) */}
                  <button
                    className={styles.cancelBtn}
                    disabled={(order.status !== "pending" && order.status !== "partial") || cancellingIds.has(order.id)}
                    onClick={() => handleCancel(order.id)}
                  >
                    {cancellingIds.has(order.id) ? "..." : "Hủy lệnh"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderBook;
