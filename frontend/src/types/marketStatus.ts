// src/types/marketStatus.ts

export const marketStatusMap: Record<string, string> = {
  // chu
  A: "Phiên ATC",
  B: "Buyin",
  C: "Phiên GDTT 14h45",
  I: "Nghỉ trưa",
  K: "Đóng cửa",
  O: "Liên tục",
  P: "Phiên ATO",

  // số
  "5": "Liên tục",
  "10": "Nghỉ trưa",
  "13": "Đóng cửa",
  "30": "Phiên ATC",
  "35": "Phiên PLO",
};

const isOutOfTradingHoursVN = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const totalMinutes = hour * 60 + minute;

  // Fallback theo yeu cau: tu 15:00 -> 08:59 hom sau
  return totalMinutes >= 15 * 60 || totalMinutes < 9 * 60;
};

export const mapMarketStatus = (ms?: string | null): string => {
  const isWeekendVN = () => {
    const date = new Date(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date()),
    );

    const day = date.getDay(); // 0 = Chủ nhật, 6 = Thứ 7
    return day === 0 || day === 6;
  };

  if (!ms) {
    if (isWeekendVN()) return "Đóng cửa";
    return isOutOfTradingHoursVN() ? "Đóng cửa" : "Không xác định";
  }

  const code = ms.trim().toUpperCase();
  // Trả về mapping nếu có, ngược lại hiển thị ms gốc để debug
  return marketStatusMap[code] ?? `Không xác định (${ms})`;
};
