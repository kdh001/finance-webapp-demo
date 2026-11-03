import { useState } from "react";

export interface PendingMapping {
  tempId: string;
  headerKey: string;
  header: string[];
  filename: string;
}

export interface MappingBody {
  date: string;
  merchant: string[];
  amount?: string;
  withdrawal?: string;
  deposit?: string;
  expenseIsPositive?: boolean;
}

/** 미인식 CSV 컬럼 매핑 (FR-6.4) — 날짜/가맹점/금액 컬럼을 사용자가 지정 */
export default function ColumnMappingModal({
  pending,
  onSubmit,
  onClose,
  submitting,
  error,
}: {
  pending: PendingMapping;
  onSubmit: (map: MappingBody) => void;
  onClose: () => void;
  submitting: boolean;
  error?: string;
}) {
  const cols = pending.header;
  const [date, setDate] = useState("");
  const [merchant, setMerchant] = useState("");
  const [mode, setMode] = useState<"signed" | "split">("signed");
  const [amount, setAmount] = useState("");
  const [expenseIsPositive, setExpenseIsPositive] = useState(false);
  const [withdrawal, setWithdrawal] = useState("");
  const [deposit, setDeposit] = useState("");

  const valid =
    date && merchant && (mode === "signed" ? amount : withdrawal || deposit);

  const submit = () => {
    if (!valid) return;
    onSubmit(
      mode === "signed"
        ? { date, merchant: [merchant], amount, expenseIsPositive }
        : { date, merchant: [merchant], withdrawal: withdrawal || undefined, deposit: deposit || undefined },
    );
  };

  const ColSelect = ({ value, onChange, allowEmpty }: { value: string; onChange: (v: string) => void; allowEmpty?: boolean }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allowEmpty ? "(없음)" : "컬럼 선택"}</option>
      {cols.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>CSV 컬럼 매핑 — {pending.filename}</h3>
        <p style={{ color: "var(--text-sub)", fontSize: 13 }}>
          이 파일의 포맷을 자동으로 인식하지 못했습니다. 각 항목에 해당하는 컬럼을 지정해주세요.
          지정한 매핑은 저장되어 같은 포맷의 파일에 재사용됩니다.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "10px 12px", alignItems: "center" }}>
          <label>날짜 컬럼</label>
          <ColSelect value={date} onChange={setDate} />
          <label>가맹점/적요</label>
          <ColSelect value={merchant} onChange={setMerchant} />
          <label>금액 형식</label>
          <div className="row">
            <label style={{ fontWeight: 400 }}>
              <input type="radio" checked={mode === "signed"} onChange={() => setMode("signed")} /> 금액 컬럼 하나
            </label>
            <label style={{ fontWeight: 400 }}>
              <input type="radio" checked={mode === "split"} onChange={() => setMode("split")} /> 출금/입금 분리
            </label>
          </div>
          {mode === "signed" ? (
            <>
              <label>금액 컬럼</label>
              <div className="row">
                <ColSelect value={amount} onChange={setAmount} />
                <label style={{ fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={expenseIsPositive}
                    onChange={(e) => setExpenseIsPositive(e.target.checked)}
                  />{" "}
                  지출이 양수로 기록됨
                </label>
              </div>
            </>
          ) : (
            <>
              <label>출금 컬럼</label>
              <ColSelect value={withdrawal} onChange={setWithdrawal} allowEmpty />
              <label>입금 컬럼</label>
              <ColSelect value={deposit} onChange={setDeposit} allowEmpty />
            </>
          )}
        </div>

        {error && <p style={{ color: "var(--negative)", fontSize: 13 }}>{error}</p>}

        <div className="row" style={{ marginTop: 18, justifyContent: "flex-end" }}>
          <button className="btn secondary" onClick={onClose}>취소</button>
          <button className="btn" disabled={!valid || submitting} onClick={submit}>
            {submitting ? "파싱 중…" : "매핑 저장 후 가져오기"}
          </button>
        </div>
      </div>
    </div>
  );
}
