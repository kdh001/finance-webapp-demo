import jschardet from "jschardet";
import iconv from "iconv-lite";

/** 한국 은행 CSV용 인코딩 자동 감지 디코더 (UTF-8 BOM / UTF-8 / EUC-KR·CP949) */
export function decodeBuffer(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString("utf8");
  }
  const detected = (jschardet.detect(buf).encoding || "").toLowerCase();
  if (/euc-kr|949|iso-8859/.test(detected)) {
    return iconv.decode(buf, "cp949");
  }
  if (/utf-16/.test(detected)) {
    return iconv.decode(buf, detected);
  }
  const utf8 = buf.toString("utf8");
  // UTF-8 디코딩 실패 문자가 있으면 한국 은행 CSV의 대부분인 CP949로 재시도
  if (utf8.includes("�")) {
    return iconv.decode(buf, "cp949");
  }
  return utf8;
}
