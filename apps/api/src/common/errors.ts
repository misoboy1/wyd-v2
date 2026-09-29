import { HttpException, HttpStatus } from "@nestjs/common";

/** 프론트가 code로 분기하는 표준 오류. body: { error: code, message, detail? } */
export class ApiError extends HttpException {
  constructor(
    public code: string,
    message: string,
    status: number,
    public detail?: unknown,
  ) {
    super({ error: code, message, detail }, status);
  }
}
export const Conflict = (current: unknown) =>
  new ApiError("CONFLICT", "다른 사용자가 먼저 수정했습니다. 최신 내용을 확인한 뒤 다시 저장하세요.", HttpStatus.CONFLICT, { current });
export const NotFound = (what = "항목") => new ApiError("NOTFOUND", `${what}을(를) 찾을 수 없습니다(이미 삭제됨).`, HttpStatus.NOT_FOUND);
export const Forbidden = (msg = "권한이 없습니다.") => new ApiError("FORBIDDEN", msg, HttpStatus.FORBIDDEN);
export const Unauthorized = (msg = "로그인이 필요합니다.") => new ApiError("UNAUTHORIZED", msg, HttpStatus.UNAUTHORIZED);
export const Invalid = (msg: string, detail?: unknown) => new ApiError("VALIDATION", msg, HttpStatus.BAD_REQUEST, detail);
export const StayError = (msg: string, detail?: unknown) => new ApiError("STAY", msg, HttpStatus.UNPROCESSABLE_ENTITY, detail);
export const Capacity = (msg: string) => new ApiError("CAPACITY", msg, HttpStatus.UNPROCESSABLE_ENTITY);
export const Duplicate = (msg: string) => new ApiError("DUPLICATE", msg, HttpStatus.CONFLICT);

/** Postgres 고유 제약 위반 → DUPLICATE */
export function mapDbError(e: unknown): unknown {
  const err = e as { code?: string; constraint_name?: string; constraint?: string };
  if (err && err.code === "23505") {
    const c = err.constraint_name || err.constraint || "";
    const what = c.includes("facilities_name")
      ? "같은 이름의 시설"
      : c.includes("hid")
        ? "같은 가정 번호(H)"
        : c.includes("pid")
          ? "같은 방문자 번호(P)"
          : c.includes("departments_name")
            ? "같은 이름의 분과·구역"
            : c.includes("username")
              ? "같은 로그인 아이디"
              : "중복 값";
    return Duplicate(`${what}이(가) 이미 있습니다.`);
  }
  return e;
}
