// 알 수 없는 값(JSON·DB 행·엑셀 셀) → 문자열. 객체는 "[object Object]" 대신 JSON으로
export function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  if (v instanceof Date) return v.toISOString();
  try {
    return JSON.stringify(v) ?? "";
  } catch {
    return "";
  }
}
