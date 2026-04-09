//src/components/UserDropdown.tsx
import { useState, useRef, useEffect } from "react";
import { UserOutlined } from "@ant-design/icons";
import styles from "../scss/UserDropdown.module.scss";
import UserProfile from "../modals/UserProfileModal";
import type { UserProfileHandle } from "../modals/UserProfileModal";

type UserDropdownProps = {
  token: string | null;
  theme: string;
  onThemeChange: (theme: string) => void;
  onLanguageChange: (lang: string) => void;
  currentLanguage: string;
};

const UserDropdown = ({ token, theme, onThemeChange, onLanguageChange, currentLanguage }: UserDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileModalRef = useRef<UserProfileHandle>(null);

  // Giải mã token để lấy username (fallback nếu localStorage chưa có)
  const getUsernameFromToken = (token: string): string | null => {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload.username || null;
    } catch {
      return null;
    }
  };

  const usernameFromToken = token ? getUsernameFromToken(token) : null;
  const usernameFromStorage = token ? localStorage.getItem("username") : null;
  const displayName = usernameFromToken || usernameFromStorage || "Khách (chưa đăng nhập)";

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleThemeChange = (newTheme: string) => {
    onThemeChange(newTheme);
  };

  const handleLanguageChange = (lang: string) => {
    onLanguageChange(lang);
  };

  const handleOpenProfile = () => {
    setIsOpen(false);
    profileModalRef.current?.open();
  };

  return (
    <div className={styles.userDropdownWrapper} ref={dropdownRef}>
      <button className={styles.userIconButton} onClick={toggleDropdown} aria-label="User menu">
        <UserOutlined />
      </button>

      <div className={`${styles.dropdownPanel} ${isOpen ? styles.open : ""}`}>
        <div className={styles.userIconTop}>
          <UserOutlined />
        </div>
        <div className={styles.divider}></div>
        <div className={styles.userInfo}>
          <div className={styles.userInfoLine}>
            Tài khoản: <span className={styles.username}>{displayName}</span>
          </div>
          {token && (
            <button type="button" className={styles.profileBtn} onClick={handleOpenProfile}>
              Thông tin cá nhân
            </button>
          )}
        </div>

        {/* Divider */}
        <div className={styles.divider}></div>

        <div className={styles.settingSection}>
          <label className={styles.settingLabel}>Giao diện:</label>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input type="radio" name="theme" value="light" checked={theme === "light"} onChange={(e) => handleThemeChange(e.target.value)} />
              <span>SÁNG</span>
            </label>
            <label className={styles.radioLabel}>
              <input type="radio" name="theme" value="dark" checked={theme === "dark"} onChange={(e) => handleThemeChange(e.target.value)} />
              <span>TỐI</span>
            </label>
          </div>
        </div>

        {/* Divider */}
        <div className={styles.divider}></div>

        <div className={styles.settingSection}>
          <label className={styles.settingLabel}>Ngôn ngữ:</label>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="language"
                value="vi"
                checked={currentLanguage === "vi"}
                onChange={(e) => handleLanguageChange(e.target.value)}
              />
              <span>VIE</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="language"
                value="en"
                checked={currentLanguage === "en"}
                onChange={(e) => handleLanguageChange(e.target.value)}
              />
              <span>ENG</span>
            </label>
          </div>
        </div>
      </div>
      <UserProfile ref={profileModalRef} token={token} />
    </div>
  );
};

export default UserDropdown;
