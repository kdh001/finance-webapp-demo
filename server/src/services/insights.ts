import type { Account, Category, Debt, Goal, Transaction } from "../types.js";

/** 저축성 이체 (소비가 아님): 지출 합계·도넛에서 제외하고 저축으로 계산 */
export function isSavingsTransfer(tx: Transaction): boolean {
  return tx.category === "금융" && /적금|저축|파킹|예금|청약|isa|irp|연금/i.test(tx.merchant);
}

export interface MonthlySummary {
  month: string;
  income: number;
  totalExpense: number; // 소비 지출 (저축성 이체 제외, 양수)
  savings: number; // income - totalExpense
  savingsRate: number; // 0~1 (income 0이면 0)
  byCategory: Partial<Record<Category, number>>; // 소비 지출만, 양수
}

export function monthsOf(transactions: Transaction[]): string[] {
  return [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort();
}

export function monthlySummaries(transactions: Transaction[], limit = 12): MonthlySummary[] {
  const months = monthsOf(transactions).slice(-limit);
  return months.map((month) => {
    const txs = transactions.filter((t) => t.date.startsWith(month));
    const income = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const byCategory: Partial<Record<Category, number>> = {};
    let totalExpense = 0;
    for (const t of txs) {
      if (t.amount >= 0 || isSavingsTransfer(t)) continue;
      const amt = -t.amount;
      totalExpense += amt;
      byCategory[t.category] = (byCategory[t.category] ?? 0) + amt;
    }
    const savings = income - totalExpense;
    return {
      month,
      income,
      totalExpense,
      savings,
      savingsRate: income > 0 ? savings / income : 0,
      byCategory,
    };
  });
}

export interface CategoryDelta {
  category: Category;
  current: number;
  prev: number;
  delta: number;
  pct: number | null; // prev 0이면 null
  anomaly: boolean; // 직전 3개월 평균 대비 +50% 이상 (FR-2.5)
}

export function categoryDeltas(summaries: MonthlySummary[], month: string): CategoryDelta[] {
  const idx = summaries.findIndex((s) => s.month === month);
  if (idx < 0) return [];
  const cur = summaries[idx];
  const prev = idx > 0 ? summaries[idx - 1] : undefined;
  const window = summaries.slice(Math.max(0, idx - 3), idx);
  const categories = new Set<Category>([
    ...(Object.keys(cur.byCategory) as Category[]),
    ...(prev ? (Object.keys(prev.byCategory) as Category[]) : []),
  ]);
  return [...categories]
    .map((category) => {
      const current = cur.byCategory[category] ?? 0;
      const prevAmt = prev?.byCategory[category] ?? 0;
      const avg =
        window.length > 0
          ? window.reduce((s, m) => s + (m.byCategory[category] ?? 0), 0) / window.length
          : 0;
      return {
        category,
        current,
        prev: prevAmt,
        delta: current - prevAmt,
        pct: prevAmt > 0 ? (current - prevAmt) / prevAmt : null,
        anomaly: window.length >= 1 && avg >= 50_000 && current > avg * 1.5,
      };
    })
    .sort((a, b) => b.current - a.current);
}

export interface FixedMerchant {
  merchant: string;
  category: Category;
  avgAmount: number; // 양수
  day: number; // 대표 결제일
  uniformAmount: boolean; // 금액 편차 ≤1% → 구독 후보
}

/**
 * 고정지출 판정 (FR-2.6): 최근 3개월(데이터가 2개월뿐이면 2개월) 모두
 * 월 1회 결제 + 금액 편차 ±10% + 결제일 편차 ±3일
 */
export function detectFixedMerchants(transactions: Transaction[]): FixedMerchant[] {
  const months = monthsOf(transactions);
  const window = months.slice(-3);
  if (window.length < 2) return [];

  const byMerchant = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.amount >= 0 || !window.includes(t.date.slice(0, 7))) continue;
    const list = byMerchant.get(t.merchant) ?? [];
    list.push(t);
    byMerchant.set(t.merchant, list);
  }

  const result: FixedMerchant[] = [];
  for (const [merchant, txs] of byMerchant) {
    const perMonth = new Map<string, Transaction[]>();
    for (const t of txs) {
      const m = t.date.slice(0, 7);
      perMonth.set(m, [...(perMonth.get(m) ?? []), t]);
    }
    // 모든 윈도우 월에 정확히 1회씩 등장해야 고정지출
    if (perMonth.size !== window.length) continue;
    if (![...perMonth.values()].every((list) => list.length === 1)) continue;

    const amounts = txs.map((t) => -t.amount);
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const maxDev = Math.max(...amounts.map((a) => Math.abs(a - mean)));
    if (maxDev > mean * 0.1) continue;

    const days = txs.map((t) => Number(t.date.slice(8, 10)));
    if (Math.max(...days) - Math.min(...days) > 6) continue;

    result.push({
      merchant,
      category: txs[0].category,
      avgAmount: Math.round(mean),
      day: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
      uniformAmount: maxDev <= mean * 0.01,
    });
  }
  return result.sort((a, b) => b.avgAmount - a.avgAmount);
}

