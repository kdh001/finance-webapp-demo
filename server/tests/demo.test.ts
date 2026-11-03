import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CsvInputError, parseCsv } from "../src/services/csv/parser.js";
import { monthlySummaries } from "../src/services/insights.js";
import { categorizeAll } from "../src/services/categorize.js";

// 합성 CSV가 파싱부터 월별 집계까지 이어지는지 확인한다.
describe("합성 데모 데이터", () => {
  it("거래를 읽고 수입과 지출을 월별로 집계한다", () => {
    const csv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../data/sample/transactions/demo.csv");
    const result = parseCsv(fs.readFileSync(csv), "demo.csv");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transactions).toHaveLength(6);
    const transactions = categorizeAll(result.transactions, { merchants: {} });
    const months = monthlySummaries(transactions, 12);
    expect(months).toHaveLength(2);
    expect(months[0].income).toBe(2400000);
    expect(months[0].totalExpense).toBe(15000);
    expect(months[1].totalExpense).toBe(19000);
  });
});

// 잘못된 입력이 기존 거래나 매핑을 오염시키지 않는지 확인한다.
describe("CSV 입력 제한", () => {
  it("존재하지 않는 날짜는 거래에서 제외한다", () => {
    const result = parseCsv(Buffer.from("날짜,내용,금액\n2026-99-99,가상,-1\n"), "demo.csv");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.transactions).toHaveLength(0);
  });
  it("프로토타입 이름을 저장된 매핑으로 취급하지 않는다", () => {
    const result = parseCsv(Buffer.from("__proto__\nvalue\n"), "demo.csv");
    expect(result.ok).toBe(false);
  });
  it("허용 행 수를 초과하면 거부한다", () => {
    const content = "날짜,내용,금액\n" + "2026-01-01,가상,-1\n".repeat(10001);
    expect(() => parseCsv(Buffer.from(content), "demo.csv")).toThrow(CsvInputError);
  });
});
