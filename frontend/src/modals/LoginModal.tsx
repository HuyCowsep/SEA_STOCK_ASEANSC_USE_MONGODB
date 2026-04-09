import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import axios from "axios";
import styles from "../scss/LoginModal.module.scss";
import { FiChevronDown, FiAtSign, FiVolume, FiFileText, FiAlertTriangle, FiCheck, FiX } from "react-icons/fi";
import ForgotPasswordModal from "./ForgotPasswordModal";
import OpenAccountContent from "./OpenAccountContent";
import { useToast } from "../utils/useToast";
import ToastContainer from "../utils/ToastContainer";

const images = [
  "https://seastock.aseansc.com.vn/notify/file?filepath=notification/advertisement/image_1773999518904_MwEOOyWwf0.jpg",
  "https://seastock.aseansc.com.vn/notify/file?filepath=notification/advertisement/image_1772606485136_Bj0AiO8hl8.jpg",
];

export interface LoginModalHandle {
  open: () => void;
  close: () => void;
}

type LoginModalProps = {
  setToken: (token: string | null) => void;
};

const LoginModal = forwardRef<LoginModalHandle, LoginModalProps>(({ setToken }, ref) => {
  const [view, setView] = useState<"login" | "forgot" | "openAccount">("login");
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [lang, setLang] = useState("Ti?ng Vi?t");
  const dropdownCloseTimerRef = useRef<number | null>(null);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrExpired, setQrExpired] = useState(false);
  const [qrSrc, setQrSrc] = useState<string>("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=demo-login");

  const { toasts, pushToast, removeToast } = useToast();

  useImperativeHandle(
    ref,
    () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    [],
  );

  useEffect(() => {
    if (!isOpen) return;
    const interval = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 8000);
    return () => window.clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen]);

  useEffect(() => {
    if (!qrOpen) return;
    setQrExpired(false);
    const timer = window.setInterval(() => {
      setQrExpired(true);
    }, 30000);

    return () => window.clearInterval(timer);
  }, [qrOpen]);

  const closeModal = () => {
    setIsOpen(false);
    setView("login");
  };

  const openDropdownWithHover = (name: "menu" | "lang") => {
    if (dropdownCloseTimerRef.current) {
      window.clearTimeout(dropdownCloseTimerRef.current);
      dropdownCloseTimerRef.current = null;
    }
    setOpenDropdown(name);
  };

  const closeDropdownWithDelay = (name: "menu" | "lang") => {
    if (dropdownCloseTimerRef.current) {
      window.clearTimeout(dropdownCloseTimerRef.current);
    }
    dropdownCloseTimerRef.current = window.setTimeout(() => {
      setOpenDropdown((prev) => (prev === name ? null : prev));
      dropdownCloseTimerRef.current = null;
    }, 130);
  };

  useEffect(() => {
    return () => {
      if (dropdownCloseTimerRef.current) {
        window.clearTimeout(dropdownCloseTimerRef.current);
      }
    };
  }, []);

  const handleReloadQR = () => {
    setQrExpired(false);
    const newQR = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${Date.now()}`;
    setQrSrc(newQR);
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!username || !password) {
      pushToast("Thiếu thông tin", "Vui lòng điền đầy đủ tài khoản và mật khẩu", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post("/api/auth/login", { username, password });
      const { token } = response.data;
      localStorage.setItem("token", token);
      localStorage.setItem("username", username);
      setToken(token);
      pushToast("Đăng nhập thành công", "Bạn đã đăng nhập vào hệ thống", "success");
      closeModal();
      setUsername("");
      setPassword("");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        pushToast("Đăng nhập thất bại", err.response.data.message || "Tài khoản hoặc mật khẩu không đúng", "error");
      } else {
        pushToast("Lỗi kết nối", "Không thể kết nối tới server", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className={styles.overlay}
          // onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className={styles.modal}>
            <div className={styles.left}>
              <img src={images[currentIndex]} alt="banner" className={styles.banner} />
            </div>

            <div className={styles.right}>
              {view === "forgot" ? (
                <ForgotPasswordModal onBack={() => setView("login")} onToast={pushToast} />
              ) : view === "openAccount" ? (
                <OpenAccountContent showBack onBack={() => setView("login")} backButtonClassName={styles.backBtn} />
              ) : (
                <>
                  <div className={styles.right_1}>
                    <h2 className={styles.title}>Đăng nhập</h2>
                  </div>

                  <form className={styles.form} onSubmit={handleLogin}>
                    <div className={styles.inputGroup}>
                      <h3>Username</h3>
                      <input type="text" placeholder="Vui lòng nhập username" value={username} onChange={(e) => setUsername(e.target.value)} />
                    </div>

                    <div className={styles.inputGroup}>
                      <h3>Mật khẩu</h3>
                      <input type="password" placeholder="Vui lòng nhập mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>

                    <div className={styles.forgotPassword}>
                      <button type="button" onClick={() => setView("forgot")}>
                        Quên mật khẩu?
                      </button>
                    </div>

                    <button type="submit" className={styles.buttonLogin} disabled={loading}>
                      {loading ? "Đang xử lý..." : "Đăng nhập"}
                    </button>

                    <div className={styles.divider}>
                      <span>hoặc đăng nhập nhanh bằng QR code</span>
                    </div>

                    <div className={styles.qrLogin}>
                      <button type="button" className={styles.qrBtn} onClick={() => setQrOpen(true)} title="Đăng nhập bằng QR">
                        <span className={styles.qrIcon}>
                          <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
                            <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm10-2h6v6h-6V3zm2 2v2h2V5h-2zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm12-2h2v2h-2v-2zm0 4h2v4h-4v-2h2v-2zM13 13h2v2h-2v-2z" />
                          </svg>
                        </span>
                      </button>
                    </div>

                    {qrOpen && (
                      <div className={styles.qrOverlay} onClick={() => setQrOpen(false)}>
                        <div className={styles.qrModal} onClick={(e) => e.stopPropagation()}>
                          <h3>Đăng nhập</h3>
                          <div className={styles.qrBox}>
                            <img src={qrSrc} alt="qr" />
                            {qrExpired && (
                              <div className={styles.qrOverlayReload}>
                                <button onClick={handleReloadQR}>Tải lại mã QR</button>
                              </div>
                            )}
                          </div>
                          <p>Quét mã QR bằng ứng dụng SeaStock</p>
                          <button className={styles.qrCloseBtn} onClick={() => setQrOpen(false)}>
                            Đóng
                          </button>
                        </div>
                      </div>
                    )}

                    <div className={styles.dontHaveAccount}>
                      <p className={styles.text}>Quý khách chưa có tài khoản?</p>

                      <button type="button" className={styles.openAccountBtn} onClick={() => setView("openAccount")}>
                        Mở tài khoản
                      </button>
                    </div>

                    <div className={styles.divider}></div>

                    <div className={styles.dropdown}>
                      <div
                        className={styles.dropdownItem}
                        onMouseEnter={() => openDropdownWithHover("menu")}
                        onMouseLeave={() => closeDropdownWithDelay("menu")}
                      >
                        <button type="button" className={styles.dropdownBtn}>
                          Điều khoản và liên hệ <FiChevronDown />
                        </button>

                        {openDropdown === "menu" && (
                          <div className={`${styles.dropdownMenu} ${styles.menuPrimary}`}>
                            <a
                              href="https://www.aseansc.com.vn/policy/dieu-khoan-dich-vu-aseansc.pdf"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setOpenDropdown(null)}
                            >
                              <FiFileText /> Điều khoản và dịch vụ
                            </a>
                            <a
                              href="https://www.aseansc.com.vn/policy/cong-bo-rui-ro-aseansc.pdf"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setOpenDropdown(null)}
                            >
                              <FiAlertTriangle /> Công bố rủi ro
                            </a>
                            <a
                              href="https://www.aseansc.com.vn/help/huong-dan-su-dung-seastock-web.pdf"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setOpenDropdown(null)}
                            >
                              <FiVolume /> Hướng dẫn sử dụng
                            </a>
                            <a
                              href="https://www.aseansc.com.vn/lien-he/"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setOpenDropdown(null)}
                            >
                              <FiAtSign /> Liên hệ AseanSC
                            </a>
                          </div>
                        )}
                      </div>

                      <div
                        className={styles.dropdownItem}
                        onMouseEnter={() => openDropdownWithHover("lang")}
                        onMouseLeave={() => closeDropdownWithDelay("lang")}
                        style={{ justifyItems: "end" }}
                      >
                        <button type="button" className={styles.dropdownBtn}>
                          {lang} <FiChevronDown />
                        </button>

                        {openDropdown === "lang" && (
                          <div className={`${styles.dropdownMenu} ${styles.menuLang}`}>
                            <div onClick={() => setLang("Tiếng Việt")}>Tiếng Việt {lang === "Tiếng Việt" && <FiCheck />}</div>
                            <div onClick={() => setLang("English")}>English {lang === "English" && <FiCheck />}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </form>
                </>
              )}
            </div>

            <button className={styles.closeBtn} onClick={closeModal} aria-label="Đóng modal" title="Nhấn để đóng hoặc nhấn ESC">
              <FiX />
            </button>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
});

LoginModal.displayName = "LoginModal";
export default LoginModal;
