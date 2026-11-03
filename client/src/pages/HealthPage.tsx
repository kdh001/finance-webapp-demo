import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api";
import { formatKRW, formatPercent } from "../format";
import { useTheme } from "../theme";
import { seriesPalette } from "../palette";

interface Ratio503020 {
  needs: number;
  wants: number;
  savings: number;
  avgIncome: number;
  avgNeeds: number;
  avgWants: number;
  avgSavings: number;
  monthsUsed: number;
}

interface EmergencyFund {
  liquidAssets: number;
  monthlyLivingCost: number;
  currentMonths: number;
  status: "부족" | "보통" | "충분";
}

interface DebtVerdict {
  name: string;
  principal: number;
  rate: number;
  expectedReturn: number;
  verdict: "상환 우선" | "투자 병행";
  reason: string;
}

interface InsightsRes {
  ratio503020: Ratio503020 | null;
  emergencyFund: EmergencyFund;
  debts: DebtVerdict[];
  riskProfile: string;
}

/** 수평 게이지: 실제 비율 막대 + 기준선 마커 (FR-3.1) */
function RatioGauge({
  label,
  actual,
  benchmark,
  amount,
  color,
  invert,
}: {
  label: string;
  actual: number;
  benchmark: number;
  amount: number;
  color: string;
  /** true면 기준 이상이 좋은 지표 (저축) */
  invert?: boolean;
}) {
  const width = Math.min(100, Math.max(0, actual * 100));
  const diff = actual - benchmark;
  const over = invert ? diff < -0.02 : diff > 0.02;
  const good = invert ? diff >= 0 : diff <= 0;
  const comment = over
    ? `기준보다 ${formatPercent(Math.abs(diff), 0)}p ${invert ? "낮습니다" : "높습니다"}`
    : good
      ? "기준을 충족합니다"
      : "기준 근처입니다";
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
        <span>
          <b>{label}</b>{" "}
          <span style={{ color: "var(--text-sub)", fontSize: 12 }}>
            기준 {formatPercent(benchmark, 0)} · 월 평균 {formatKRW(amount)}
          </span>
        </span>
        <span style={{ fontWeight: 700, color: over ? "var(--negative)" : "var(--positive)" }}>
          {formatPercent(actual, 1)}
        </span>
      </div>
      <div className="progress-track" style={{ position: "relative", height: 14 }}>
        <div className="progress-fill" style={{ width: `${width}%`, background: color }} />
        <div
          title={`기준 ${formatPercent(benchmark, 0)}`}
          style={{
            position: "absolute",
            top: -2,
            bottom: -2,
            left: `${benchmark * 100}%`,
            width: 2,
            background: "var(--text)",
            opacity: 0.55,
          }}
        />
      </div>
      <div style={{ fontSize: 12, color: over ? "var(--negative)" : "var(--text-sub)", marginTop: 3 }}>
        {comment}
      </div>
    </div>
  );
}

export default function HealthPage() {
  const { theme } = useTheme();
  const palette = seriesPalette(theme);
  const { data, isLoading } = useQuery({
    queryKey: ["analysis-insights"],
    queryFn: () => apiGet<InsightsRes>("/analysis/insights"),
  });

  if (isLoading || !data) return <div><h1>재무 진단</h1><p className="empty">불러오는 중…</p></div>;

  const r = data.ratio503020;
  const ef = data.emergencyFund;
  const efColor =
    ef.status === "부족" ? "var(--negative)" : ef.status === "보통" ? palette[2] : "var(--positive)";

  return (
    <div>
      <h1>재무 진단</h1>

      <div className="panel">
        <h3>50 / 30 / 20 진단 <span className="badge">최근 {r?.monthsUsed ?? 0}개월 평균</span></h3>
        {!r ? (
          <p className="empty">진단할 거래 데이터가 없습니다.</p>
        ) : (
          <>
            <RatioGauge label="필수지출" actual={r.needs} benchmark={0.5} amount={r.avgNeeds} color={palette[0]} />
            <RatioGauge label="선택지출" actual={r.wants} benchmark={0.3} amount={r.avgWants} color={palette[7]} />
            <RatioGauge label="저축" actual={Math.max(0, r.savings)} benchmark={0.2} amount={r.avgSavings} color={palette[1]} invert />
            {r.savings < 0 && (
              <p style={{ color: "var(--negative)", fontSize: 13 }}>
                ⚠️ 최근 평균 지출이 수입을 초과하고 있습니다 (월 {formatKRW(Math.abs(r.avgSavings))} 적자).
              </p>
            )}
            <p style={{ color: "var(--text-sub)", fontSize: 12 }}>
              필수지출 = 주거/통신 · 식비 · 교통 · 의료/건강, 선택지출 = 나머지 소비, 저축 = 수입 − 소비 지출
            </p>
          </>
        )}
      </div>

      <div className="panel">
        <h3>비상금 충족도 (FR-3.2)</h3>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <span>
            유동성 자산 <b>{formatKRW(ef.liquidAssets)}</b>
            <span style={{ color: "var(--text-sub)", fontSize: 12 }}> ÷ 월 평균 생활비 {formatKRW(ef.monthlyLivingCost)}</span>
          </span>
          <span style={{ fontWeight: 700, color: efColor }}>
            {ef.currentMonths}개월 · {ef.status}
          </span>
        </div>
        <div className="progress-track" style={{ position: "relative", height: 14 }}>
          <div
            className="progress-fill"
            style={{ width: `${Math.min(100, (ef.currentMonths / 6) * 100)}%`, background: efColor }}
          />
          {[3, 6].map((m) => (
            <div
              key={m}
              title={`${m}개월`}
              style={{
                position: "absolute", top: -2, bottom: -2,
                left: `${(m / 6) * 100}%`, width: 2,
                background: "var(--text)", opacity: 0.55,
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 4 }}>
          기준: 3개월 미만 <b style={{ color: "var(--negative)" }}>부족</b> · 3~6개월 보통 · 6개월 이상{" "}
          <b style={{ color: "var(--positive)" }}>충분</b> (입출금·저축 계좌만 포함, 투자계좌 제외)
        </div>
      </div>

      <div className="panel">
        <h3>부채 평가 <span className="badge">{data.riskProfile} · 기대수익률 {data.debts[0]?.expectedReturn ?? "-"}%</span></h3>
        {data.debts.length === 0 ? (
          <p className="empty">등록된 부채가 없습니다 🎉</p>
        ) : (
          <div className="cards">
            {data.debts.map((d) => (
              <div className="card" key={d.name}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="label">{d.name} · 원금 {formatKRW(d.principal)}</div>
                  <span className={`badge ${d.verdict === "상환 우선" ? "alert" : ""}`}>{d.verdict}</span>
                </div>
                <div className="value" style={{ fontSize: 16 }}>
                  금리 {d.rate}% vs 기대수익률 {d.expectedReturn}%
                </div>
                <div className="sub">{d.reason}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
