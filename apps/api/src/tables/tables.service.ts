// 공용 CRUD — 낙관적 잠금(version) · 행 잠금(FOR UPDATE) · 배정 재검사 · 감사 로그 · 변경 알림
import { Injectable } from "@nestjs/common";
import { asc, eq, inArray, sql, getTableColumns } from "drizzle-orm";
import { DEFAULT_LOCALE, TABLE_NAMES, issueMsg, type Locale, type TableName } from "@wyd/shared";
import { db, type Tx } from "../db/client.js";
import * as S from "../db/schema.js";
import { REGISTRY, canWrite, type TableDef } from "./registry.js";
import type { AuthUser } from "../common/auth-user.js";
import { ApiError, Conflict, Forbidden, Invalid, NotFound, Unauthorized, mapDbError } from "../common/errors.js";
import { maskRow } from "../common/mask.js";
import { issuesP, tr } from "../common/i18n.js";
import { checkHostPolicy, checkVisitorStay } from "../visitors/stay.js";
import { EventsService } from "../events/events.service.js";

type Row = Record<string, any>;
const INTERNAL = new Set(["createdAt", "updatedBy"]);
export const BULK_MAX = 200;

export function isTable(name: string): name is TableName {
  return (TABLE_NAMES as string[]).includes(name);
}

function out(r: Row): Row {
  const o: Row = {};
  for (const [k, v] of Object.entries(r)) if (!INTERNAL.has(k)) o[k] = v;
  return o;
}
function pickSchemaKeys(def: TableDef, r: Row): Row {
  const o: Row = {};
  for (const k of Object.keys(def.schema.shape)) if (r[k] !== undefined) o[k] = r[k];
  return o;
}
function parse(def: TableDef, input: Row): Row {
  const r = def.schema.safeParse(input);
  if (!r.success) {
    const issues = r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message, ...issueMsg(i) }));
    throw Invalid("err.invalidInput", issues, { table: tr(def.label), issues: issuesP(r.error.issues) });
  }
  return r.data;
}
function diff(a: Row, b: Row): Row | null {
  const d: Row = {};
  for (const k of Object.keys(b)) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) d[k] = { from: a[k], to: b[k] };
  return Object.keys(d).length ? d : null;
}
const pad3 = (n: number) => String(n).padStart(3, "0");

export interface WriteResult {
  ok: boolean;
  row?: Row;
  error?: string;
  code?: string;
  msgKey?: string;
  detail?: unknown;
}

@Injectable()
export class TablesService {
  constructor(readonly events: EventsService) {}

  // ── 읽기 ──────────────────────────────────────────────────────
  async list(name: TableName, user?: AuthUser): Promise<Row[]> {
    const def = REGISTRY[name];
    if (def.read === "auth" && !user) throw Unauthorized();
    const cols = getTableColumns(def.table as any) as Row;
    const order = def.order.map((k) => asc(cols[k]));
    let rows = (await db
      .select()
      .from(def.table as any)
      .orderBy(...order)) as Row[];
    if (name === "schedule") rows = await this.attachSlots(rows);
    const scope = user && def.scope?.(user);
    if (scope) rows = rows.filter(scope);
    if (!user && def.publicMask) rows = rows.map((r) => maskRow(r, def.publicMask!));
    return rows.map(out);
  }

  /** 한 번에 여러 표(초기 로딩). 권한 없는 표는 생략 */
  async dataset(names: TableName[], user?: AuthUser) {
    const allowed = names.filter((n) => REGISTRY[n].read !== "auth" || user);
    const lists = await Promise.all(allowed.map((n) => this.list(n, user)));
    // 요청 순서대로 담음 — 끝난 순서대로 담으면 내용이 같아도 응답이 달라져 ETag(304)가 무력화됨
    const res: Record<string, Row[]> = {};
    allowed.forEach((n, i) => (res[n] = lists[i]));
    return res;
  }

