export const CATEGORIES = [
  "식비", "카페/간식", "교통", "쇼핑", "구독", "주거/통신",
  "의료/건강", "문화/여가", "교육", "경조사/이체", "금융", "수입", "기타",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  merchant: string;
  category: Category;
  categorySource: "rule" | "override" | "uncategorized";
  isFixed: boolean;
  sourceFile: string;
}

export interface Account {
  name: string;
  bank: string;
  type: string;
  balance: number;
  rate?: number;
}

export interface Goal {
  name: string;
  target: number;
  saved?: number;
  deadline: string;
}

export interface Profile {
  monthlyIncome: number;
  payday: number;
  age: number;
  riskProfile: string;
  emergencyFundMonths: number;
  debts: Array<{ name: string; principal: number; rate: number }>;
  goals: Goal[];
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `요청 실패 (${res.status})`);
  return res.json();
}

export async function apiSend<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `요청 실패 (${res.status})`);
  return res.json();
}

/** SSE 스트림 (POST) — event: delta/done/error 프로토콜 파싱 */
export async function streamSse(
  path: string,
  body: unknown,
  handlers: { onDelta: (text: string) => void; onError?: (code: string, message: string) => void },
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal,
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? `요청 실패 (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const raw of events) {
      let event = "message";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
      }
      const data = dataLines.join("\n");
      if (event === "delta") handlers.onDelta(JSON.parse(data));
      else if (event === "error") {
        const { code, message } = JSON.parse(data);
        handlers.onError?.(code, message);
      }
    }
  }
}
