// 테이블 레지스트리 — 테이블별 스키마·읽기/쓰기 권한·가림 규칙을 한 곳에서 정의
import type { PgTable } from "drizzle-orm/pg-core";
import { schemas, teamInfo, VOLUNTEER_VIEW_ROLES, type TableName } from "@wyd/shared";
import type { z } from "zod";
import * as S from "../db/schema.js";
import type { AuthUser } from "../common/auth-user.js";
import { maskTel } from "../common/mask.js";

type Row = Record<string, unknown>;
export interface TableDef {
  table: PgTable & { id: any; version: any };
  schema: z.ZodObject<any>;
  /** public: 비로그인 열람 가능 / auth: 로그인 필요 */
  read: "public" | "auth";
  /** 비로그인 열람 시 가릴 필드 */
  publicMask?: Record<string, (v: unknown) => string>;
  /** 행 단위 쓰기 권한(관리자는 항상 허용). before=기존 행(생성 시 null), after=저장될 행(삭제 시 null) */
  canWrite?: (u: AuthUser, before: Row | null, after: Row | null) => boolean;
  /** 읽기 범위 제한(host 등) */
  scope?: (u: AuthUser) => ((r: Row) => boolean) | null;
  /** 정렬 기본값 */
  order: string[];
  /** 표 이름 메시지 키(err.table.*) — 오류 메시지에 번역해 넣음 */
  label: string;
}

const sameTeam = (u: AuthUser, r: Row | null) => !r || (!!u.team && teamInfo(r as any).team === teamInfo({ team: u.team }).team);

export const REGISTRY: Record<TableName, TableDef> = {
  facilities: { table: S.facilities, schema: schemas.facilities, read: "auth", order: ["rno", "id"], label: "err.table.facilities" },
  homestays: {
    table: S.homestays,
    schema: schemas.homestays,
    read: "auth",
    order: ["hid"],
    label: "err.table.homestays",
    scope: (u) => (u.role === "host" ? (r) => r.id === u.homestayId : null),
  },
  visitors: {
    table: S.visitors,
    schema: schemas.visitors,
    read: "auth",
    order: ["pid"],
    label: "err.table.visitors",
    scope: (u) => (u.role === "host" ? (r) => u.homestayId != null && r.homestayId === u.homestayId : null),
  },
  departments: { table: S.departments, schema: schemas.departments, read: "public", order: ["sort", "id"], label: "err.table.departments" },
  volunteers: {
    table: S.volunteers,
    schema: schemas.volunteers,
    read: "auth",
    order: ["team", "id"],
    label: "err.table.volunteers",
    // 분과 책임자: 자기 팀 봉사자만 추가·수정·삭제(다른 팀으로 옮기기 불가)
    canWrite: (u, b, a) => u.role === "dept" && sameTeam(u, b) && sameTeam(u, a),
    // 홈스테이 가정 계정은 봉사자 명단(연락처 포함)을 받지 않음 — 화면에서 숨기는 것만으로는 보호가 안 됨(SEC-01)
    scope: (u) => (VOLUNTEER_VIEW_ROLES.includes(u.role) ? null : () => false),
  },
  officers: {
    table: S.officers,
    schema: schemas.officers,
    read: "public",
    publicMask: { tel: maskTel },
    order: ["sort", "id"],
    label: "err.table.officers",
  },
  schedule: { table: S.schedule, schema: schemas.schedule, read: "public", order: ["sort", "id"], label: "err.table.schedule" },
  prep: { table: S.prep, schema: schemas.prep, read: "public", order: ["sort", "id"], label: "err.table.prep" },
  notices: { table: S.notices, schema: schemas.notices, read: "public", order: ["date", "id"], label: "err.table.notices" },
  posts: {
    table: S.posts,
    schema: schemas.posts,
    read: "auth",
    order: ["date", "id"],
    label: "err.table.posts",
    // 로그인 사용자는 글쓰기, 수정·삭제는 본인 글만
    canWrite: (u, b) => !b || b.authorId === u.id,
  },
  qna: { table: S.qna, schema: schemas.qna, read: "public", order: ["date", "id"], label: "err.table.qna" },
  places: { table: S.places, schema: schemas.places, read: "public", order: ["sort", "id"], label: "err.table.places" },
  gori: { table: S.gori, schema: schemas.gori, read: "public", order: ["date"], label: "err.table.gori" },
};

export function canWrite(def: TableDef, u: AuthUser | undefined, before: Row | null, after: Row | null): boolean {
  if (!u) return false;
  if (u.role === "admin") return true;
  return def.canWrite ? def.canWrite(u, before, after) : false;
}