/** 구독 탐지 (FR-2.7): 매월 동일 금액(±1%) 반복 결제, 주거·금융·경조사 제외 */
export function detectSubscriptions(fixed: FixedMerchant[]): FixedMerchant[] {
  const excluded: Category[] = ["주거/통신", "금융", "경조사/이체", "수입"];
  return fixed.filter(
    (f) => f.category === "구독" || (f.uniformAmount && !excluded.includes(f.category)),
  );
}

export interface FixedVariableSplit {
  month: string;
  fixed: number;
  variable: number;
}

export function fixedVariableSplit(
  transactions: Transaction[],
  fixedMerchants: FixedMerchant[],
  limit = 12,
): FixedVariableSplit[] {
  const fixedSet = new Set(fixedMerchants.map((f) => f.merchant));
  const months = monthsOf(transactions).slice(-limit);
  return months.map((month) => {
    let fixed = 0;
    let variable = 0;
    for (const t of transactions) {
      if (t.amount >= 0 || !t.date.startsWith(month) || isSavingsTransfer(t)) continue;
      if (fixedSet.has(t.merchant)) fixed += -t.amount;
      else variable += -t.amount;
    }
    return { month, fixed, variable };
  });
}

// ---------- M3: 재무 진단 (FR-3) ----------

/** 50/30/20 필수지출 카테고리 (FR-3.1) */
export const NEEDS_CATEGORIES: Category[] = ["주거/통신", "식비", "교통", "의료/건강"];

export interface Ratio503020 {
  needs: number; // 수입 대비 0~1 (수입 0이면 0)
  wants: number;
  savings: number; // 음수 가능 (적자)
  avgIncome: number;
  avgNeeds: number;
  avgWants: number;
  avgSavings: number;
  monthsUsed: number;
}

/** 최근 3개월 평균 기준 50/30/20 비율 */
export function ratio503020(summaries: MonthlySummary[]): Ratio503020 | null {
  const window = summaries.slice(-3);
  if (window.length === 0) return null;
  const n = window.length;
  const avgIncome = window.reduce((s, m) => s + m.income, 0) / n;
  const avgNeeds =
    window.reduce(
      (s, m) => s + NEEDS_CATEGORIES.reduce((a, c) => a + (m.byCategory[c] ?? 0), 0),
      0,
    ) / n;
  const avgExpense = window.reduce((s, m) => s + m.totalExpense, 0) / n;
  const avgWants = avgExpense - avgNeeds;
  const avgSavings = avgIncome - avgExpense;
  const ratio = (v: number) => (avgIncome > 0 ? v / avgIncome : 0);
  return {
    needs: ratio(avgNeeds),
    wants: ratio(avgWants),
    savings: ratio(avgSavings),
    avgIncome,
    avgNeeds,
    avgWants,
    avgSavings,
    monthsUsed: n,
  };
}

export interface EmergencyFund {
  liquidAssets: number; // checking + savings 잔액 (투자계좌 제외)
  monthlyLivingCost: number; // 최근 3개월 평균 소비 지출
  currentMonths: number; // 생활비 대비 개월 수
  status: "부족" | "보통" | "충분"; // <3 / 3~6 / ≥6 (FR-3.2)
}

