/** 은행/카드사 CSV 포맷 시그니처 정의 및 매칭 (FR-6.3) */
import { BANKSALAD_SIGNATURE, SIGNED_AMOUNT_CSV_HEADERS, norm } from "./schema.js";

export interface ColumnMap {
  /** 날짜 컬럼명 */
  date: string;
  /** 가맹점/적요 후보 컬럼명 (앞에서부터 값이 있는 첫 컬럼 사용) */
  merchant: string[];
  /** 부호 있는 단일 금액 컬럼 (토스/카카오뱅크 등) */
  amount?: string;
  /** 출금/입금 분리형 (국민/신한/우리/하나 등) */
  withdrawal?: string;
  deposit?: string;
  /** 카드사: 양수 금액이 지출을 의미 → 음수로 변환 */
  expenseIsPositive?: boolean;
}

export interface BankFormat {
  id: string;
  label: string;
  /** 헤더에 모두 존재해야 하는 컬럼명 (공백 제거 후 비교) */
  signature: string[];
  map: ColumnMap;
}

/** 헤더 정규화 — schema.norm 재노출 (기존 import 경로 호환) */
export { norm };

/**
 * 포맷 목록 — 더 구체적인 시그니처를 앞에 둔다.
 * (예: 뱅크샐러드는 날짜/내용/금액 + 뱅샐타입. 힌트 없는 부호형 CSV는 그 다음)
 */
export const BANK_FORMATS: BankFormat[] = [
  {
    id: "kb_bank",
    label: "KB국민은행",
    signature: ["거래일자", "출금액", "입금액"],
    map: { date: "거래일자", merchant: ["내용", "적요", "보낸분/받는분"], withdrawal: "출금액", deposit: "입금액" },
  },
  {
    id: "shinhan_bank",
    label: "신한은행",
    signature: ["거래일자", "출금(원)", "입금(원)"],
    map: { date: "거래일자", merchant: ["내용", "적요"], withdrawal: "출금(원)", deposit: "입금(원)" },
  },
  {
    id: "woori_bank",
    label: "우리은행",
    signature: ["거래일시", "지급(원)", "입금(원)"],
    map: { date: "거래일시", merchant: ["기재내용", "내용"], withdrawal: "지급(원)", deposit: "입금(원)" },
  },
  {
    id: "hana_bank",
    label: "하나은행",
    signature: ["거래일시", "출금액", "입금액"],
    map: { date: "거래일시", merchant: ["적요", "내용"], withdrawal: "출금액", deposit: "입금액" },
  },
  {
    id: "kakao_bank",
    label: "카카오뱅크",
    signature: ["거래일시", "구분", "거래금액"],
    map: { date: "거래일시", merchant: ["내용", "구분"], amount: "거래금액" },
  },
  {
    id: "toss_bank",
    label: "토스뱅크",
    signature: ["거래일시", "적요", "거래금액"],
    map: { date: "거래일시", merchant: ["적요"], amount: "거래금액" },
  },
  {
    id: "shinhan_card",
    label: "신한카드",
    signature: ["이용일자", "이용가맹점", "이용금액"],
    map: { date: "이용일자", merchant: ["이용가맹점"], amount: "이용금액", expenseIsPositive: true },
  },
  {
    id: "samsung_card",
    label: "삼성카드",
    signature: ["승인일자", "가맹점명", "승인금액"],
    map: { date: "승인일자", merchant: ["가맹점명"], amount: "승인금액", expenseIsPositive: true },
  },
  {
    id: "hyundai_card",
    label: "현대카드",
    signature: ["이용일", "가맹점명", "이용금액"],
    map: { date: "이용일", merchant: ["가맹점명"], amount: "이용금액", expenseIsPositive: true },
  },
  {
    id: "kb_card",
    label: "KB국민카드",
    signature: ["이용일", "이용하신곳", "이용금액"],
    map: { date: "이용일", merchant: ["이용하신곳"], amount: "이용금액", expenseIsPositive: true },
  },
  {
    id: "banksalad",
    label: "뱅크샐러드(정제)",
    // 표준화된 CSV 헤더 — schema.ts BANKSALAD_* 와 동기화
    signature: [...BANKSALAD_SIGNATURE],
    map: { date: "날짜", merchant: ["내용"], amount: "금액" },
  },
  {
    id: "signed_amount_kr",
    label: "부호형 금액(날짜/내용/금액)",
    // 힌트 컬럼 없는 최소 스키마 — 금액은 이미 지출 음수/수입 양수
    signature: [...SIGNED_AMOUNT_CSV_HEADERS],
    map: { date: "날짜", merchant: ["내용"], amount: "금액" },
  },
];

export function matchFormat(headerCells: string[]): BankFormat | undefined {
  const cells = new Set(headerCells.map(norm));
  return BANK_FORMATS.find((f) => f.signature.every((sig) => cells.has(norm(sig))));
}
