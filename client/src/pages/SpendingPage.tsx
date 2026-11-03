import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, CATEGORIES, type Category, type Transaction } from "../api";
import { formatKRW, formatMonth, formatPercent } from "../format";
import { FixedVariableChart } from "../components/charts";
import ColumnMappingModal, { type MappingBody, type PendingMapping } from "../components/ColumnMappingModal";

interface TransactionsRes {
  transactions: Transaction[];
  total: number;
  skippedFiles: Array<{ file: string; headerKey: string; header: string[] }>;
}

interface CategoryDelta {
  category: Category;
  current: number;
  prev: number;
  delta: number;
  pct: number | null;
  anomaly: boolean;
}

interface SummaryRes {
  months: string[];
  selectedMonth: string;
  deltas: CategoryDelta[];
}

interface FixedMerchant {
  merchant: string;
  category: Category;
  avgAmount: number;
  day: number;
}

interface InsightsRes {
  fixedMerchants: FixedMerchant[];
  subscriptions: FixedMerchant[];
  fixedVariable: Array<{ month: string; fixed: number; variable: number }>;
}

const PAGE_SIZE = 50;

export default function SpendingPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState<string>(() => localStorage.getItem("selectedMonth") ?? "");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [pendingMapping, setPendingMapping] = useState<PendingMapping | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [mappingError, setMappingError] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: summary } = useQuery({
    queryKey: ["analysis-summary-deltas", month],
    queryFn: () => apiGet<SummaryRes>(`/analysis/summary?months=12${month ? `&month=${month}` : ""}`),
  });
  const effectiveMonth = month || summary?.selectedMonth || "";

  const txQueryKey = ["transactions", month, category, q];
  const { data: txRes, isLoading } = useQuery({
    queryKey: txQueryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      if (category) params.set("category", category);
      if (q) params.set("q", q);
      return apiGet<TransactionsRes>(`/transactions?${params}`);
    },
  });

  const { data: insights } = useQuery({
    queryKey: ["analysis-insights"],
    queryFn: () => apiGet<InsightsRes>("/analysis/insights"),
  });

  // FR-2.3: 카테고리 수정 → 가맹점 단위 학습. 동일 가맹점 행 전체 낙관적 업데이트
  const patchCategory = useMutation({
    mutationFn: ({ id, category }: { id: string; category: Category }) =>
      apiSend<{ ok: boolean }>("PATCH", `/transactions/${id}/category`, { category }),
    onMutate: async ({ id, category }) => {
      await qc.cancelQueries({ queryKey: txQueryKey });
      const prev = qc.getQueryData<TransactionsRes>(txQueryKey);
      if (prev) {
        const merchant = prev.transactions.find((t) => t.id === id)?.merchant;
        qc.setQueryData<TransactionsRes>(txQueryKey, {
          ...prev,
          transactions: prev.transactions.map((t) =>
            t.merchant === merchant ? { ...t, category, categorySource: "override" } : t,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(txQueryKey, ctx.prev),
    onSettled: () => qc.invalidateQueries(),
  });

  const uploadFile = async (file: File) => {
    setUploadMsg(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/transactions/upload", { method: "POST", body: form });
    const body = await res.json().catch(() => null);
    if (res.ok) {
      setUploadMsg(`✅ ${file.name} — ${body.format ?? "인식됨"} 포맷, ${body.count}건 가져옴`);
      qc.invalidateQueries();
    } else if (res.status === 422 && body?.needsMapping) {
      setPendingMapping({ tempId: body.tempId, headerKey: body.headerKey, header: body.header, filename: file.name });
    } else {
      setUploadMsg(`⚠️ 업로드 실패: ${body?.error ?? res.status}`);
    }
  };

  const submitMapping = async (map: MappingBody) => {
    if (!pendingMapping) return;
    setMappingError(undefined);
    try {
      const body = await apiSend<{ count: number }>("POST", "/transactions/mapping", {
        tempId: pendingMapping.tempId,
        headerKey: pendingMapping.headerKey,
        map,
      });
      setUploadMsg(`✅ ${pendingMapping.filename} — 수동 매핑으로 ${body.count}건 가져옴 (매핑 저장됨)`);
      setPendingMapping(null);
      qc.invalidateQueries();
    } catch (e) {
      setMappingError(e instanceof Error ? e.message : "매핑 파싱에 실패했습니다.");
    }
  };

  const txs = txRes?.transactions ?? [];
  const deltas = summary?.deltas ?? [];
  const months = summary?.months ?? [];

  return (
    <div>
      <h1>소비 분석</h1>

      <div className="row" style={{ marginBottom: 14 }}>
        <select value={month} onChange={(e) => { setMonth(e.target.value); setVisible(PAGE_SIZE); if (e.target.value) localStorage.setItem("selectedMonth", e.target.value); }} aria-label="월 필터">
          <option value="">전체 기간</option>
          {months.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setVisible(PAGE_SIZE); }} aria-label="카테고리 필터">
          <option value="">전체 카테고리</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder="가맹점 검색"
          value={q}
          onChange={(e) => { setQ(e.target.value); setVisible(PAGE_SIZE); }}
        />
        <span style={{ flex: 1 }} />
        <button className="btn secondary" onClick={() => fileRef.current?.click()}>📄 CSV 업로드</button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {uploadMsg && <div className="banner">{uploadMsg}</div>}
      {(txRes?.skippedFiles?.length ?? 0) > 0 && (
        <div className="banner">
          ⚠️ 인식하지 못한 파일: {txRes!.skippedFiles.map((item) => item.file).join(", ")} — 업로드 버튼으로 다시 올리면 컬럼 매핑을 지정할 수 있습니다.
        </div>
      )}

      <div className="panel">
        <h3>거래 내역 {txRes ? `· ${txRes.total}건` : ""}</h3>
        {isLoading ? (
          <p className="empty">불러오는 중…</p>
        ) : txs.length === 0 ? (
          <p className="empty">조건에 맞는 거래가 없습니다.</p>
        ) : (
          <>
            <table className="data">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>가맹점</th>
                  <th>카테고리</th>
                  <th className="num">금액</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {txs.slice(0, visible).map((t) => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{t.date}</td>
                    <td>{t.merchant}</td>
                    <td>
                      <select
                        value={t.category}
                        onChange={(e) => patchCategory.mutate({ id: t.id, category: e.target.value as Category })}
                        aria-label={`${t.merchant} 카테고리`}
                        style={{ padding: "4px 6px", fontSize: 12 }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      {t.categorySource === "override" && <span className="badge" title="수동 수정이 학습된 가맹점">학습됨</span>}
                    </td>
                    <td className={`num ${t.amount > 0 ? "amount-pos" : "amount-neg"}`}>
                      {t.amount > 0 ? "▲ " : "▼ "}
                      {formatKRW(Math.abs(t.amount))}
                    </td>
                    <td>{t.isFixed && <span className="badge">고정</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {txs.length > visible && (
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <button className="btn secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  더 보기 ({txs.length - visible}건 남음)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="panel">
        <h3>전월 대비 카테고리 증감 · {effectiveMonth ? formatMonth(effectiveMonth) : ""}</h3>
        {deltas.length === 0 ? (
          <p className="empty">비교할 데이터가 없습니다.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>카테고리</th>
                <th className="num">이번 달</th>
                <th className="num">전월</th>
                <th className="num">증감</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deltas.map((d) => (
                <tr key={d.category} style={d.anomaly ? { background: "var(--warn-bg)" } : undefined}>
                  <td>{d.category}</td>
                  <td className="num">{formatKRW(d.current)}</td>
                  <td className="num">{formatKRW(d.prev)}</td>
                  <td className={`num ${d.delta > 0 ? "delta-up" : d.delta < 0 ? "delta-down" : ""}`}>
                    {d.delta > 0 ? "▲ " : d.delta < 0 ? "▼ " : ""}
                    {formatKRW(Math.abs(d.delta))}
                    {d.pct !== null && ` (${d.delta > 0 ? "+" : d.delta < 0 ? "−" : ""}${formatPercent(Math.abs(d.pct), 0)})`}
                  </td>
                  <td>{d.anomaly && <span className="badge alert" title="직전 3개월 평균 대비 50% 이상 증가">이상 지출</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h3>고정지출 vs 변동지출</h3>
        {insights && insights.fixedVariable.length > 0 ? (
          <>
            <FixedVariableChart data={insights.fixedVariable} />
            {insights.fixedMerchants.length > 0 && (
              <p style={{ color: "var(--text-sub)", fontSize: 12 }}>
                고정지출 판정: {insights.fixedMerchants.map((f) => f.merchant).join(", ")}
              </p>
            )}
          </>
        ) : (
          <p className="empty">고정지출을 판정하려면 2개월 이상의 데이터가 필요합니다.</p>
        )}
      </div>

      <div className="panel">
        <h3>구독 서비스 {insights ? `· 월 ${formatKRW(insights.subscriptions.reduce((s, x) => s + x.avgAmount, 0))}` : ""}</h3>
        {!insights || insights.subscriptions.length === 0 ? (
          <p className="empty">탐지된 구독 서비스가 없습니다.</p>
        ) : (
          <div className="cards">
            {insights.subscriptions.map((s) => (
              <div className="card" key={s.merchant}>
                <div className="label">{s.category} · 매월 {s.day}일경</div>
                <div className="value" style={{ fontSize: 16 }}>{s.merchant}</div>
                <div className="sub">{formatKRW(s.avgAmount)} / 월</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingMapping && (
        <ColumnMappingModal
          pending={pendingMapping}
          onSubmit={submitMapping}
          onClose={() => { setPendingMapping(null); setMappingError(undefined); }}
          submitting={false}
          error={mappingError}
        />
      )}
    </div>
  );
}
