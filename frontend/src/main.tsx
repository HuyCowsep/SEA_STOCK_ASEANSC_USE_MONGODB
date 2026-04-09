import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.scss";
import { IntlProvider } from "react-intl";
import { ConfigProvider, theme } from "antd"; // 🔥 thêm dòng này

import en from "./i18n/en";
import vi from "./i18n/vi";

const language = localStorage.getItem("lang") || "en";

const messages = {
  en,
  vi,
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm, // 🔥 bật dark mode global
        token: {
          colorBgBase: "#0f172a", // nền chính (deep dark)
          colorBgContainer: "#111827", // card, modal
          colorBgElevated: "#111827", // dropdown, modal nổi
          colorText: "#e5e7eb", // text chính
          colorBorder: "#1f2937",
        },
        components: {
          Modal: {
            contentBg: "#111827",
            headerBg: "#111827",
            footerBg: "#111827",
          },
        },
      }}
    >
      <IntlProvider locale={language} messages={messages[language as "en" | "vi"]}>
        <App />
      </IntlProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
