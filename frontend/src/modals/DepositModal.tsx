// src/modals/DepositModal.tsx
// Modal nạp tiền ảo — 2 bước: Liên kết ngân hàng → Nạp tiền
import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Modal } from "antd";
import { FiDollarSign, FiCreditCard } from "react-icons/fi";
import axios from "axios";
import styles from "../scss/DepositModal.module.scss";
import Swal from "sweetalert2";
import { useToast } from "../utils/useToast";
import ToastContainer from "../utils/ToastContainer";

export interface DepositModalHandle {
  open: () => void;
}

interface Props {
  token: string | null;
  onDepositSuccess?: () => void;
}

// Danh sách ngân hàng phổ biến
const BANKS = [
  "Vietcombank",
  "BIDV",
  "VietinBank",
  "Techcombank",
  "MB Bank",
  "ACB",
  "TPBank",
  "VPBank",
  "Sacombank",
  "HDBank",
  "SHB",
  "SeABank",
  "LienVietPostBank",
  "OCB",
  "MSB",
  "Eximbank",
  "VIB",
  "Nam A Bank",
  "Bac A Bank",
  "Agribank",
  "PVcomBank",
  "VietBank",
  "BaoViet Bank",
  "OceanBank",
  "CBBank",
  "GPBank",
  "DongA Bank",
  "Saigonbank",
  "KienlongBank",
  "Viet A Bank",
  "SCB",
  "NCB",
  "UOB Vietnam",
  "Standard Chartered Vietnam",
  "HSBC Vietnam",
  "Shinhan Bank Vietnam",
  "Woori Bank Vietnam",
  "Public Bank Vietnam",
  "CIMB Vietnam",
];

// Format VND
const fmtVND = (n: number) => n.toLocaleString("vi-VN");

// Shortcuts nạp nhanh
const QUICK_AMOUNTS = [
  { label: "10 triệu", value: 10_000_000 },
  { label: "50 triệu", value: 50_000_000 },
  { label: "100 triệu", value: 100_000_000 },
  { label: "500 triệu", value: 500_000_000 },
  { label: "1 tỷ", value: 1_000_000_000 },
  { label: "5 tỷ", value: 5_000_000_000 },
];

