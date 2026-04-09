//src/modals/UserProfileModal.tsx
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { Modal } from "antd";
import { UserOutlined, BankOutlined, ReloadOutlined, EditOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";
import axios from "axios";
import styles from "../scss/UserProfile.module.scss";
import { formatVND, formatJoinedAt, maskCCCD, formatDOB, formatPhone } from "../utils/format";
import { useToast } from "../utils/useToast";
import ToastContainer from "../utils/ToastContainer";

export interface UserProfileHandle {
  open: () => void;
}

type Props = {
  token: string | null;
};

type DepositInfoResponse = {
  bankAccount: string;
  bankName: string;
  hasBankLinked: boolean;
  available: number;
  locked: number;
  total: number;
  dailyDeposited: number;
  dailyRemaining: number;
  limits: {
    minPerTransaction: number;
    maxPerTransaction: number;
    maxPerDay: number;
  };
};

type AuthMeResponse = {
  user?: {
    id?: string;
    username?: string;
    email?: string;
    fullName?: string;
    nickname?: string;
    phone?: string;
    dateOfBirth?: string;
    cccd?: string;
    status?: "active" | "inactive";
    accountNumber?: string;
    createdAt?: string;
  };
};

type UserInfo = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  nickname: string;
  phone: string;
  dateOfBirth: string;
  cccd: string;
  status: "active" | "inactive";
  accountNumber: string;
  createdAt: string;
};

const defaultProfile: DepositInfoResponse = {
  bankAccount: "",
  bankName: "",
  hasBankLinked: false,
  available: 0,
  locked: 0,
  total: 0,
  dailyDeposited: 0,
  dailyRemaining: 0,
  limits: {
    minPerTransaction: 100_000,
    maxPerTransaction: 5_000_000_000,
    maxPerDay: 10_000_000_000,
  },
};

const defaultUserInfo: UserInfo = {
  id: "",
  username: "",
  email: "",
  fullName: "",
  nickname: "",
  phone: "",
  dateOfBirth: "",
  cccd: "",
  status: "active",
  accountNumber: "",
  createdAt: "",
};

// ─── Inline editable field ────────────────────────────────────────────────────
type EditableFieldProps = {
  label: string;
  value: string;
  fieldKey: string;
  type?: string;
  placeholder?: string;
  mono?: boolean;
  onSave: (key: string, value: string) => Promise<void>;
};

// Componnent con cho phép chỉnh sửa thông tin cá nhân
const EditableField = ({ label, value, fieldKey, type = "text", placeholder, mono, onSave }: EditableFieldProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
  };
  const cancel = () => setEditing(false);
  const save = async () => {
    setSaving(true);
    await onSave(fieldKey, draft);
    setSaving(false);
    setEditing(false);
  };
  //UI của form sửa
  return (
    <div className={styles.fieldBox}>
      <span className={styles.fieldLabel}>{label}</span>
      {editing ? (
        <div className={styles.fieldEditRow}>
          <input
            className={styles.fieldInput}
            type={type}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") cancel();
            }}
            autoFocus
          />
          <button className={styles.iconBtnSave} onClick={() => void save()} disabled={saving}>
            <CheckOutlined />
          </button>
          <button className={styles.iconBtnCancel} onClick={cancel} disabled={saving}>
            <CloseOutlined />
          </button>
        </div>
      ) : (
        <div className={styles.fieldValueRow}>
          <span className={`${styles.fieldValue}${mono ? " " + styles.mono : ""}`}>
            {fieldKey === "cccd"
              ? maskCCCD(value)
              : fieldKey === "dateOfBirth"
                ? formatDOB(value)
                : fieldKey === "phone"
                  ? formatPhone(value)
                  : value || "--"}
          </span>
          <button className={styles.iconBtnEdit} onClick={startEdit}>
            <EditOutlined />
          </button>
        </div>
      )}
    </div>
  );
};

const ReadField = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className={styles.fieldBox}>
    <span className={styles.fieldLabel}>{label}</span>
    <div className={styles.fieldValueRow}>
      <span className={`${styles.fieldValue}${mono ? " " + styles.mono : ""}`}>{value || "--"}</span>
    </div>
  </div>
);

