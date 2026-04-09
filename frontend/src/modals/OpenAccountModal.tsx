// src/modal/OpenAccountModal.tsx
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
//forwardRef = cho cha cầm được con
//useImperativeHandle = chọn function cho cha gọi
import styles from "../scss/OpenAccountModal.module.scss";
import OpenAccountContent from "./OpenAccountContent";

const images = [
  "https://seastock.aseansc.com.vn/notify/file?filepath=notification/advertisement/image_1773999518904_MwEOOyWwf0.jpg",
  "https://seastock.aseansc.com.vn/notify/file?filepath=notification/advertisement/image_1772606485136_Bj0AiO8hl8.jpg",
];

export interface OpenAccountModalHandle {
  open: () => void;
  close: () => void;
}

const OpenAccountModal = forwardRef<OpenAccountModalHandle>((_, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useImperativeHandle(
    ref,
    () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    [],
  );

  // Auto đổi ảnh khi modal đang mở
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Đóng modal bằng phím ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen]);

  if (!isOpen) return null;

  // OpenAccountModal dùng lại component chung: OpenAccountModal.tsx
  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}>
      <div className={styles.modal}>
        {/* LEFT 6fr */}
        <div className={styles.left}>
          <img src={images[currentIndex]} alt="banner" className={styles.banner} />
        </div>

        {/* RIGHT 4fr */}
        <div className={styles.right}>
          <OpenAccountContent />
        </div>

        {/* Close button */}
        <button className={styles.closeBtn} onClick={() => setIsOpen(false)} aria-label="Đóng modal" title="Nhấn để đóng hoặc nhấn ESC">
          ×
        </button>
      </div>
    </div>
  );
});

OpenAccountModal.displayName = "OpenAccountModal";
export default OpenAccountModal;