  private async attachSlots(days: Row[], tx: Tx | typeof db = db) {
    if (!days.length) return days;
    const slots = await tx
      .select()
      .from(S.scheduleSlots)
      .where(
        inArray(
          S.scheduleSlots.scheduleId,
          days.map((d) => d.id),
        ),
      )
      .orderBy(asc(S.scheduleSlots.sort), asc(S.scheduleSlots.id));
    const by = new Map<number, Row[]>();
    for (const s of slots) {
      const a = by.get(s.scheduleId) || [];
      a.push({ id: s.id, time: s.time, text: s.text, who: s.who, sort: s.sort });
      by.set(s.scheduleId, a);
    }
    return days.map((d) => ({ ...d, slots: by.get(d.id) || [] }));
  }

  // ── 쓰기 ──────────────────────────────────────────────────────
  async create(name: TableName, input: Row, user?: AuthUser) {
    const row = await this.tx((tx) => this.createIn(tx, name, input, user));
    this.events.emit([name], user?.id);
    return row;
  }
  async update(name: TableName, id: number, patch: Row, user?: AuthUser) {
    const row = await this.tx((tx) => this.updateIn(tx, name, id, patch, user));
    this.events.emit([name], user?.id);
    return row;
  }
  async remove(name: TableName, id: number, version: number | undefined, user?: AuthUser) {
    const r = await this.tx((tx) => this.removeIn(tx, name, id, version, user));
    // 가정·시설 삭제 → 배정 해제된 방문자, 글 삭제 → 함께 지워진 댓글(cascade)도 새로고침
    const also: TableName[] = r.cleared ? ["visitors"] : name === "posts" ? ["postComments"] : [];
    this.events.emit([name, ...also], user?.id);
    return r;
  }

  /** 일괄 저장(엑셀 붙여넣기·자동 배정 등). 행마다 SAVEPOINT — 실패한 행만 되돌리고 나머지는 저장 */
  async bulk(name: TableName, rows: Row[], user?: AuthUser, locale: Locale = DEFAULT_LOCALE): Promise<WriteResult[]> {
    if (!Array.isArray(rows)) throw Invalid("err.rowsRequired");
    if (rows.length > BULK_MAX) throw Invalid("err.bulkMax", undefined, { max: BULK_MAX });
    // 결과 배열은 트랜잭션 콜백 안에서 만든다 — 교착으로 tx()가 재시도하면 이전 시도의 결과를 버려야 함
    const results = await this.tx(async (tx) => {
      const acc: WriteResult[] = [];
      // 교착 방지: 수정 대상 행을 id 순으로 먼저 잠금
      const def = REGISTRY[name];
      const ids = rows
        .map((r) => Number(r.id))
        .filter((n) => n > 0)
        .sort((a, b) => a - b);
      if (ids.length)
        await tx
          .select({ id: (def.table as any).id })
          .from(def.table as any)
          .where(inArray((def.table as any).id, ids))
          .orderBy(asc((def.table as any).id))
          .for("update");
      if (name === "visitors") {
        // 배정 대상 숙소도 id 순으로 먼저 잠금(동시 일괄 배정 간 교착 방지)
        const fids = [...new Set(rows.map((r) => Number(r.facilityId)).filter((n) => n > 0))].sort((a, b) => a - b);
        const hids = [...new Set(rows.map((r) => Number(r.homestayId)).filter((n) => n > 0))].sort((a, b) => a - b);
        if (fids.length)
          await tx
            .select({ id: S.facilities.id })
            .from(S.facilities)
            .where(inArray(S.facilities.id, fids))
            .orderBy(asc(S.facilities.id))
            .for("update");
        if (hids.length)
          await tx
            .select({ id: S.homestays.id })
            .from(S.homestays)
            .where(inArray(S.homestays.id, hids))
            .orderBy(asc(S.homestays.id))
            .for("update");
      }
      for (const r of rows) {
        try {
          const row = await tx.transaction(async (sp) =>
            r.id ? this.updateIn(sp, name, Number(r.id), r, user) : this.createIn(sp, name, r, user),
          );
          acc.push({ ok: true, row });
        } catch (e) {
          const err = mapDbError(e);
          if (err instanceof ApiError)
            acc.push({ ok: false, code: err.code, error: err.render(locale), msgKey: err.msgKey, detail: err.detail });
          else throw err;
        }
      }
      return acc;
    });
    if (results.some((r) => r.ok)) this.events.emit([name], user?.id);
    return results;
  }

