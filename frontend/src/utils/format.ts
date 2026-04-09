// Format tiền VND
export const formatVND = (value: number) => `${value.toLocaleString("vi-VN")} VND`;

// Format ngày tham tạo tài khoản
export const formatJoinedAt = (value: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN");
};

// Ẩn CCCD, chỉ show 4 số cuối
export const maskCCCD = (cccd?: string) => {
  if (!cccd) return "";
  return `********${cccd.slice(-4)}`;
};

// Format ngày tháng năm sinh kiểu VN
export const formatDOB = (value?: string) => {
  if (!value) return "--";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`; // kiểu VN
};

// Format số điện thoại kiểu VN: 10 chữ số, style 4-3-3
export const formatPhone = (phone?: string) => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, ""); // chỉ lấy số
  if (digits.length !== 10) return phone; // fallback
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
};
