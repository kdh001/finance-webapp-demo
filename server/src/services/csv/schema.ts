/**
 * CSV·정규화 거래 스키마 정본.
 * convert_banksalad.py / bankFormats / parser 가 공유하는 컬럼 계약을 한곳에 둔다.
 */

/** 헤더 비교용 — 공백 제거·trim (bankFormats.norm 과 동일 규칙) */
export const norm = (s: string) => s.replace(/\s+/g, "").trim();

/** 파서가 보장하는 정규화 거래 필드 (카테고리 부여 전) */
export const NORMALIZED_TX_FIELDS = ["id", "date", "amount", "merchant", "sourceFile"] as const;
export type NormalizedTxField = (typeof NORMALIZED_TX_FIELDS)[number];

/**
 * 뱅크샐러드 정제 CSV 정본 헤더.
 * 정규화된 CSV의 헤더 순서와 이름을 정의한다.
 */
export const BANKSALAD_CSV_HEADERS = [
  "날짜",
  "내용",
  "금액",
  "뱅샐타입",
  "뱅샐대분류",
  "뱅샐소분류",
] as const;

/** 뱅크샐러드 포맷 자동인식에 필요한 최소 시그니처 (힌트 컬럼까지 포함) */
export const BANKSALAD_SIGNATURE = ["날짜", "내용", "금액", "뱅샐타입"] as const;

/** 힌트 없는 부호형 금액 CSV (수동 정제용 최소 스키마) */
export const SIGNED_AMOUNT_CSV_HEADERS = ["날짜", "내용", "금액"] as const;

/**
 * 헤더 셀이 뱅크샐러드 정제 CSV인지 판별한다.
 * 공백 정규화 후 정본 헤더가 모두 포함되면 true (순서·추가 컬럼은 허용).
 */
export function isBanksaladHeader(headerCells: string[]): boolean {
  // Set으로 O(1) 조회 — 헤더 행이 짧아도 시그니처 비교 패턴을 통일한다.
  const cells = new Set(headerCells.map(norm));
  return BANKSALAD_CSV_HEADERS.every((h) => cells.has(norm(h)));
}

/**
 * 정규화 거래 객체가 스키마 필드를 갖는지 얕게 검증한다.
 * 런타임 가드용 — 실패 시 누락 필드명 배열을 돌려준다.
 */
export function missingNormalizedFields(tx: Record<string, unknown>): string[] {
  return NORMALIZED_TX_FIELDS.filter((f) => tx[f] === undefined || tx[f] === null || tx[f] === "");
}
