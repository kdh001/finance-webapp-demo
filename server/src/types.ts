export const CATEGORIES = [
  "식비",
  "카페/간식",
  "교통",
  "쇼핑",
  "구독",
  "주거/통신",
  "의료/건강",
  "문화/여가",
  "교육",
  "경조사/이체",
  "금융",
  "수입",
  "기타",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // 원 단위 정수. 지출 음수 / 수입 양수
  merchant: string;
  category: Category;
  categorySource: "rule" | "override" | "uncategorized";
  isFixed: boolean;
  sourceFile: string;
}

export interface Account {
  name: string;
  bank: string;
  type: "checking" | "savings" | "investment" | string;
  balance: number;
  rate?: number;
}

export interface Debt {
  name: string;
  principal: number;
  rate: number;
}

export interface Goal {
  name: string;
  target: number;
  saved?: number;
  deadline: string; // YYYY-MM
}

export interface Profile {
  monthlyIncome: number;
  payday: number;
  age: number;
  riskProfile: "안정형" | "중립형" | "공격형" | string;
  emergencyFundMonths: number;
  debts: Debt[];
  goals: Goal[];
}

/** 재무 집계의 타입. 이 데모에는 외부 AI 전송 기능이 없다. */
export interface AggregatedSummary {
  period: { from: string; to: string };
  monthlyIncome: number;
  monthly: Array<{
    month: string;
    income: number;
    totalExpense: number;
    savingsRate: number;
    byCategory: Partial<Record<Category, number>>;
  }>;
  fixedExpenses: Array<{ label: Category; monthlyAmount: number }>;
  subscriptions: { count: number; monthlyTotal: number };
  emergencyFund: { currentMonths: number; monthlyLivingCost: number };
  debts: Debt[];
  riskProfile: string;
  age: number;
  goals: Array<{ name: string; target: number; saved: number; deadline: string }>;
  ratio503020: { needs: number; wants: number; savings: number };
}
