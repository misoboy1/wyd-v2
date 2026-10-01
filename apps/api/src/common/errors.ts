import { ArgumentsHost, Catch, HttpException, HttpStatus, type ExceptionFilter } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { DEFAULT_LOCALE, type Locale } from "@wyd/shared";
import { localeOf, renderMsg, resolveParams, tr, type MsgParams } from "./i18n.js";

/**
 * 프론트가 code로 분기하는 표준 오류. body: { error: code, message, msgKey, params?, detail? }
 * message는 응답 시점에 요청 언어(accept-language)로 번역(ApiErrorFilter). msgKey는 shared err.* 키
 */
export class ApiError extends HttpException {
  constructor(
    public code: string,
    public msgKey: string,
    status: number,
    public detail?: unknown,
    public params?: MsgParams,
  ) {
    // 필터를 거치지 않는 경로 대비 기본(ko) 본문
    super({ error: code, message: renderMsg(DEFAULT_LOCALE, msgKey, params), msgKey, detail }, status);
  }
  render(locale: Locale): string {
    return renderMsg(locale, this.msgKey, this.params);
  }
  body(locale: Locale) {
    return {
      error: this.code,
      message: this.render(locale),
      msgKey: this.msgKey,
      params: resolveParams(locale, this.params),
      detail: this.detail,
    };
  }
}

/** ApiError만 번역해 응답. 다른 HttpException은 Nest 기본 처리 그대로 */
@Catch(ApiError)
export class ApiErrorFilter implements ExceptionFilter {
  catch(e: ApiError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    void reply.status(e.getStatus()).send(e.body(localeOf(ctx.getRequest())));
  }
}

export const Conflict = (current: unknown) => new ApiError("CONFLICT", "err.conflict", HttpStatus.CONFLICT, { current });
/** what: 대상 이름 키(err.what.* / err.table.*) */
export const NotFound = (what = "err.what.item") =>
  new ApiError("NOTFOUND", "err.notFound", HttpStatus.NOT_FOUND, undefined, { what: tr(what) });
export const Forbidden = (key = "err.forbidden", params?: MsgParams) =>
  new ApiError("FORBIDDEN", key, HttpStatus.FORBIDDEN, undefined, params);
export const Unauthorized = (key = "err.unauthorized") => new ApiError("UNAUTHORIZED", key, HttpStatus.UNAUTHORIZED);
export const Invalid = (key: string, detail?: unknown, params?: MsgParams) =>
  new ApiError("VALIDATION", key, HttpStatus.BAD_REQUEST, detail, params);
export const StayError = (key: string, params?: MsgParams, detail?: unknown) =>
  new ApiError("STAY", key, HttpStatus.UNPROCESSABLE_ENTITY, detail, params);
export const Capacity = (key: string, params?: MsgParams) =>
  new ApiError("CAPACITY", key, HttpStatus.UNPROCESSABLE_ENTITY, undefined, params);
export const Duplicate = (key: string) => new ApiError("DUPLICATE", key, HttpStatus.CONFLICT);

/** Postgres 고유 제약 위반 → DUPLICATE */
export function mapDbError(e: unknown): unknown {
  const err = e as { code?: string; constraint_name?: string; constraint?: string };
  if (err && err.code === "23505") {
    const c = err.constraint_name || err.constraint || "";
    const key = c.includes("facilities_name")
      ? "facilityName"
      : c.includes("hid")
        ? "hid"
        : c.includes("pid")
          ? "pid"
          : c.includes("departments_name")
            ? "deptName"
            : c.includes("username")
              ? "username"
              : "other";
    return Duplicate(`err.dup.${key}`);
  }
  return e;
}
