import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ComingSoon from "./pages/ComingSoon";
// import TermsService from "./pages/TermsService";
// import RiskDisclosure from "./pages/RiskDisclosure";
// import UserGuide from "./pages/UserGuide";
// import ContactAseanSC from "./pages/ContactAseanSC";
import { useState } from "react";

function App() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  const [currentLanguage, setCurrentLanguage] = useState(localStorage.getItem("lang") || "vi");

  // token state
  const [token, setToken] = useState(localStorage.getItem("token"));

  const toggleTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.body.setAttribute("data-theme", newTheme);
  };

  const changeLanguage = (lang: string) => {
    setCurrentLanguage(lang);
    localStorage.setItem("lang", lang);
    window.location.reload();
  };

  return (
    <div>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route
            path="/dashboard"
            element={
              <Dashboard
                setToken={setToken}
                token={token}
                theme={theme}
                onThemeChange={toggleTheme}
                onLanguageChange={changeLanguage}
                currentLanguage={currentLanguage}
              />
            }
          />
          {/* <Route path="/terms-service" element={<TermsService />} />
          <Route path="/risk-disclosure" element={<RiskDisclosure />} />
          <Route path="/user-guide" element={<UserGuide />} />
          <Route path="/contact-aseansc" element={<ContactAseanSC />} /> */}

          {/* Catch-all route */}
          <Route path="*" element={<ComingSoon />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
