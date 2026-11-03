const krw = new Intl.NumberFormat("ko-KR");

export function formatKRW(n: number): string {
  return `${krw.format(Math.round(n))}원`;
}

/** 차트 축용 축약 표기 (120만, 1.2억) */
export function formatKRWShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1).replace(/\.0$/, "")}억`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000)}만`;
  return `${sign}${krw.format(abs)}`;
}

export function formatPercent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}년 ${Number(m)}월`;
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
