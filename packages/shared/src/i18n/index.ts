// 다국어 — 언어별 사전(messages/<언어>/*.ts). ko(원본·폴백)만 정적으로 싣고 다른 언어는 loadLocale()로 받는다
// (웹은 언어마다 별도 청크, API는 기동 시 loadAllLocales())
import { DEFAULT_LOCALE, LOCALES, format, type Locale, type Params } from "./core.js";
import { dict as ko, type Dict } from "./messages/ko/index.js";
import { nav as NAV_EN } from "./messages/en/nav.js";

export * from "./core.js";

const MESSAGES: Partial<Record<Locale, Dict>> = { ko };
const LOADERS: Record<Exclude<Locale, "ko">, () => Promise<{ dict: Dict }>> = {
  en: () => import("./messages/en/index.js"),
  es: () => import("./messages/es/index.js"),
  pt: () => import("./messages/pt/index.js"),
  fr: () => import("./messages/fr/index.js"),
};
const loading = new Map<Locale, Promise<void>>();

/** 사전을 이미 받은 언어인지 */
export const hasLocale = (l: Locale) => MESSAGES[l] !== undefined;
/** 언어 사전 받기(같은 언어 중복 요청은 한 번만). 실패하면 다음 호출에서 다시 시도 */
export function loadLocale(l: Locale): Promise<void> {
  if (l === "ko" || hasLocale(l)) return Promise.resolve();
  let p = loading.get(l);
  if (!p) {
    p = LOADERS[l]().then(
      (m) => {
        MESSAGES[l] = m.dict;
      },
      (e: unknown) => {
        loading.delete(l);
        throw e;
      },
    );
    loading.set(l, p);
  }
  return p;
}
export const loadAllLocales = () => Promise.all(LOCALES.map(loadLocale)).then(() => undefined);

type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
/** "common.save" 같은 메시지 키(ko 사전 기준) */
export type MsgKey = Paths<Dict>;
export type EnumGroup = keyof Dict["enums"];

export function translate(locale: Locale, key: MsgKey, params?: Params): string {
  return format(MESSAGES, locale, key, params);
}
/** 타입 검사 없이 동적 키로 번역(서버에서 받은 msgKey 등). 없으면 key 그대로 */
export function translateDynamic(locale: Locale, key: string, params?: Params): string {
  return format(MESSAGES, locale, key, params);
}
/** 메뉴 라벨 키(nav.*) */
export type NavKey = Extract<MsgKey, `nav.${string}`>;
/** 메뉴 라벨의 영어 표기(영어 부제목·명령 팔레트 영어 검색) — 영어 사전 전체를 받지 않고 메뉴 라벨만 정적으로 싣는다 */
export function navLabelEn(key: NavKey): string {
  return format({ en: { nav: NAV_EN } }, "en", key);
}
/** 저장값 → 표시 라벨. 사전에 없는 값(자유 입력 등)은 원문 그대로 */
export function enumLabel(locale: Locale, group: EnumGroup, value: string | null | undefined): string {
  if (!value) return "";
  const g = (MESSAGES[locale]?.enums as any)?.[group] ?? (ko.enums as any)[group];
  return (g && typeof g[value] === "string" && g[value]) || value;
}
/** 메시지가 있는지(동적 키 폴백 판단용) */
export function hasMessage(key: string): boolean {
  return format(MESSAGES, DEFAULT_LOCALE, key) !== key;
}
