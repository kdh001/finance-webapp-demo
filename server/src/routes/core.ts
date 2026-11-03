import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  getAccounts,
  getProfile,
  loadTransactions,
  saveOverride,
  saveMapping,
  saveUploadedCsv,
  getMappings,
  invalidateCache,
  DATA_DIR,
} from "../lib/data.js";
import { parseCsv } from "../services/csv/parser.js";
import type { ColumnMap } from "../services/csv/bankFormats.js";
import { detectFixedMerchants } from "../services/insights.js";
import { CATEGORIES, type Category } from "../types.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024, files: 1, fields: 4 } });
const MAX_PENDING = 8;
const PENDING_TTL = 5 * 60 * 1000;
const MAX_FILES = 50;
function uploadsFull(): boolean {
  const dir = path.join(DATA_DIR, "transactions");
  return fs.existsSync(dir) && fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".csv")).length >= MAX_FILES;
}

/** 매핑 대기 중인 업로드 버퍼 (메모리 전용) */
const pendingUploads = new Map<string, { filename: string; buf: Buffer; header: string[]; headerKey: string; created: number }>();
function prunePending(): void {
  for (const [id, item] of pendingUploads) if (Date.now() - item.created > PENDING_TTL) pendingUploads.delete(id);
}

export const coreRouter = Router();

coreRouter.get("/health", (_req, res) => {
  const { sample } = loadTransactions();
  res.json({
    ok: true,
    aiEnabled: false,
    usingSample: sample,
  });
});

coreRouter.get("/accounts", (_req, res) => {
  const { accounts, sample } = getAccounts();
  const totalAssets = accounts.reduce((sum, a) => sum + a.balance, 0);
  res.json({ accounts, totalAssets, sample });
});

coreRouter.get("/profile", (_req, res) => {
  res.json(getProfile());
});

coreRouter.get("/categories", (_req, res) => {
  res.json(CATEGORIES);
});

coreRouter.get("/transactions", (req, res) => {
  const { transactions, sample, skippedFiles } = loadTransactions();
  const fixedSet = new Set(detectFixedMerchants(transactions).map((f) => f.merchant));
  const month = typeof req.query.month === "string" ? req.query.month : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  let list = transactions.map((t) => (fixedSet.has(t.merchant) ? { ...t, isFixed: true } : t));
  if (month) list = list.filter((t) => t.date.startsWith(month));
  if (category) list = list.filter((t) => t.category === category);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((t) => t.merchant.toLowerCase().includes(needle));
  }
  res.json({ transactions: list, total: list.length, sample, skippedFiles });
});

coreRouter.patch("/transactions/:id/category", (req, res) => {
  const category = req.body?.category as Category | undefined;
  if (!category || !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "유효하지 않은 카테고리입니다." });
  }
  const { transactions } = loadTransactions();
  const tx = transactions.find((t) => t.id === req.params.id);
  if (!tx) return res.status(404).json({ error: "거래를 찾을 수 없습니다." });
  // 가맹점 단위 학습 저장 → 동일 가맹점의 모든 거래에 적용 (FR-2.3)
  saveOverride(tx.merchant, category);
  invalidateCache();
  res.json({ ok: true, merchant: tx.merchant, category });
});

coreRouter.post("/transactions/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "파일이 없습니다." });
  if (!req.file.originalname.toLowerCase().endsWith(".csv")) return res.status(400).json({ error: "CSV 파일만 허용됩니다." });
  if (uploadsFull()) return res.status(429).json({ error: "업로드 파일은 최대 50개까지 보관합니다." });
  const result = parseCsv(req.file.buffer, req.file.originalname, getMappings());
  if (result.ok) {
    if (!result.transactions.length) return res.status(422).json({ error: "유효한 거래 행이 없습니다." });
    const saved = saveUploadedCsv(req.file.originalname, req.file.buffer);
    invalidateCache();
    return res.json({ ok: true, file: saved, format: result.formatLabel, count: result.transactions.length });
  }
  prunePending();
  if (pendingUploads.size >= MAX_PENDING) return res.status(429).json({ error: "매핑 대기 파일이 너무 많습니다. 잠시 후 다시 시도하세요." });
  const tempId = randomUUID();
  pendingUploads.set(tempId, { filename: req.file.originalname, buf: req.file.buffer, header: result.header, headerKey: result.headerKey, created: Date.now() });
  // 추가 요청이 없어도 대기 파일의 메모리를 정해진 시간 뒤 비운다.
  setTimeout(() => pendingUploads.delete(tempId), PENDING_TTL).unref();
  res.status(422).json({ ok: false, needsMapping: true, tempId, header: result.header, headerKey: result.headerKey });
});

coreRouter.post("/transactions/mapping", (req, res) => {
  prunePending();
  const { tempId, headerKey, map } = req.body ?? {};
  if (typeof tempId !== "string") return res.status(400).json({ error: "매핑 요청이 올바르지 않습니다." });
  const pending = pendingUploads.get(tempId);
  if (!pending) return res.status(404).json({ error: "업로드 세션이 만료되었습니다. 다시 업로드해주세요." });
  if (uploadsFull()) return res.status(429).json({ error: "업로드 파일은 최대 50개까지 보관합니다." });
  const hasCol = (v: unknown): v is string => typeof v === "string" && v.length > 0 && pending.header.includes(v);
  if (headerKey !== pending.headerKey || ["__proto__", "constructor", "prototype"].includes(headerKey) || !map || typeof map !== "object" ||
      !hasCol(map.date) || !Array.isArray(map.merchant) || map.merchant.length < 1 || map.merchant.length > 5 || !map.merchant.every(hasCol) ||
      !(hasCol(map.amount) || hasCol(map.withdrawal) || hasCol(map.deposit)) ||
      (map.amount !== undefined && !hasCol(map.amount)) || (map.withdrawal !== undefined && !hasCol(map.withdrawal)) || (map.deposit !== undefined && !hasCol(map.deposit)) ||
      (map.expenseIsPositive !== undefined && typeof map.expenseIsPositive !== "boolean")) {
    return res.status(400).json({ error: "매핑은 이 파일의 실제 컬럼을 사용해야 합니다." });
  }
  const clean: ColumnMap = { date: map.date, merchant: map.merchant, amount: map.amount, withdrawal: map.withdrawal, deposit: map.deposit, expenseIsPositive: map.expenseIsPositive };
  const result = parseCsv(pending.buf, pending.filename, { ...getMappings(), [headerKey]: clean });
  if (!result.ok || !result.transactions.length) return res.status(422).json({ error: "해당 매핑으로 유효한 거래를 읽지 못했습니다." });
  const saved = saveUploadedCsv(pending.filename, pending.buf);
  saveMapping(headerKey, clean);
  pendingUploads.delete(tempId);
  invalidateCache();
  res.json({ ok: true, file: saved, count: result.transactions.length });
});
