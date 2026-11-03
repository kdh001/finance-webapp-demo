
import express from "express";
import { coreRouter } from "./routes/core.js";
import { analysisRouter } from "./routes/analysis.js";
import multer from "multer";
import { CsvInputError } from "./services/csv/parser.js";

const app = express();
// DNS 재바인딩과 다른 웹사이트의 요청을 차단한다. 명령행 로컬 요청은 허용한다.
app.use((req, res, next) => {
  const host = req.get("host") ?? "";
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host)) return res.status(403).json({ error: "로컬 주소만 허용됩니다." });
  const origin = req.get("origin");
  if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):5173$/i.test(origin)) return res.status(403).json({ error: "허용되지 않은 출처입니다." });
  if (req.get("sec-fetch-site") === "cross-site") return res.status(403).json({ error: "교차 사이트 요청은 허용되지 않습니다." });
  next();
});
app.use(express.json({ limit: "2mb" }));

app.use("/api", coreRouter);
app.use("/api", analysisRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "업로드 제한을 초과했거나 형식이 올바르지 않습니다." });
  if (err instanceof CsvInputError) return res.status(400).json({ error: err.message });
  if ((err as Error & { status?: number }).status === 400) return res.status(400).json({ error: "요청 형식이 올바르지 않습니다." });
  if ((err as Error & { status?: number }).status === 413) return res.status(413).json({ error: "요청 크기가 너무 큽니다." });
  console.error(err.message);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

const PORT = Number(process.env.PORT || 3001);
// 보안: 로컬 전용 — 외부 인터페이스 바인딩 금지 (SEC-6)
app.listen(PORT, "127.0.0.1", () => {
  console.log(`[server] http://127.0.0.1:${PORT}`);
});
