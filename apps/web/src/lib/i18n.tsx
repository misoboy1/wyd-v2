// 다국어 — 현재 언어는 모듈 상태(localStorage "wyd-lang")로 두고, 컴포넌트는 useT()로 구독한다.
// React 밖(토스트·api.ts·CSV 등)에서는 getLocale()/tt()를 쓴다. ko 외 언어 사전은 고를 때 따로 받는다.
import { useSyncExternalStore } from "react";
import {
  enumLabel,
  fmtDate,
  fmtNum,
  fmtWeekday,
  isLocale,
  loadLocale,
  resolveLocale,
  translate,
  translateDynamic,
  type EnumGroup,
  type Locale,
  type MsgKey,
  type Params,
} from "@wyd/shared";

const KEY = "wyd-lang";
function initial(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* 무시 */
  }
  return resolveLocale(typeof navigator !== "undefined" ? navigator.languages?.join(",") || navigator.language : "");
}

let current: Locale = initial();
const listeners = new Set<() => void>();
document.documentElement.lang = current;

/** 첫 화면 전 저장된 언어 사전 받기(main.tsx가 기다림). 실패하면 이번 접속은 ko로(저장값은 그대로 — 다음 접속에 다시 시도) */
export const i18nReady: Promise<void> = loadLocale(current).catch(() => {
  current = "ko";
  document.documentElement.lang = current;
});

export const getLocale = () => current;
let pending: Locale | undefined;
/** 사전을 받은 뒤 전환. 받는 중 다른 언어를 고르면 마지막 선택만 반영. 사전을 받지 못하면 현재 언어 유지하고 false */
export async function setLocale(l: Locale): Promise<boolean> {
  pending = l;
  try {
    await loadLocale(l);
  } catch {
    if (pending !== l) return true; // 이미 다른 언어를 고름 — 밀려난 요청의 실패는 알리지 않음
    pending = undefined;
    return false;
  }
  if (pending !== l) return true;
  pending = undefined;
  if (l === current) return true;
  current = l;
  document.documentElement.lang = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* 무시 */
  }
  listeners.forEach((fn) => fn());
  return true;
}
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** React 밖에서 쓰는 번역(현재 언어) */
export const tt = (key: MsgKey, params?: Params) => translate(current, key, params);

function makeApi(locale: Locale) {
  return {
    locale,
    setLocale,
    t: (key: MsgKey, params?: Params) => translate(locale, key, params),
    /** 서버 msgKey 등 동적 키 */
    td: (key: string, params?: Params) => translateDynamic(locale, key, params),
    /** DB 저장값(한국어) → 표시 라벨 */
    label: (group: EnumGroup, value: string | null | undefined) => enumLabel(locale, group, value),
    num: (n: number | null | undefined) => (n == null ? "—" : fmtNum(locale, Number(n))),
    date: (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) => fmtDate(locale, d, opts),
    weekday: (day: number, width?: "short" | "narrow" | "long") => fmtWeekday(locale, day, width),
  };
}
// 언어별로 같은 객체를 돌려줘 t·label 등을 훅 의존성 배열에 그대로 넣을 수 있게 함
const apis = new Map<Locale, ReturnType<typeof makeApi>>();

/** 컴포넌트용: 언어가 바뀌면 다시 렌더링된다. 반환 함수는 언어가 같으면 항상 같은 참조 */
export function useT() {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
  let api = apis.get(locale);
  if (!api) apis.set(locale, (api = makeApi(locale)));
  return api;
}
export type T = ReturnType<typeof useT>["t"];