const DepositModal = forwardRef<DepositModalHandle, Props>(({ token, onDepositSuccess }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toasts, pushToast, removeToast, clearToasts } = useToast();

  // Bank link state
  const [bankAccount, setBankAccount] = useState("");
  const [bankName, setBankName] = useState("");
  const [hasBankLinked, setHasBankLinked] = useState(false);
  const [linkedBankDisplay, setLinkedBankDisplay] = useState(""); // "Vietcombank — ****1234"

  // Deposit state
  const [amount, setAmount] = useState("");

  // Thông tin tài khoản
  const [available, setAvailable] = useState(0);
  const [locked, setLocked] = useState(0);
  const [dailyDeposited, setDailyDeposited] = useState(0);
  const [dailyRemaining, setDailyRemaining] = useState(0);

  // Giới hạn nạp tiền
  const [limits, setLimits] = useState({
    minPerTransaction: 100_000,
    maxPerTransaction: 5_000_000_000,
    maxPerDay: 10_000_000_000,
  });

  useImperativeHandle(ref, () => ({ open: () => setIsOpen(true) }));

  // Load thông tin khi mở modal
  const fetchInfo = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get("/api/deposit/info", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = res.data;
      setHasBankLinked(!!d.hasBankLinked);
      if (d.bankAccount && d.bankName) {
        setLinkedBankDisplay(`${d.bankName} — *******${(d.bankAccount as string).slice(-4)}`);
        setBankAccount(d.bankAccount);
        setBankName(d.bankName);
      }
      setAvailable(d.available ?? 0);
      setLocked(d.locked ?? 0);
      setDailyDeposited(d.dailyDeposited ?? 0);
      setDailyRemaining(d.dailyRemaining ?? 0);
      if (d.limits) setLimits(d.limits);
    } catch {
      // ignore — sẽ thấy lỗi khi thao tác
    }
  }, [token]);

  useEffect(() => {
    if (isOpen && token) fetchInfo();
  }, [isOpen, token, fetchInfo]);

  // === LIÊN KẾT NGÂN HÀNG ===
  const handleLinkBank = async () => {
    if (!bankName || bankName === "") {
      return pushToast("Liên kết thất bại!", "Bạn vui lòng chọn ngân hàng", "error");
    }
    if (!bankAccount.trim()) return pushToast("Liên kết thất bại!", "Bạn vui lòng nhập số tài khoản ngân hàng", "error");

    setLoading(true);
    try {
      const res = await axios.post(
        "/api/deposit/link-bank",
        { bankAccount: bankAccount.trim(), bankName },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setHasBankLinked(true);
      setLinkedBankDisplay(`${bankName} — ****${bankAccount.trim().slice(-4)}`);
      pushToast("Liên kết thành công!", res.data.message, "success");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Liên kết thất bại";
      pushToast("Liên kết thất bại!", msg, "error");
    } finally {
      setLoading(false);
    }
  };

  // === NẠP TIỀN ===
  const handleDeposit = async () => {
    const num = Number(amount.replace(/[,.]/g, ""));
    if (!num || num <= 0) return pushToast("Nạp tiền thất bại!", "Bạn vui lòng nhập số tiền cần nạp", "error");

    setLoading(true);
    try {
      const res = await axios.post("/api/deposit", { amount: num }, { headers: { Authorization: `Bearer ${token}` } });
      pushToast("Nạp tiền thành công!", res.data.message, "success");
      setAvailable(res.data.available ?? 0);
      setLocked(res.data.locked ?? 0);
      setDailyDeposited(res.data.dailyDeposited ?? 0);
      setDailyRemaining(res.data.dailyRemaining ?? 0);
      setAmount(""); // reset input
      onDepositSuccess?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Nạp tiền thất bại";
      pushToast("Nạp tiền thất bại!", msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAmountInput = (raw: string) => {
    // Chỉ cho phép số
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      setAmount("");
      return;
    }
    // Format có dấu chấm separators
    setAmount(Number(digits).toLocaleString("vi-VN"));
  };

  const handleClose = () => {
    setIsOpen(false);
    clearToasts();
  };

  return (
    <div className={styles.depositModalWrap}>
      <Modal open={isOpen} onCancel={handleClose} footer={null} width={520} centered destroyOnHidden mask={{ closable: false }} title={null}>
        {/* Header */}
        <div className={styles.header}>
          <FiDollarSign className={styles.headerIcon} />
          <h2>Nạp tiền để giao dịch</h2>
        </div>

        {/* Số dư hiện tại */}
        <div className={styles.balanceBar}>
          <div className={styles.balanceItem}>
            <span className={styles.balanceLabel}>Khả dụng</span>
            <span className={styles.balanceValue}>{fmtVND(available)}</span>
          </div>
          <div className={styles.balanceDivider} />
          <div className={styles.balanceItem}>
            <span className={styles.balanceLabel}>Đang giữ</span>
            <span className={styles.balanceValueLocked}>{fmtVND(locked)}</span>
          </div>
          <div className={styles.balanceDivider} />
          <div className={styles.balanceItem}>
            <span className={styles.balanceLabel}>Tổng</span>
            <span className={styles.balanceValueTotal}>{fmtVND(available + locked)}</span>
          </div>
        </div>

        {/* STEP 1: Liên kết ngân hàng */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <FiCreditCard />
            <span>Tài khoản ngân hàng</span>
            {hasBankLinked && <span className={styles.linkedBadge}>Đã liên kết</span>}
          </div>

          {hasBankLinked ? (
            <div className={styles.linkedInfo}>
              <span>{linkedBankDisplay}</span>
              <button
                className={styles.changeBankBtn}
                onClick={async () => {
                  const result = await Swal.fire({
                    title: "Đổi tài khoản ngân hàng?",
                    text: "Bạn sẽ cần liên kết lại tài khoản mới.",
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "Đổi liên kết",
                    cancelButtonText: "Huỷ",
                    reverseButtons: true,
                    background: "#111827",
                    color: "#e5e7eb",
                    confirmButtonColor: "#ef4444",
                    cancelButtonColor: "#6b7280",
                  });

                  if (result.isConfirmed) {
                    setHasBankLinked(false);
                    setBankAccount("");
                    setBankName("");

                    pushToast("Đã chuyển sang chế độ liên kết mới", "", "info");
                  }
                }}
              >
                Đổi
              </button>
            </div>
          ) : (
            <div className={styles.linkBankForm}>
              <select value={bankName} onChange={(e) => setBankName(e.target.value)} className={styles.bankSelect}>
                <option value="">— Chọn ngân hàng —</option>
                {BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              <input
                type="text"
                className={styles.bankInput}
                placeholder="Số tài khoản ngân hàng"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ""))}
                maxLength={20}
              />

              <button className={styles.linkBankBtn} onClick={handleLinkBank} disabled={loading}>
                {loading ? "Đang xử lý..." : "Liên kết tài khoản"}
              </button>
            </div>
          )}
        </div>

        {/* STEP 2: Nạp tiền — chỉ hiện khi đã liên kết ngân hàng */}
        {hasBankLinked && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <FiDollarSign />
              <span>Nạp tiền vào sàn</span>
            </div>

            {/* Input số tiền */}
            <div className={styles.amountInputWrap}>
              <input
                type="text"
                className={styles.amountInput}
                placeholder="Nhập số tiền (VND)"
                value={amount}
                onChange={(e) => handleAmountInput(e.target.value)}
              />
              <span className={styles.amountUnit}>VND</span>
            </div>

            {/* Nạp nhanh */}
            <div className={styles.quickAmounts}>
              {QUICK_AMOUNTS.map((q) => (
                <button key={q.value} className={styles.quickBtn} onClick={() => setAmount(fmtVND(q.value))}>
                  {q.label}
                </button>
              ))}
            </div>

            {/* Thông tin hạn mức */}
            <div className={styles.limitInfo}>
              <span>Tối thiểu: {fmtVND(limits.minPerTransaction)} / lần</span>
              <span>Tối đa: {fmtVND(limits.maxPerTransaction)} / lần</span>
              <span>
                Đã nạp hôm nay: {fmtVND(dailyDeposited)} / {fmtVND(limits.maxPerDay)}
              </span>
              <span>
                Còn lại hôm nay: <strong>{fmtVND(dailyRemaining)}</strong>
              </span>
            </div>

            {/* Nút nạp */}
            <button className={styles.depositBtn} onClick={handleDeposit} disabled={loading || !amount}>
              {loading ? "Đang xử lý..." : "Xác nhận nạp tiền"}
            </button>
          </div>
        )}
      </Modal>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
});

DepositModal.displayName = "DepositModal";

export default DepositModal;
