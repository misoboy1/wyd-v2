// 요청별 언어 — accept-language로 정하고 응답 시점에 메시지 키를 번역(G-07 원문은 shared ko 사전)
import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { enumLabel, issueMsg, resolveLocale, translateDynamic, type EnumGroup, type Locale } from "@wyd/shared";

/** 메시지 파라미터. 함수면 응답 언어로 그때 계산(표 이름·사유 라벨·zod 이슈 목록 등 번역이 필요한 값) */
export type MsgParam = string | number | null | undefined | ((l: Locale) => string);
export type MsgParams = Record<string, MsgParam>;

export function localeOf(req: { headers?: Record<string, unknown> } | undefined): Locale {
  const h = req?.headers?.["accept-language"];
  return resolveLocale(typeof h === "string" ? h : undefined);
}

/** @Lang() — 요청 언어 */
export const Lang = createParamDecorator((_: unknown, ctx: ExecutionContext) => localeOf(ctx.switchToHttp().getRequest()));

export function resolveParams(locale: Locale, params?: MsgParams): Record<string, string | number | null> | undefined {
  if (!params) return undefined;
  const o: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(params)) o[k] = typeof v === "function" ? v(locale) : (v ?? null);
  return o;
}
export function renderMsg(locale: Locale, key: string, params?: MsgParams): string {
  return translateDynamic(locale, key, resolveParams(locale, params));
}

/** 번역 키를 파라미터로(예: 표 이름) */
export const tr =
  (key: string, params?: MsgParams) =>
  (l: Locale): string =>
    renderMsg(l, key, params);
/** 저장값(한국어) → 표시 라벨 */
export const enumP =
  (group: EnumGroup, value: string | null | undefined) =>
  (l: Locale): string =>
    enumLabel(l, group, value);

/** zod 이슈 목록 → "경로 메시지, …" (언어별) */
export const issuesP =
  (issues: readonly (Parameters<typeof issueMsg>[0] & { path: PropertyKey[] })[]) =>
  (l: Locale): string =>
    issues
      .map((i) => {
        const m = issueMsg(i);
        const path = i.path.map(String).join(".");
        const msg = translateDynamic(l, m.key, m.params);
        return path ? `${path}: ${msg}` : msg;
      })
      .join(", ");
