import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import { FiChevronLeft } from "react-icons/fi";
import styles from "../scss/LoginModal.module.scss";
import type { ToastType } from "../utils/useToast";

type ForgotPasswordModalProps = {
  onBack: () => void;
  onToast: (title: string, message: string, type?: ToastType) => void;
};

const RESEND_COOLDOWN_SECONDS = 30;

const ForgotPasswordModal = ({ onBack, onToast }: ForgotPasswordModalProps) => {
  const [step, setStep] = useState<"requestOtp" | "resetPassword">("requestOtp");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const requestOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      onToast("Thiếu thông tin", "Vui lòng nhập email để nhận mã OTP", "error");
      return;
    }

    setSubmitting(true);
    try {
      await axios.post("/api/auth/forgot-password/request-otp", { email: normalizedEmail });
      setEmail(normalizedEmail);
      setStep("resetPassword");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      onToast("Đã gửi OTP", "Mã OTP có hiệu lực trong 5 phút, vui lòng kiểm tra email", "success");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        onToast("Gửi OTP thất bại", String(err.response.data.message), "error");
      } else {
        onToast("Lỗi kết nối", "Không thể gửi OTP tới máy chủ", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await requestOtp();
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) {
      onToast("Vui lòng chờ", `Bạn có thể gửi lại OTP sau ${resendCooldown} giây`, "info");
      return;
    }
    await requestOtp();
  };

  const handleResetPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!normalizedEmail || !normalizedOtp || !newPassword) {
      onToast("Thiếu thông tin", "Vui lòng nhập đầy đủ email, OTP và mật khẩu mới", "error");
      return;
    }

    setSubmitting(true);
    try {
      await axios.post("/api/auth/forgot-password/reset", {
        email: normalizedEmail,
        otp: normalizedOtp,
        newPassword,
      });
      onToast("Đổi mật khẩu thành công", "Bạn có thể đăng nhập lại bằng mật khẩu mới", "success");
      setOtp("");
      setNewPassword("");
      setResendCooldown(0);
      onBack();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        onToast("Đổi mật khẩu thất bại", String(err.response.data.message), "error");
      } else {
        onToast("Lỗi kết nối", "Không thể đổi mật khẩu lúc này", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className={styles.right_1}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          <FiChevronLeft /> Quay lại
        </button>
        <h2 className={styles.title}>Quên mật khẩu</h2>
      </div>

      {step === "requestOtp" ? (
        <form className={styles.form} onSubmit={handleRequestOtp}>
          <div className={styles.inputGroup}>
            <h3>Email</h3>
            <input
              type="email"
              placeholder="Vui lòng nhập email đã đăng ký"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button type="submit" className={styles.buttonLogin} disabled={submitting}>
            {submitting ? "Đang gửi..." : "Gửi OTP"}
          </button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={handleResetPassword}>
          <div className={styles.inputGroup}>
            <h3>Email</h3>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className={styles.inputGroup}>
            <h3>Mã OTP</h3>
            <input type="text" placeholder="Vui lòng nhập mã OTP gồm 6 số" value={otp} onChange={(e) => setOtp(e.target.value)} />
          </div>

          <div className={styles.inputGroup}>
            <h3>Mật khẩu mới</h3>
            <input
              type="password"
              placeholder="Mật khẩu tối thiểu 6 ký tự"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className={styles.otpActions}>
            <button
              type="button"
              className={styles.resendOtpBtn}
              onClick={handleResendOtp}
              disabled={submitting || resendCooldown > 0}
            >
              {resendCooldown > 0 ? `Gửi lại OTP sau ${resendCooldown}s` : "Gửi lại OTP mới"}
            </button>
            <span className={styles.otpHint}>OTP có hiệu lực trong 5 phút</span>
          </div>

          <button type="submit" className={styles.buttonLogin} disabled={submitting}>
            {submitting ? "Đang xử lý..." : "Xác nhận đổi mật khẩu"}
          </button>
        </form>
      )}
    </>
  );
};

export default ForgotPasswordModal;


