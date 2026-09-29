// 연락처·주소 가림 (권한 없는 열람자용) — 기존 Code.gs maskTel/maskAddr 기준
export const MASK = "••••";
export function maskTel(v: unknown): string {
  const s = String(v ?? "");
  if (!s) return s;
  const d = s.replace(/\D/g, "");
  return d.length >= 4 ? `${MASK}-${d.slice(-4)}` : MASK;
}
export function maskAddr(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return s;
  const t = s.split(/\s+/);
  return t.slice(0, Math.min(2, t.length)).join(" ") + " " + MASK;
}
export function maskRow<T extends Record<string, unknown>>(row: T, fields: Partial<Record<keyof T, (v: unknown) => string>>): T {
  const o: Record<string, unknown> = { ...row };
  for (const [k, fn] of Object.entries(fields)) if (fn && k in o) o[k] = fn(o[k]);
  return o as T;
}