export function emergencyFund(accounts: Account[], summaries: MonthlySummary[]): EmergencyFund {
  const liquidAssets = accounts
    .filter((a) => a.type === "checking" || a.type === "savings")
    .reduce((s, a) => s + a.balance, 0);
  const window = summaries.slice(-3);
  const monthlyLivingCost =
    window.length > 0 ? window.reduce((s, m) => s + m.totalExpense, 0) / window.length : 0;
  const currentMonths = monthlyLivingCost > 0 ? liquidAssets / monthlyLivingCost : 0;
  return {
    liquidAssets,
    monthlyLivingCost: Math.round(monthlyLivingCost),
    currentMonths: Math.round(currentMonths * 10) / 10,
    status: currentMonths < 3 ? "부족" : currentMonths < 6 ? "보통" : "충분",
  };
}

/** 성향별 기대 투자수익률 % (FR-3.3) */
export const EXPECTED_RETURN: Record<string, number> = {
  안정형: 3.5,
  중립형: 5,
  공격형: 7,
};

export interface DebtVerdict extends Debt {
  expectedReturn: number;
  verdict: "상환 우선" | "투자 병행";
  reason: string;
}

/** 부채금리 > 기대수익률 − 1%p 이면 상환 우선 (§7.6) */
export function debtVerdicts(debts: Debt[], riskProfile: string): DebtVerdict[] {
  const expected = EXPECTED_RETURN[riskProfile] ?? EXPECTED_RETURN["중립형"];
  return debts.map((d) => {
    const repayFirst = d.rate > expected - 1;
    return {
      ...d,
      expectedReturn: expected,
      verdict: repayFirst ? "상환 우선" : "투자 병행",
      reason: repayFirst
        ? `부채 금리 ${d.rate}%가 기대수익률 ${expected}% − 1%p보다 높아 확실한 수익인 상환이 유리합니다.`
        : `부채 금리 ${d.rate}%가 기대수익률 ${expected}%보다 충분히 낮아 투자와 병행할 수 있습니다.`,
    };
  });
}

// ---------- M3: 목표 트래커 (FR-5) ----------

export interface GoalProjection {
  name: string;
  target: number;
  saved: number;
  deadline: string; // YYYY-MM
  progress: number; // 0~1
  avgMonthlySavings: number; // 최근 3개월 평균 월 저축액
  projectedMonth: string | null; // 달성 예상 시점 (저축액 ≤0이면 null)
  requiredMonthly: number; // 마감일까지 필요한 월 저축액
  monthsToDeadline: number;
  onTrack: boolean;
  achieved: boolean;
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function monthDiff(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return ty * 12 + tm - (fy * 12 + fm);
}

export function goalProjections(
  goals: Goal[],
  summaries: MonthlySummary[],
  nowMonth: string,
): GoalProjection[] {
  const window = summaries.slice(-3);
  const avgMonthlySavings =
    window.length > 0
      ? Math.round(window.reduce((s, m) => s + m.savings, 0) / window.length)
      : 0;

  return goals.map((g) => {
    const saved = g.saved ?? 0;
    const remaining = Math.max(0, g.target - saved);
    const achieved = remaining === 0;
    const monthsToDeadline = Math.max(0, monthDiff(nowMonth, g.deadline));
    const monthsNeeded =
      avgMonthlySavings > 0 ? Math.ceil(remaining / avgMonthlySavings) : null;
    const projectedMonth = achieved ? nowMonth : monthsNeeded !== null ? addMonths(nowMonth, monthsNeeded) : null;
    return {
      name: g.name,
      target: g.target,
      saved,
      deadline: g.deadline,
      progress: g.target > 0 ? saved / g.target : 0,
      avgMonthlySavings,
      projectedMonth,
      requiredMonthly: achieved ? 0 : Math.ceil(remaining / Math.max(1, monthsToDeadline)),
      monthsToDeadline,
      onTrack: achieved || (projectedMonth !== null && projectedMonth <= g.deadline),
      achieved,
    };
  });
}
