//src/pages/ComingSoon.tsx
import { useNavigate } from "react-router-dom";

const ComingSoon = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        padding: "24px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: "600px",
          padding: "48px 32px",
          background: "#111827",
          border: "1px solid #374151",
          borderRadius: "12px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Icon/Emoji */}
        <div
          style={{
            fontSize: "72px",
            marginBottom: "24px",
          }}
        >
          🚀
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: "32px",
            fontWeight: "bold",
            color: "#ffffff",
            marginBottom: "16px",
            margin: "0 0 16px 0",
          }}
        >
          Trang Chưa Phát Triển
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: "16px",
            color: "#d1d5db",
            marginBottom: "12px",
            margin: "0 0 12px 0",
          }}
        >
          Chúng tôi đang làm việc chăm chỉ để triển khai tính năng này.
        </p>

        {/* Description */}
        <p
          style={{
            fontSize: "14px",
            color: "#9ca3af",
            marginBottom: "32px",
            margin: "0 0 32px 0",
            lineHeight: "1.6",
          }}
        >
          Vui lòng quay lại trang chủ hoặc thử các tính năng khác. Cảm ơn bạn đã
          chờ đợi!
        </p>

        {/* Button */}
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            padding: "12px 32px",
            background: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.3s ease",
            boxShadow: "0 4px 6px -1px rgba(239, 68, 68, 0.3)",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.background = "#dc2626";
            (e.target as HTMLButtonElement).style.boxShadow =
              "0 10px 15px -3px rgba(239, 68, 68, 0.4)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.background = "#ef4444";
            (e.target as HTMLButtonElement).style.boxShadow =
              "0 4px 6px -1px rgba(239, 68, 68, 0.3)";
          }}
        >
          ← Quay Về Dashboard
        </button>
      </div>
    </div>
  );
};

export default ComingSoon;