const UserProfile = forwardRef<UserProfileHandle, Props>(({ token }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [profile, setProfile] = useState<DepositInfoResponse>(defaultProfile);
  const [userInfo, setUserInfo] = useState<UserInfo>(defaultUserInfo);
  // đổi mật khẩu
  const [pwExpanded, setPwExpanded] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  // Dùng toast
  const { toasts, pushToast, removeToast } = useToast();

  useImperativeHandle(ref, () => ({
    open: () => setIsOpen(true),
  }));

  const fetchProfile = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setErrorMessage("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [depositRes, meRes] = await Promise.all([axios.get("/api/deposit/info", { headers }), axios.get("/api/auth/me", { headers })]);

      const data = depositRes.data as Partial<DepositInfoResponse>;
      const meData = meRes.data as AuthMeResponse;
      const user = meData.user ?? {};

      setProfile({
        bankAccount: typeof data.bankAccount === "string" ? data.bankAccount : "",
        bankName: typeof data.bankName === "string" ? data.bankName : "",
        hasBankLinked: !!data.hasBankLinked,
        available: typeof data.available === "number" ? data.available : 0,
        locked: typeof data.locked === "number" ? data.locked : 0,
        total: typeof data.total === "number" ? data.total : 0,
        dailyDeposited: typeof data.dailyDeposited === "number" ? data.dailyDeposited : 0,
        dailyRemaining: typeof data.dailyRemaining === "number" ? data.dailyRemaining : 0,
        limits: {
          minPerTransaction: typeof data.limits?.minPerTransaction === "number" ? data.limits.minPerTransaction : 100_000,
          maxPerTransaction: typeof data.limits?.maxPerTransaction === "number" ? data.limits.maxPerTransaction : 5_000_000_000,
          maxPerDay: typeof data.limits?.maxPerDay === "number" ? data.limits.maxPerDay : 10_000_000_000,
        },
      });
      setUserInfo({
        id: typeof user.id === "string" ? user.id : "",
        username: typeof user.username === "string" ? user.username : "",
        email: typeof user.email === "string" ? user.email : "",
        fullName: typeof user.fullName === "string" ? user.fullName : "",
        nickname: typeof user.nickname === "string" ? user.nickname : "",
        phone: typeof user.phone === "string" ? user.phone : "",
        dateOfBirth: typeof user.dateOfBirth === "string" ? user.dateOfBirth : "",
        cccd: typeof user.cccd === "string" ? user.cccd : "",
        status: user.status === "inactive" ? "inactive" : "active",
        accountNumber: typeof user.accountNumber === "string" ? user.accountNumber : "",
        createdAt: typeof user.createdAt === "string" ? user.createdAt : "",
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Không tải được thông tin hồ sơ";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      void fetchProfile();
    }
  }, [isOpen, fetchProfile]);

  const handleSaveField = async (key: string, value: string) => {
    if (!token) return;
    try {
      const res = await axios.put("/api/auth/profile", { [key]: value }, { headers: { Authorization: `Bearer ${token}` } });
      const updated = (res.data as { user?: Partial<UserInfo> }).user ?? {};
      setUserInfo((prev) => ({ ...prev, ...updated }));
      pushToast("Cập nhật thành công", "Thông tin của bạn đã được lưu", "success");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Lưu thất bại";
      pushToast("Cập nhật thất bại", msg, "error");
    }
  };

  const handleChangePassword = async () => {
    if (!token) return;
    setPwSaving(true);
    try {
      await axios.post(
        "/api/auth/change-password",
        { oldPassword: oldPw, newPassword: newPw, confirmPassword: confirmPw },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      pushToast("Đổi mật khẩu thành công!", "Mật khẩu mới của bạn đã được áp dụng", "success");
      setPwExpanded(false);
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Đổi mật khẩu thất bại!";
      pushToast("Đổi mật khẩu thất bại!", msg, "error");
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className={styles.userProfileWrap}>
      <Modal
        open={isOpen}
        onCancel={() => setIsOpen(false)}
        footer={null}
        centered
        width={800}
        styles={{
          body: {
            maxHeight: "90vh",
            overflowY: "auto",
          },
        }}
        destroyOnHidden
        title={null}
        mask={{ closable: false }}
      >
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div>
              <h2>Hồ sơ tài khoản</h2>
            </div>
            <button type="button" className={styles.reloadBtn} onClick={() => void fetchProfile()} disabled={loading || !token}>
              <ReloadOutlined />
              Tải lại
            </button>
          </div>
        </div>

        {!token ? (
          <div className={styles.emptyState}>Vui lòng đăng nhập để xem hồ sơ.</div>
        ) : loading ? (
          <div className={styles.emptyState}>Đang tải dữ liệu...</div>
        ) : errorMessage ? (
          <div className={styles.errorState}>{errorMessage}</div>
        ) : (
          <>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <UserOutlined />
                <span>Thông tin cá nhân</span>
                <span className={`${styles.statusBadge} ${userInfo.status === "active" ? styles.statusActive : styles.statusInactive}`}>
                  {userInfo.status === "active" ? "Trực tuyến" : "Ngoại tuyến"}
                </span>
              </div>

              {/* Row 1: Họ và tên + Username */}
              <div className={styles.fieldRow2}>
                <EditableField label="Họ và tên" value={userInfo.fullName} fieldKey="fullName" placeholder="Nguyen Van A" onSave={handleSaveField} />
                <ReadField label="Tên đăng nhập" value={userInfo.username} />
              </div>

              {/* Row 2: Email + Số điện thoại */}
              <div className={styles.fieldRow2}>
                <ReadField label="Email" value={userInfo.email} />
                <EditableField
                  label="Số điện thoại"
                  value={userInfo.phone}
                  fieldKey="phone"
                  type="tel"
                  placeholder="0912345678"
                  onSave={handleSaveField}
                />
              </div>

              {/* Row 3: Mật khẩu + Đổi mật khẩu */}
              <div className={styles.fieldRow1}>
                <div className={styles.fieldBox}>
                  <span className={styles.fieldLabel}>Mật khẩu</span>
                  <div className={styles.fieldValueRow}>
                    <span className={styles.fieldValue}>
                      &#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;
                    </span>
                    <button
                      className={styles.changePwBtn}
                      onClick={() => {
                        setPwExpanded((v) => !v);
                        setOldPw("");
                        setNewPw("");
                        setConfirmPw("");
                      }}
                    >
                      {pwExpanded ? "Hủy" : "Đổi mật khẩu"}
                    </button>
                  </div>
                </div>
              </div>
              {pwExpanded && (
                <div className={styles.pwForm}>
                  <input
                    className={styles.pwInput}
                    type="password"
                    placeholder="Mật khẩu hiện tại"
                    value={oldPw}
                    onChange={(e) => setOldPw(e.target.value)}
                  />
                  <input
                    className={styles.pwInput}
                    type="password"
                    placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                  />
                  <input
                    className={styles.pwInput}
                    type="password"
                    placeholder="Xác nhận mật khẩu mới"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                  />
                  <button className={styles.pwSaveBtn} onClick={() => void handleChangePassword()} disabled={pwSaving}>
                    {pwSaving ? "Đang xử lý..." : "Xác nhận đổi mật khẩu"}
                  </button>
                </div>
              )}

              {/* Row 4: CCCD + Số TK ngân hàng */}
              <div className={styles.fieldRow2}>
                <EditableField label="CCCD/CMND" value={userInfo.cccd} fieldKey="cccd" placeholder="012345678901" mono onSave={handleSaveField} />
                <ReadField label="Tham gia từ ngày" value={formatJoinedAt(userInfo.createdAt)} />
              </div>

              {/* Row 5: Ngày sinh + Biệt danh */}
              <div className={styles.fieldRow2}>
                <EditableField label="Ngày sinh" value={userInfo.dateOfBirth} fieldKey="dateOfBirth" type="date" onSave={handleSaveField} />
                <EditableField
                  label="Biệt danh"
                  value={userInfo.nickname}
                  fieldKey="nickname"
                  placeholder="Biệt danh của bạn"
                  onSave={handleSaveField}
                />
              </div>

              <div className={styles.infoGrid}>
                <div className={styles.infoRow}>
                  <span>User ID</span>
                  <strong>{userInfo.id ? `${userInfo.id.slice(0, 4)}...${userInfo.id.slice(-4)}` : "--"}</strong>
                </div>
              </div>
            </div>

            <div className={styles.balanceBar}>
              <div className={styles.balanceItem}>
                <span className={styles.balanceLabel}>Khả dụng</span>
                <span className={styles.balanceValue}>{formatVND(profile.available)}</span>
              </div>
              <div className={styles.balanceDivider} />
              <div className={styles.balanceItem}>
                <span className={styles.balanceLabel}>Đang giữ</span>
                <span className={styles.balanceValueLocked}>{formatVND(profile.locked)}</span>
              </div>
              <div className={styles.balanceDivider} />
              <div className={styles.balanceItem}>
                <span className={styles.balanceLabel}>Tổng</span>
                <span className={styles.balanceValueTotal}>{formatVND(profile.total)}</span>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <BankOutlined />
                <div style={{ justifyContent: "space-between", display: "flex", width: "100%" }}>
                  <span>Liên kết ngân hàng</span>
                  <strong className={profile.hasBankLinked ? styles.okValue : styles.warnValue}>
                    {profile.hasBankLinked ? "Đã liên kết" : "Chưa liên kết"}
                  </strong>
                </div>
              </div>
              <div className={styles.infoGrid}>
                <div className={styles.infoRow}>
                  <span>Ngân hàng</span>
                  <strong>{profile.bankName || "--"}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>Số tài khoản</span>
                  <strong>{profile.bankAccount || "--"}</strong>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <span>Thông tin hạn mức nạp</span>
              </div>
              <div className={styles.infoGrid}>
                <div className={styles.infoRow}>
                  <span>Đã nạp hôm nay</span>
                  <strong>{formatVND(profile.dailyDeposited)}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>Còn lại hôm nay</span>
                  <strong>{formatVND(profile.dailyRemaining)}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>Tối thiểu / giao dịch</span>
                  <strong>{formatVND(profile.limits.minPerTransaction)}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>Tối đa / giao dịch</span>
                  <strong>{formatVND(profile.limits.maxPerTransaction)}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>Tối đa / ngày</span>
                  <strong>{formatVND(profile.limits.maxPerDay)}</strong>
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
});

UserProfile.displayName = "UserProfile";

export default UserProfile;
