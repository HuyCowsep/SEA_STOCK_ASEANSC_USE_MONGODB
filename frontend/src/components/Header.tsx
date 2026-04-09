//src/components/Header.tsx
import { memo, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import styles from "../scss/Header.module.scss";
import UserDropdown from "./UserDropdown";
import OpenAccountModal from "../modals/OpenAccountModal";
import type { OpenAccountModalHandle } from "../modals/OpenAccountModal";
import LoginModal from "../modals/LoginModal";
import type { LoginModalHandle } from "../modals/LoginModal";
import DepositModal from "../modals/DepositModal";
import type { DepositModalHandle } from "../modals/DepositModal";
import { LineChartOutlined, NodeIndexOutlined } from "@ant-design/icons";
import Swal from "sweetalert2";

type HeaderProps = {
  token: string | null;
  setToken: (token: string | null) => void;
  availableBalance: number | null;
  onDepositSuccess?: () => void;
  theme: string;
  onThemeChange: (theme: string) => void;
  onLanguageChange: (lang: string) => void;
  currentLanguage: string;
};

const VND_FORMATTER = new Intl.NumberFormat("vi-VN");

const Header = ({ token, setToken, availableBalance, onDepositSuccess, theme, onThemeChange, onLanguageChange, currentLanguage }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const openAccountRef = useRef<OpenAccountModalHandle>(null);
  const loginModalRef = useRef<LoginModalHandle>(null);
  const depositModalRef = useRef<DepositModalHandle>(null);

  const handleAuthClick = async () => {
    if (token) {
      const result = await Swal.fire({
        title: "Xác nhận đăng xuất?",
        text: "Bạn đang giao dịch, đăng xuất có thể làm gián đoạn phiên.",
        icon: "warning",
        showCancelButton: true,
        background: "#111827",
        confirmButtonText: "Đăng xuất",
        color: "#e5e7eb",
        cancelButtonText: "Huỷ",
        confirmButtonColor: "#ef4444",
        reverseButtons: true,
        focusCancel: true,
      });

      if (result.isConfirmed) {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        setToken(null);
        navigate("/");
      }
    } else {
      loginModalRef.current?.open();
    }
  };

  const requireLogin = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (token) return;
    e.preventDefault();
    loginModalRef.current?.open();
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* LEFT */}
        <div className={styles.left}>
          <div className={styles.logo}>
            <span className={styles.brand}>ASEAN</span>
            <span className={styles.sub}>SECURITIES</span>
          </div>

          <nav className={styles.nav}>
            <Link to="/dashboard" className={location.pathname === "/dashboard" ? styles.active : ""}>
              Bảng giá
            </Link>
            <div className={styles.navItem}>
              <div
                className={`${styles.dropdownTrigger} ${location.pathname.startsWith("/top-co-phieu") || location.pathname === "/phan-tich" ? styles.active : ""}`}
              >
                <span>Thông tin thị trường</span>

                <svg
                  className={styles.dropdownIcon}
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              <div className={styles.dropdownMenu}>
                <Link to="/top-co-phieu" onClick={requireLogin}>
                  <LineChartOutlined style={{ marginRight: 5 }} />
                  Top cổ phiếu
                </Link>
                <Link to="/phan-tich">
                  <NodeIndexOutlined style={{ marginRight: 5 }} />
                  Trung tâm phân tích
                </Link>
              </div>
            </div>
            <Link to="/giao-dich" onClick={requireLogin} className={location.pathname === "/giao-dich" ? styles.active : ""}>
              Giao dịch
            </Link>
            <Link to="/trai-phieu-rieng-le" onClick={requireLogin} className={location.pathname === "/trai-phieu-rieng-le" ? styles.active : ""}>
              Trái phiếu riêng lẻ
            </Link>
            <Link to="/tai-khoan" onClick={requireLogin} className={location.pathname === "/tai-khoan" ? styles.active : ""}>
              Tài khoản
            </Link>
            <Link to="/san-pham" onClick={requireLogin} className={location.pathname === "/san-pham" ? styles.active : ""}>
              Sản phẩm & Tiện ích
            </Link>
          </nav>
        </div>

        {/* RIGHT */}
        <div className={styles.right}>
          {token && (
            <>
              <button className={styles.depositBtn} onClick={() => depositModalRef.current?.open()}>
                Nạp tiền
              </button>
              <span className={styles.balanceBadge}>Số dư: {availableBalance === null ? "--" : `${VND_FORMATTER.format(availableBalance)} VND`}</span>
            </>
          )}

          <button className={styles.loginBtn} onClick={handleAuthClick}>
            {token ? "Đăng xuất" : "Đăng nhập"}
          </button>

          {!token && (
            <button className={styles.openBtn} onClick={() => openAccountRef.current?.open()}>
              Mở tài khoản
            </button>
          )}

          <OpenAccountModal ref={openAccountRef} />
          <LoginModal ref={loginModalRef} setToken={setToken} />
          <DepositModal ref={depositModalRef} token={token} onDepositSuccess={onDepositSuccess} />

          <UserDropdown
            token={token}
            theme={theme}
            onThemeChange={onThemeChange}
            onLanguageChange={onLanguageChange}
            currentLanguage={currentLanguage}
          />
        </div>
      </div>
    </header>
  );
};

export default memo(Header);
