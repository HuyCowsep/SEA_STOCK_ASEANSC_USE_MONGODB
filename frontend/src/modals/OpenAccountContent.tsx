import { useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import { FiChevronLeft } from "react-icons/fi";
import styles from "../scss/OpenAccountModal.module.scss";
import { useToast } from "../utils/useToast";
import ToastContainer from "../utils/ToastContainer";

type OpenAccountContentProps = {
  showBack?: boolean;
  onBack?: () => void;
  backButtonClassName?: string;
};

const OpenAccountContent = ({ showBack = false, onBack, backButtonClassName }: OpenAccountContentProps) => {
  const [view, setView] = useState<"info" | "register">("info");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toasts, pushToast, removeToast } = useToast();

  const handleTraditionalRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!username || !email || !password) {
      pushToast("Thiếu thông tin", "Vui lòng điền đầy đủ thông tin đăng ký", "error");
      return;
    }

    setLoading(true);
    try {
      await axios.post("/api/auth/register", { username, email, password });
      pushToast("Đăng ký thành công", "Bạn có thể dùng tài khoản mới để đăng nhập", "success");
      setUsername("");
      setEmail("");
      setPassword("");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        pushToast("Đăng ký thất bại", String(err.response.data.message), "error");
      } else {
        pushToast("Lỗi kết nối", "Không thể đăng ký lúc này", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showBack && onBack && (
        <button type="button" className={backButtonClassName} onClick={onBack}>
          <FiChevronLeft /> Quay lại
        </button>
      )}

      {view === "info" ? (
        <>
          <div className={styles.right_1}>
            <h2 className={styles.title}>Mở tài khoản</h2>
            <p className={styles.desc}>Quý khách vui lòng thực hiện theo các bước sau để mở tài khoản chứng khoán tại Asean Securities</p>
            <ol className={styles.steps}>
              <li>Mở camera trên điện thoại</li>
              <li>Quét mã QR code để tải ứng dụng SeaStock</li>
              <li>Mở tài khoản theo hướng dẫn</li>
            </ol>
          </div>

          <div className={styles.right_2}>
            <div className={styles.qrWrapper}>
              <img src="https://www.aseansc.com.vn/wp-content/uploads/2023/03/QR-code.png" alt="qr" />
            </div>
            <p className={styles.qrText}>Quét mã QR để tải Ứng dụng</p>
            <button type="button" className={styles.traditionalRegisterBtn} onClick={() => setView("register")}>
              Đăng ký truyền thống
            </button>
          </div>
        </>
      ) : (
        <div className={styles.traditionalRegisterWrap}>
          <h2 className={styles.title}>Đăng ký truyền thống</h2>

          <form className={styles.traditionalRegisterForm} onSubmit={handleTraditionalRegister}>
            <div className={styles.formGroup}>
              <h3>Username</h3>
              <input type="text" placeholder="Vui lòng nhập username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>

            <div className={styles.formGroup}>
              <h3>Email</h3>
              <input type="email" placeholder="Vui lòng nhập email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className={styles.formGroup}>
              <h3>Password</h3>
              <input type="password" placeholder="Vui lòng nhập password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <button type="submit" className={styles.submitRegisterBtn} disabled={loading}>
              {loading ? "Đang xử lý..." : "Đăng ký"}
            </button>
          </form>
        </div>
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
};

export default OpenAccountContent;