  /** 트랜잭션 + 교착(40P01)·직렬화 실패(40001) 시 최대 3회 재시도 */
  async tx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await db.transaction(fn);
      } catch (e) {
        const code = (e as { code?: string })?.code;
        if ((code === "40P01" || code === "40001") && attempt < 3) {
          await new Promise((r) => setTimeout(r, 30 * attempt + Math.random() * 50));
          continue;
        }
        throw mapDbError(e);
      }
    }
  }

  async createIn(tx: Tx, name: TableName, input: Row, user?: AuthUser, opts: { skipAuth?: boolean } = {}): Promise<Row> {
    const def = REGISTRY[name];
    const data = parse(def, pickSchemaKeys(def, input));
    if (!opts.skipAuth && !canWrite(def, user, null, data)) throw Forbidden("err.forbiddenCreate", { table: tr(def.label) });
    const { slots, ...values } = data;
    if (name === "visitors") {
      values.pid = await this.ensureCode(tx, "visitors", values.pid);
      if (values.facilityId != null || values.homestayId != null) values.orphanStay = "";
      await checkVisitorStay(tx, null, values as any);
    }
    if (name === "homestays") values.hid = await this.ensureCode(tx, "homestays", values.hid);
    if (name === "posts" || name === "postComments") {
      values.authorId = user?.id ?? null;
      if (!values.author) values.author = user?.name || "";
    }
    if (name === "postComments") {
      // 댓글 작성자 이름은 로그인 계정으로 고정(게시글과 달리 직접 입력 없음 — 이름 사칭 방지)
      values.author = user?.name || "";
      // 없는 글에 단 댓글은 FK 오류(500) 대신 404로. key share 잠금: 확인 직후 글이 삭제되는 경쟁 방지
      const [post] = await tx.select({ id: S.posts.id }).from(S.posts).where(eq(S.posts.id, values.postId)).for("key share").limit(1);
      if (!post) throw NotFound("err.table.posts");
    }
    const [row] = (await tx
      .insert(def.table as any)
      .values({ ...values, updatedBy: user?.id ?? null })
      .returning()) as Row[];
    if (name === "schedule") await this.replaceSlots(tx, row.id, slots || []);
    await this.audit(tx, user, name, row.id, "create", null, values);
    return out(name === "schedule" ? (await this.attachSlots([row], tx))[0] : row);
  }

  async updateIn(tx: Tx, name: TableName, id: number, patch: Row, user?: AuthUser): Promise<Row> {
    const def = REGISTRY[name];
    const T = def.table as any;
    if (!Number.isInteger(id) || id <= 0) throw Invalid("err.badId");
    const [cur] = (await tx.select().from(T).where(eq(T.id, id)).for("update")) as Row[];
    this.assertRowAccess(def, user, cur, "err.forbiddenUpdate");
    if (patch.version == null) throw Invalid("err.versionRequired");
    if (Number(patch.version) !== cur.version) {
      throw Conflict(out(name === "schedule" ? (await this.attachSlots([cur], tx))[0] : cur));
    }
    const curSlots = name === "schedule" ? (await this.attachSlots([cur], tx))[0].slots : undefined;
    const merged = parse(def, { ...pickSchemaKeys(def, { ...cur, slots: curSlots }), ...pickSchemaKeys(def, patch) });
    // 댓글은 다른 글로 옮기거나 작성자 이름을 바꿀 수 없음
    if (name === "postComments") Object.assign(merged, { postId: cur.postId, author: cur.author });
    if (!canWrite(def, user, cur, merged)) throw Forbidden("err.forbiddenUpdate", { table: tr(def.label) });
    const { slots, ...values } = merged;
    if (name === "visitors") {
      if (values.facilityId != null || values.homestayId != null) values.orphanStay = "";
      await checkVisitorStay(tx, cur as any, { ...values, id } as any);
    }
    if (name === "facilities" || name === "homestays") await checkHostPolicy(tx, name, { ...values, id });
    const [row] = (await tx
      .update(T)
      .set({ ...values, version: sql`${T.version} + 1`, updatedAt: new Date(), updatedBy: user?.id ?? null })
      .where(eq(T.id, id))
      .returning()) as Row[];
    if (name === "schedule") await this.replaceSlots(tx, id, slots || []);
    const d = diff(pickSchemaKeys(def, cur), values);
    if (d || name === "schedule") await this.audit(tx, user, name, id, "update", null, d);
    return out(name === "schedule" ? (await this.attachSlots([row], tx))[0] : row);
  }

  /**
   * 행을 보여 주기 전(Conflict 응답은 행 전체를 담음) 접근 확인.
   * 읽기 범위 밖이면 존재 자체를 숨기고(NOTFOUND), 쓰기 권한이 없으면 FORBIDDEN.
   */
  private assertRowAccess(def: TableDef, user: AuthUser | undefined, cur: Row | undefined, forbiddenKey: string): asserts cur is Row {
    if (!cur) throw NotFound(def.label);
    const scope = user && def.scope?.(user);
    if (scope && !scope(cur)) throw NotFound(def.label);
    if (!canWrite(def, user, cur, cur)) throw Forbidden(forbiddenKey, { table: tr(def.label) });
  }

  async removeIn(tx: Tx, name: TableName, id: number, version: number | undefined, user?: AuthUser) {
    const def = REGISTRY[name];
    const T = def.table as any;
    const [cur] = (await tx.select().from(T).where(eq(T.id, id)).for("update")) as Row[];
    this.assertRowAccess(def, user, cur, "err.forbiddenDelete");
    if (version != null && Number(version) !== cur.version) throw Conflict(out(cur));
    if (!canWrite(def, user, cur, null)) throw Forbidden("err.forbiddenDelete", { table: tr(def.label) });
    // 가정·시설 삭제 → 배정 방문자는 FK(ON DELETE SET NULL)로 자동 미배정. 몇 명인지 응답에 포함
    let cleared: number[] = [];
    if (name === "facilities" || name === "homestays") {
      const col = name === "facilities" ? S.visitors.facilityId : S.visitors.homestayId;
      cleared = (await tx.select({ id: S.visitors.id }).from(S.visitors).where(eq(col, id))).map((r) => r.id);
      if (cleared.length)
        await tx
          .update(S.visitors)
          .set({ version: sql`${S.visitors.version} + 1`, updatedAt: new Date(), updatedBy: user?.id ?? null })
          .where(inArray(S.visitors.id, cleared));
    }
    await tx.delete(T).where(eq(T.id, id));
    await this.audit(tx, user, name, id, "delete", out(cur), cleared.length ? { clearedVisitors: cleared } : null);
    return { ok: true, id, cleared: cleared.length, clearedIds: cleared };
  }

  private async replaceSlots(tx: Tx, scheduleId: number, slots: Row[]) {
    await tx.delete(S.scheduleSlots).where(eq(S.scheduleSlots.scheduleId, scheduleId));
    if (slots.length)
      await tx
        .insert(S.scheduleSlots)
        .values(slots.map((s, i) => ({ scheduleId, time: s.time, text: s.text, who: s.who, sort: s.sort ?? i })));
  }

  /** P/H 번호: 비었거나 이미 쓰는 번호면 시퀀스로 새 번호 발급(삭제된 번호 재사용 없음) */
  private async ensureCode(tx: Tx, table: "visitors" | "homestays", code: string): Promise<string> {
    const T = table === "visitors" ? S.visitors : S.homestays;
    const col = table === "visitors" ? S.visitors.pid : S.homestays.hid;
    const prefix = table === "visitors" ? "P" : "H";
    const seq = table === "visitors" ? "visitor_pid_seq" : "homestay_hid_seq";
    const exists = async (c: string) => (await tx.select({ id: T.id }).from(T).where(eq(col, c)).limit(1)).length > 0;
    const c = String(code || "").trim();
    if (c && !(await exists(c))) return c;
    for (let i = 0; i < 1000; i++) {
      const [{ n }] = (await tx.execute(sql`select nextval(${seq}::regclass)::int as n`)) as unknown as { n: number }[];
      const cand = prefix + pad3(n);
      if (!(await exists(cand))) return cand;
    }
    throw Invalid("err.codeIssueFailed");
  }

  async audit(tx: Tx, user: AuthUser | undefined, table: string, rowId: number | null, action: string, before: unknown, after: unknown) {
    await tx.insert(S.auditLog).values({ userId: user?.id ?? null, tableName: table, rowId, action, before: before, after: after });
  }
}
