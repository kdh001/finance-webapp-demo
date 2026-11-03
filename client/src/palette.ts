/**
 * 차트 카테고리 팔레트 — dataviz 검증 스크립트 통과본 (라이트 #ffffff / 다크 #1d232d).
 * 슬롯 순서는 CVD(색각이상) 인접쌍 분리를 위해 고정 — 재배열·순환 금지.
 * 라이트 모드 aqua/yellow/magenta는 3:1 미만 → 직접 라벨/테이블 뷰로 릴리프 (도넛 직접 라벨, 전 화면 표 제공).
 */
export const SERIES_LIGHT = [
  "#2a78d6", // 1 blue
  "#1baf7a", // 2 aqua
  "#eda100", // 3 yellow
  "#008300", // 4 green
  "#4a3aa7", // 5 violet
  "#e34948", // 6 red
  "#e87ba4", // 7 magenta
  "#eb6834", // 8 orange
] as const;

export const SERIES_DARK = [
  "#3987e5",
  "#199e70",
  "#c98500",
  "#008300",
  "#9085e9",
  "#e66767",
  "#d55181",
  "#d95926",
] as const;

/** 카테고리 → 슬롯: 색은 엔티티(카테고리)를 따라 고정, 순위·필터와 무관 */
const SLOT: Record<string, number> = {
  교통: 0,
  "주거/통신": 1,
  "카페/간식": 2,
  "문화/여가": 3,
  구독: 4,
  "의료/건강": 5,
  쇼핑: 6,
  식비: 7,
};

/** 차트에 개별 슬라이스로 표시되는 8개 소비 카테고리. 나머지는 "그 외"(중립 회색)로 폴딩 */
export const CHART_CATEGORIES = Object.keys(SLOT);

export const OTHER_COLOR = { light: "#8a8a85", dark: "#9099a8" };

export function seriesPalette(theme: "light" | "dark") {
  return theme === "dark" ? SERIES_DARK : SERIES_LIGHT;
}

export function categoryColor(category: string, theme: "light" | "dark"): string {
  const idx = SLOT[category];
  if (idx === undefined) return OTHER_COLOR[theme];
  return seriesPalette(theme)[idx];
}

/** 수입/지출 2계열 (막대): blue / orange — 강한 CVD 분리쌍 */
export function incomeExpenseColors(theme: "light" | "dark") {
  const p = seriesPalette(theme);
  return { income: p[0], expense: p[7] };
}

/** 고정/변동 2계열 (스택): violet / aqua */
export function fixedVariableColors(theme: "light" | "dark") {
  const p = seriesPalette(theme);
  return { fixed: p[4], variable: p[1] };
}

export function chartInk(theme: "light" | "dark") {
  return theme === "dark"
    ? { grid: "#2c3442", text: "#9aa4b5", surface: "#1d232d" }
    : { grid: "#e6e8ee", text: "#5b6474", surface: "#ffffff" };
}
