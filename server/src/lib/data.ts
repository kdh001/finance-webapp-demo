import fs from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, mergeTransactions, type SavedMappings, type RawTransaction } from "../services/csv/parser.js";
import { categorizeAll, type Overrides } from "../services/categorize.js";
import type { Account, Category, Profile, Transaction } from "../types.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const DATA_DIR = path.join(ROOT, "data");
export const SAMPLE_DIR = path.join(DATA_DIR, "sample");

const OVERRIDES_PATH = path.join(DATA_DIR, "overrides.json");
const MAPPINGS_PATH = path.join(DATA_DIR, "mappings.json");

/**
 * 실데이터가 있어도 샘플만 쓰고 싶을 때 (데모·회귀·스크린샷).
 * .env: FINANCE_USE_SAMPLE=1
 */
export function useSampleForced(): boolean {
  const v = (process.env.FINANCE_USE_SAMPLE ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function readJson<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(p: string, value: unknown): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value, null, 2), "utf8");
}

/** 실데이터가 없으면 리소스 단위로 data/sample/ 폴백 (FR-1.4). FINANCE_USE_SAMPLE 시 강제 샘플. */
function resolveResource(rel: string): { path: string; sample: boolean } {
  if (useSampleForced()) return { path: path.join(SAMPLE_DIR, rel), sample: true };
  const real = path.join(DATA_DIR, rel);
  if (fs.existsSync(real)) return { path: real, sample: false };
  return { path: path.join(SAMPLE_DIR, rel), sample: true };
}

export function getAccounts(): { accounts: Account[]; sample: boolean } {
  const r = resolveResource("accounts.json");
  return { accounts: readJson<Account[]>(r.path, []), sample: r.sample };
}

export function getProfile(): { profile: Profile; sample: boolean } {
  const r = resolveResource("profile.json");
  const profile = readJson<Profile>(r.path, {
    monthlyIncome: 0,
    payday: 25,
    age: 30,
    riskProfile: "중립형",
    emergencyFundMonths: 0,
    debts: [],
    goals: [],
  });
  return { profile, sample: r.sample };
}

export function saveProfile(profile: Profile): void {
  writeJson(path.join(DATA_DIR, "profile.json"), profile);
}

export function getOverrides(): Overrides {
  return readJson<Overrides>(OVERRIDES_PATH, { merchants: {} });
}

export function saveOverride(merchant: string, category: Category): void {
  const overrides = getOverrides();
  overrides.merchants[merchant.trim()] = category;
  writeJson(OVERRIDES_PATH, overrides);
}

export function getMappings(): SavedMappings {
  return readJson<SavedMappings>(MAPPINGS_PATH, {});
}

export function saveMapping(headerKey: string, map: SavedMappings[string]): void {
  const mappings = getMappings();
  mappings[headerKey] = map;
  writeJson(MAPPINGS_PATH, mappings);
}

/**
 * 거래 CSV 디렉터리 선택.
 * 우선순위: FINANCE_USE_SAMPLE → data/transactions/*.csv 존재 → data/sample/transactions
 */
export function transactionsDir(): { dir: string; sample: boolean } {
  if (useSampleForced()) {
    return { dir: path.join(SAMPLE_DIR, "transactions"), sample: true };
  }
  const real = path.join(DATA_DIR, "transactions");
  const hasCsv =
    fs.existsSync(real) && fs.readdirSync(real).some((f) => f.toLowerCase().endsWith(".csv"));
  if (hasCsv) return { dir: real, sample: false };
  return { dir: path.join(SAMPLE_DIR, "transactions"), sample: true };
}

export function saveUploadedCsv(_filename: string, buf: Buffer): string {
  const dir = path.join(DATA_DIR, "transactions");
  fs.mkdirSync(dir, { recursive: true });
  // 입력 파일명과 무관한 이름을 사용하고 기존 파일을 덮어쓰지 않는다.
  const name = `upload-${randomUUID()}.csv`;
  fs.writeFileSync(path.join(dir, name), buf, { flag: "wx" });
  return name;
}

// ---------- 거래 로드 (mtime 기반 캐시) ----------

interface TxCache {
  key: string;
  transactions: Transaction[];
  skippedFiles: Array<{ file: string; headerKey: string; header: string[] }>;
}
let cache: TxCache | null = null;

function cacheKey(dir: string): string {
  const files = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith(".csv"))
        .map((f) => `${f}:${fs.statSync(path.join(dir, f)).mtimeMs}`)
    : [];
  const ovMtime = fs.existsSync(OVERRIDES_PATH) ? fs.statSync(OVERRIDES_PATH).mtimeMs : 0;
  const mapMtime = fs.existsSync(MAPPINGS_PATH) ? fs.statSync(MAPPINGS_PATH).mtimeMs : 0;
  return `${dir}|${files.join(",")}|ov:${ovMtime}|map:${mapMtime}`;
}

export function loadTransactions(): {
  transactions: Transaction[];
  sample: boolean;
  skippedFiles: TxCache["skippedFiles"];
} {
  const { dir, sample } = transactionsDir();
  const key = cacheKey(dir);
  if (cache && cache.key === key) {
    return { transactions: cache.transactions, sample, skippedFiles: cache.skippedFiles };
  }

  const mappings = getMappings();
  const lists: RawTransaction[][] = [];
  const skippedFiles: TxCache["skippedFiles"] = [];

  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".csv"))) {
      const buf = fs.readFileSync(path.join(dir, file));
      try {
        const result = parseCsv(buf, file, mappings);
        if (result.ok) lists.push(result.transactions);
        else skippedFiles.push({ file, headerKey: result.headerKey, header: result.header });
      } catch {
        skippedFiles.push({ file, headerKey: "", header: [] });
      }
    }
  }

  const transactions = categorizeAll(mergeTransactions(lists), getOverrides());
  cache = { key, transactions, skippedFiles };
  return { transactions, sample, skippedFiles };
}

export function invalidateCache(): void {
  cache = null;
}
