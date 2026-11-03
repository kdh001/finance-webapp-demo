import { NavLink, Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import { useTheme } from "./theme";
import DashboardPage from "./pages/DashboardPage";
import SpendingPage from "./pages/SpendingPage";
import HealthPage from "./pages/HealthPage";
import GoalsPage from "./pages/GoalsPage";

interface Health {
  ok: boolean;
  aiEnabled: boolean;
  usingSample: boolean;
}

const NAV = [
  { to: "/", label: "대시보드" },
  { to: "/spending", label: "소비 분석" },
  { to: "/health", label: "재무 진단" },
  { to: "/goals", label: "목표 트래커" },
];

export default function App() {
  const { theme, toggle } = useTheme();
  const { data: health } = useQuery({ queryKey: ["health"], queryFn: () => apiGet<Health>("/health") });

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">💰 내 재정 대시보드</div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <button className="theme-toggle" onClick={toggle}>
          {theme === "light" ? "🌙 다크 모드" : "☀️ 라이트 모드"}
        </button>
      </aside>
      <main className="main">
        {health?.usingSample && (
          <div className="banner">
            📂 모두 합성한 데모 데이터를 사용합니다. 실제 금융 정보는 입력하지 마세요.
          </div>
        )}
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/spending" element={<SpendingPage />} />
          <Route path="/health" element={<HealthPage />} />
          <Route path="/goals" element={<GoalsPage />} />
        </Routes>
      </main>
    </div>
  );
}
