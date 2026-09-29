import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const num = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("ko-KR"));
const KO = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });
/** 한국어 + 숫자 자연 정렬 (P9 < P10 < P1000) */
export const cmp = (a: unknown, b: unknown) => KO.compare(String(a ?? ""), String(b ?? ""));
/** 띄어쓰기로 여러 조건(AND) 검색 */
export function matchQuery(q: string, ...fields: unknown[]): boolean {
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = fields.map((f) => String(f ?? "")).join(" ").toLowerCase();
  return terms.every((t) => hay.includes(t));
}
export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10));
  const b = Date.UTC(+toISO.slice(0, 4), +toISO.slice(5, 7) - 1, +toISO.slice(8, 10));
  return Math.round((b - a) / 86400000);
}
export const telHref = (tel: string) => "tel:" + String(tel || "").replace(/[^\d+]/g, "");
export const isBrokenTel = (tel: string) => /#ERROR|#NAME|#VALUE/i.test(String(tel || ""));
