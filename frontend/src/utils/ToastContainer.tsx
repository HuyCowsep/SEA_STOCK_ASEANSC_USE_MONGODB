// src/utils/ToastContainer.tsx

import { FiAlertTriangle, FiCheck, FiInfo, FiX } from "react-icons/fi";
import type { ToastItem } from "./useToast";
import styles from "../scss/Toast.module.scss";

const formatToastTime = (ts: number) => {
  const d = new Date(ts);
  const time = new Intl.DateTimeFormat("vi-VN", { hour: "numeric", minute: "2-digit" }).format(d);
  const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  return `${time} - ${date}`;
};

interface Props {
  toasts: ToastItem[];
  onRemove: (id: number) => void;
}

const ToastContainer = ({ toasts, onRemove }: Props) => {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer}>
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toastItem} ${styles[`toast_${t.type}`]}`}>
          <div className={styles.toastIconWrap}>
            {t.type === "error" && <FiAlertTriangle />}
            {t.type === "success" && <FiCheck />}
            {t.type === "info" && <FiInfo />}
          </div>
          <div className={styles.toastContent}>
            <strong>{t.title}</strong>
            <p>{t.message}</p>
            <span>{formatToastTime(t.createdAt)}</span>
          </div>
          <button type="button" className={styles.toastCloseBtn} onClick={() => onRemove(t.id)} aria-label="Dong thong bao">
            <FiX />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
