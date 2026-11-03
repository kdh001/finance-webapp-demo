import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api";
import { formatKRW, formatMonth, formatPercent } from "../format";

interface GoalProjection {
  name: string;
  target: number;
  saved: number;
  deadline: string;
  progress: number;
  avgMonthlySavings: number;
  projectedMonth: string | null;
  requiredMonthly: number;
  monthsToDeadline: number;
  onTrack: boolean;
  achieved: boolean;
}

function GoalCard({ g }: { g: GoalProjection }) {
  const pct = Math.min(1, g.progress);
  const statusBadge = g.achieved ? (
    <span className="badge" style={{ color: "var(--positive)", borderColor: "var(--positive)" }}>달성 🎉</span>
  ) : g.onTrack ? (
    <span className="badge" style={{ color: "var(--positive)", borderColor: "var(--positive)" }}>온트랙</span>
  ) : (
    <span className="badge alert">지연</span>
  );

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>
          {g.name} <span style={{ color: "var(--text-sub)", fontWeight: 400, fontSize: 13 }}>마감 {formatMonth(g.deadline)}</span>
        </h3>
        {statusBadge}
      </div>

      <div className="row" style={{ justifyContent: "space-between", margin: "12px 0 4px" }}>
        <span>
          <b>{formatKRW(g.saved)}</b>
          <span style={{ color: "var(--text-sub)" }}> / {formatKRW(g.target)}</span>
        </span>
        <span style={{ fontWeight: 700 }}>{formatPercent(pct, 0)}</span>
      </div>
      <div className="progress-track" style={{ height: 12 }}>
        <div
          className="progress-fill"
          style={{ width: `${pct * 100}%`, background: g.achieved || g.onTrack ? "var(--positive)" : "var(--negative)" }}
        />
      </div>

      {!g.achieved && (
        <div className="cards" style={{ marginTop: 14 }}>
          <div className="card">
            <div className="label">달성 예상 시점 (FR-5.2)</div>
            <div className="value" style={{ fontSize: 16 }}>
              {g.projectedMonth ? formatMonth(g.projectedMonth) : "계산 불가"}
            </div>
            <div className="sub">
              {g.projectedMonth
                ? `최근 3개월 평균 저축 ${formatKRW(g.avgMonthlySavings)}/월 기준`
                : "최근 저축액이 0 이하라 예측할 수 없습니다"}
            </div>
          </div>
          <div className="card">
            <div className="label">마감일까지 필요한 월 저축액 (FR-5.3)</div>
            <div className="value" style={{ fontSize: 16 }}>
              {g.monthsToDeadline > 0 ? formatKRW(g.requiredMonthly) : formatKRW(g.target - g.saved)}
            </div>
            <div className="sub">
              {g.monthsToDeadline > 0
                ? `남은 ${g.monthsToDeadline}개월 × ${formatKRW(g.requiredMonthly)} = ${formatKRW(g.target - g.saved)}`
                : "마감일이 지났습니다"}
            </div>
          </div>
          <div className="card">
            <div className="label">현재 저축 페이스와 비교</div>
            <div className="value" style={{ fontSize: 16, color: g.onTrack ? "var(--positive)" : "var(--negative)" }}>
              {g.avgMonthlySavings >= g.requiredMonthly ? "▲ 여유" : "▼ 부족"}{" "}
              {formatKRW(Math.abs(g.avgMonthlySavings - g.requiredMonthly))}
            </div>
            <div className="sub">평균 저축액 − 필요 저축액 (월)</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GoalsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: () => apiGet<{ goals: GoalProjection[] }>("/goals"),
  });

  if (isLoading) return <div><h1>목표 트래커</h1><p className="empty">불러오는 중…</p></div>;

  const goals = data?.goals ?? [];
  return (
    <div>
      <h1>목표 트래커</h1>
      {goals.length === 0 ? (
        <div className="panel">
          <p className="empty">
            등록된 목표가 없습니다. <code>data/profile.json</code>의 <code>goals</code> 배열에 목표를
            추가하면 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        goals.map((g) => <GoalCard key={g.name} g={g} />)
      )}
    </div>
  );
}
