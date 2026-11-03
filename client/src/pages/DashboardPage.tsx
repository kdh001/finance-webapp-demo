import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type Account } from "../api";
import { formatKRW, formatMonth, formatPercent } from "../format";
import { MonthlyTrendChart, CategoryDonut } from "../components/charts";

interface AccountsRes {
  accounts: Account[];
  totalAssets: number;
}

interface MonthlySummary {
  month: string;
  income: number;
  totalExpense: number;
  savings: number;
  savingsRate: number;
  byCategory: Record<string, number>;
}

interface SummaryRes {
  months: string[];
  selectedMonth: string;
  monthly: MonthlySummary[];
}

export default function DashboardPage() {
  const { data: acc } = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<AccountsRes>("/accounts") });
  const { data: summary, isLoading } = useQuery({
    queryKey: ["analysis-summary"],
    queryFn: () => apiGet<SummaryRes>("/analysis/summary?months=12"),
  });
  const [donutMonth, setDonutMonth] = useState<string>(() => localStorage.getItem("selectedMonth") ?? "");

  if (isLoading) return <div><h1>대시보드</h1><p className="empty">불러오는 중…</p></div>;

  const monthly = summary?.monthly ?? [];
  if (monthly.length === 0) {
    return (
      <div>
        <h1>대시보드</h1>
        <div className="panel">
          <h3>아직 거래 데이터가 없습니다</h3>
          <p>
            은행/카드사에서 다운로드한 CSV를 <code>data/transactions/</code> 폴더에 넣거나,
            <b> 소비 분석</b> 페이지에서 파일을 업로드하면 자동으로 분석이 시작됩니다.
          </p>
        </div>
      </div>
    );
  }

  const latest = monthly[monthly.length - 1];
  const selected = monthly.find((m) => m.month === donutMonth) ?? latest;

  const selectMonth = (m: string) => {
    setDonutMonth(m);
    localStorage.setItem("selectedMonth", m);
  };

  return (
    <div>
      <h1>대시보드</h1>

      <div className="cards">
        <div className="card">
          <div className="label">총자산</div>
          <div className="value">{formatKRW(acc?.totalAssets ?? 0)}</div>
          <div className="sub">계좌 {acc?.accounts.length ?? 0}개 잔액 합계</div>
        </div>
        <div className="card">
          <div className="label">{formatMonth(latest.month)} 수입</div>
          <div className="value amount-pos">▲ {formatKRW(latest.income)}</div>
        </div>
        <div className="card">
          <div className="label">{formatMonth(latest.month)} 지출</div>
          <div className="value">▼ {formatKRW(latest.totalExpense)}</div>
          <div className="sub">저축성 이체 제외</div>
        </div>
        <div className="card">
          <div className="label">저축률</div>
          <div className="value" style={{ color: latest.savingsRate >= 0.2 ? "var(--positive)" : latest.savingsRate < 0 ? "var(--negative)" : undefined }}>
            {formatPercent(latest.savingsRate)}
          </div>
          <div className="sub">이번 달 (수입 − 지출) / 수입</div>
        </div>
      </div>

      <div className="panel">
        <h3>월별 수입·지출 추이</h3>
        <MonthlyTrendChart data={monthly} />
      </div>

      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>카테고리별 지출 · {formatMonth(selected.month)}</h3>
          <select value={selected.month} onChange={(e) => selectMonth(e.target.value)} aria-label="월 선택">
            {monthly.map((m) => (
              <option key={m.month} value={m.month}>{formatMonth(m.month)}</option>
            ))}
          </select>
        </div>
        <CategoryDonut byCategory={selected.byCategory} />
      </div>
    </div>
  );
}
