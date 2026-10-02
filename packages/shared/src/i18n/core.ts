// 다국어 코어 — 의존성 없음. 웹·API 공용(G-03)
export const LOCALES = ["ko", "en", "es", "pt", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ko";
/** 언어 선택 메뉴 표기(각 언어 고유 이름) */
export const LOCALE_NAMES: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  es: "Español",
  pt: "Português",
  fr: "Français",
};
/** Intl 서식용 BCP 47 태그 */
export const INTL_TAG: Record<Locale, string> = { ko: "ko-KR", en: "en-US", es: "es-ES", pt: "pt-BR", fr: "fr-FR" };

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** "en-US,en;q=0.9,ko;q=0.8" 또는 "pt-BR" → 지원 언어 중 첫 일치. 없으면 ko */
export function resolveLocale(accept?: string | null): Locale {
  if (!accept) return DEFAULT_LOCALE;
  const tags = accept
    .split(",")
    .map((p) => {
      const [tag, q] = p.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) || 0 : 1 };
    })
    .filter((x) => x.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** 원본(ko) 사전과 같은 모양 — 다른 언어 사전은 `satisfies Shape<typeof ko>`(키 누락은 컴파일 오류). 복수형 변형 키(`x_one` 등)는 추가로 둘 수 있다 */
export type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> } & { [extra: string]: unknown };

export type Params = Record<string, string | number | null | undefined>;

function lookup(dict: unknown, key: string): string | undefined {
  let cur: any = dict;
  for (const part of key.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

const pluralCache = new Map<Locale, Intl.PluralRules>();
function pluralOf(locale: Locale, n: number): string {
  let pr = pluralCache.get(locale);
  if (!pr) pluralCache.set(locale, (pr = new Intl.PluralRules(INTL_TAG[locale])));
  return pr.select(n);
}

/** {name} 보간. params.n이 숫자면 `key_one`/`key_other` 등 복수형 변형을 우선 사용. 아직 없는(받지 않은) 언어는 ko로 */
export function format(dicts: Partial<Record<Locale, unknown>>, locale: Locale, key: string, params?: Params): string {
  const dict = dicts[locale] ?? dicts[DEFAULT_LOCALE];
  let s: string | undefined;
  if (params && typeof params.n === "number") s = lookup(dict, `${key}_${pluralOf(locale, params.n)}`);
  s ??= lookup(dict, key) ?? lookup(dicts[DEFAULT_LOCALE], key);
  if (s === undefined) return key; // 사전에 없는 문자열(이미 번역된 서버 문구 등)은 그대로
  return s.replace(/\{(\w+)\}/g, (_m, name: string) => {
    const v = params?.[name];
    if (v == null) return "";
    return typeof v === "number" ? v.toLocaleString(INTL_TAG[locale]) : String(v);
  });
}

// ── 서식 ──
export const fmtNum = (locale: Locale, n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "" : n.toLocaleString(INTL_TAG[locale]);
export function fmtDate(locale: Locale, d: Date | string | number, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat(INTL_TAG[locale], { timeZone: "Asia/Seoul", ...opts }).format(dt);
}
/** 0=일요일. 짧은 요일명(일/Sun/dom.) */
export function fmtWeekday(locale: Locale, day: number, width: "short" | "narrow" | "long" = "short") {
  // 2023-01-01은 일요일
  return new Intl.DateTimeFormat(INTL_TAG[locale], { weekday: width, timeZone: "UTC" }).format(new Date(Date.UTC(2023, 0, 1 + day)));
}
