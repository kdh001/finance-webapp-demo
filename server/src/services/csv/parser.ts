import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { decodeBuffer } from "./encoding.js";
import { matchFormat, norm, type ColumnMap } from "./bankFormats.js";
import type { Transaction } from "../../types.js";

export interface RawTransaction extends Omit<Transaction, "category" | "categorySource" | "isFixed"> {}

export interface ParseSuccess {
  ok: true;
  formatId: string;
  formatLabel: string;
  transactions: RawTransaction[];
}
export interface ParseNeedsMapping {
  ok: false;
  /** 매핑 UI에 보여줄 헤더 후보 */
  header: string[];
  headerKey: string;
}
export type ParseResult = ParseSuccess | ParseNeedsMapping;

// 데모에서 한 파일이 차지할 수 있는 파싱 자원을 제한한다.
export const MAX_CSV_ROWS = 10000;
export class CsvInputError extends Error {}

/** 저장된 사용자 정의 매핑: headerKey → ColumnMap */
export type SavedMappings = Record<string, ColumnMap>;

export function headerKeyOf(cells: string[]): string {
  return cells.map(norm).filter(Boolean).join("|");
}

function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d\-.]/g, "");
  if (!cleaned || cleaned === "-") return null;
  const n = Math.round(Number(cleaned));
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})[.\-/]?\s?(\d{1,2})[.\-/]?\s?(\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y), month = Number(mo), day = Number(d);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function txId(date: string, amount: number, merchant: string, seq: number): string {
  return createHash("sha1").update(`${date}|${amount}|${merchant}|${seq}`).digest("hex").slice(0, 12);
}

/**
 * CSV Buffer → 정규화 거래 목록.
 * 1) 인코딩 감지 → 2) 헤더 행 탐색(상단 안내문 스킵) → 3) 포맷 시그니처/저장 매핑 매칭 → 4) 정규화
 */
export function parseCsv(buf: Buffer, sourceFile: string, savedMappings: SavedMappings = {}): ParseResult {
  const text = decodeBuffer(buf);
  let rows: string[][];
  try {
    rows = parse(text, {
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
      max_record_size: 16384,
    });
  } catch {
    throw new CsvInputError("CSV 형식이 올바르지 않거나 한 행이 너무 깁니다.");
  }
  if (!rows.length) throw new CsvInputError("빈 CSV 파일입니다.");
  if (rows.length > MAX_CSV_ROWS + 1) throw new CsvInputError("CSV는 헤더 외 최대 10,000행까지 허용됩니다.");
  if (rows.some((row) => row.length > 100)) throw new CsvInputError("CSV는 최대 100개 열까지 허용됩니다.");

  // 헤더 행 탐색: 첫 20행 중 포맷 시그니처 또는 저장 매핑에 매칭되는 행
  let headerIdx = -1;
  let map: ColumnMap | undefined;
  let formatId = "custom";
  let formatLabel = "사용자 매핑";
  const scanLimit = Math.min(rows.length, 20);
  for (let i = 0; i < scanLimit; i++) {
    const fmt = matchFormat(rows[i]);
    if (fmt) {
      headerIdx = i;
      map = fmt.map;
      formatId = fmt.id;
      formatLabel = fmt.label;
      break;
    }
    const key = headerKeyOf(rows[i]);
    const saved = Object.hasOwn(savedMappings, key) ? savedMappings[key] : undefined;
    if (saved) {
      headerIdx = i;
      map = saved;
      break;
    }
  }

  if (headerIdx === -1 || !map) {
    // 매핑 UI용 헤더 후보: 첫 5행 중 셀 수가 가장 많은 행
    const candidate = rows
      .slice(0, 5)
      .reduce((best, row) => (row.filter(Boolean).length > best.filter(Boolean).length ? row : best), rows[0]);
    return { ok: false, header: candidate, headerKey: headerKeyOf(candidate) };
  }

  const header = rows[headerIdx].map(norm);
  const col = (name: string) => header.indexOf(norm(name));
  const dateIdx = col(map.date);
  const merchantIdxs = map.merchant.map(col).filter((i) => i >= 0);
  const amountIdx = map.amount ? col(map.amount) : -1;
  const withdrawalIdx = map.withdrawal ? col(map.withdrawal) : -1;
  const depositIdx = map.deposit ? col(map.deposit) : -1;

  const transactions: RawTransaction[] = [];
  const seqByKey = new Map<string, number>();

  for (const row of rows.slice(headerIdx + 1)) {
    const date = parseDate(row[dateIdx]);
    if (!date) continue;

    let amount: number | null = null;
    if (amountIdx >= 0) {
      amount = parseAmount(row[amountIdx]);
      if (amount !== null && map.expenseIsPositive) amount = -Math.abs(amount);
    } else {
      const w = withdrawalIdx >= 0 ? parseAmount(row[withdrawalIdx]) : null;
      const d = depositIdx >= 0 ? parseAmount(row[depositIdx]) : null;
      if (w) amount = -Math.abs(w);
      else if (d) amount = Math.abs(d);
    }
    if (amount === null || amount === 0) continue;

    const merchant =
      merchantIdxs.map((i) => (row[i] ?? "").trim()).find((v) => v.length > 0) ?? "(내역 없음)";

    const key = `${date}|${amount}|${merchant}`;
    const seq = (seqByKey.get(key) ?? 0) + 1;
    seqByKey.set(key, seq);

    transactions.push({ id: txId(date, amount, merchant, seq), date, amount, merchant, sourceFile });
  }

  return { ok: true, formatId, formatLabel, transactions };
}

/**
 * 여러 파일의 거래 병합 + 중복 제거.
 * 동일 (date|amount|merchant|seq) 키가 서로 다른 파일에 있으면 한 건만 유지
 * (같은 기간을 두 번 다운로드한 경우 대비). 같은 파일 내 중복은 seq로 구분되어 유지.
 */
export function mergeTransactions(lists: RawTransaction[][]): RawTransaction[] {
  const byId = new Map<string, RawTransaction>();
  for (const list of lists) {
    for (const tx of list) {
      if (!byId.has(tx.id)) byId.set(tx.id, tx);
    }
  }
  return [...byId.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
