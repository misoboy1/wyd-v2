// 다국어 — 네임스페이스별 사전(messages/*.ts)을 모아 언어별 사전을 만든다
import { DEFAULT_LOCALE, LOCALES, format, type Locale, type Params } from "./core.js";
import { common } from "./messages/common.js";
import { enums } from "./messages/enums.js";
import { nav } from "./messages/nav.js";
import { shell } from "./messages/shell.js";
import { dash } from "./messages/dash.js";
import { gori } from "./messages/gori.js";
import { stay } from "./messages/stay.js";
import { org } from "./messages/org.js";
import { board } from "./messages/board.js";
import { users } from "./messages/users.js";
import { err } from "./messages/err.js";
import { valid } from "./messages/valid.js";

export * from "./core.js";

const NS = { common, enums, nav, shell, dash, gori, stay, org, board, users, err, valid };
type Dict = { [K in keyof typeof NS]: (typeof NS)[K]["ko"] };

export const MESSAGES = Object.fromEntries(
  LOCALES.map((l) => [l, Object.fromEntries(Object.entries(NS).map(([k, v]) => [k, v[l]]))]),
) as Record<Locale, Dict>;

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
/** 저장값 → 표시 라벨. 사전에 없는 값(자유 입력 등)은 원문 그대로 */
export function enumLabel(locale: Locale, group: EnumGroup, value: string | null | undefined): string {
  if (!value) return "";
  const g = (MESSAGES[locale]?.enums as any)?.[group] ?? (MESSAGES[DEFAULT_LOCALE].enums as any)[group];
  return (g && typeof g[value] === "string" && g[value]) || value;
}
/** 메시지가 있는지(동적 키 폴백 판단용) */
export function hasMessage(key: string): boolean {
  return format(MESSAGES, DEFAULT_LOCALE, key) !== key;
}
