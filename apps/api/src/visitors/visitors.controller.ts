import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { and, isNotNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { TablesService } from "../tables/tables.service.js";
import { RequireLogin, CurrentUser } from "../auth/roles.decorator.js";
import type { AuthUser } from "../common/auth-user.js";
import { Invalid } from "../common/errors.js";
import { facilities, visitors } from "../db/schema.js";
import { EventsService } from "../events/events.service.js";

const assignSchema = z.object({
  changes: z.array(z.object({
    id: z.number().int().positive(), version: z.number().int(),
    facilityId: z.number().int().positive().nullable(), homestayId: z.number().int().positive().nullable(),
  })).min(1).max(200),
});
const unassignSchema = z.object({ scope: z.enum(["orphan", "unconfirmed", "hs", "room", "all"]) });

@Controller("visitors")
@RequireLogin("admin")
export class VisitorsController {
  constructor(private readonly svc: TablesService, private readonly events: EventsService) {}

  /** 배정 일괄 적용(자동 배정·수동 일괄). 행마다 서버가 정원·성별·혼숙·기간을 재검사하고 결과를 돌려줌 */
  @Post("assign") @HttpCode(200)
  async assign(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    const p = assignSchema.safeParse(body);
    if (!p.success) throw Invalid("배정 요청 형식 오류");
    return { results: await this.svc.bulk("visitors", p.data.changes, user) };
  }

  /** 배정 일괄 해제 — 연결 끊김만 / 미확정 / 홈스테이 전체 / 교리실 전체 / 전체 */
  @Post("unassign") @HttpCode(200)
  async unassign(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    const p = unassignSchema.safeParse(body);
    if (!p.success) throw Invalid("scope 확인");
    const assigned = or(isNotNull(visitors.facilityId), isNotNull(visitors.homestayId), ne(visitors.orphanStay, ""));
    const sleepRooms = sql`(select id from ${facilities} where ${facilities.type} like '%숙박%')`;
    const where = {
      orphan: or(ne(visitors.orphanStay, ""), and(isNotNull(visitors.facilityId), sql`${visitors.facilityId} not in ${sleepRooms}`)),
      unconfirmed: and(assigned, ne(visitors.status, "확정")),
      hs: isNotNull(visitors.homestayId),
      room: isNotNull(visitors.facilityId),
      all: assigned,
    }[p.data.scope];
    const ids = await this.svc.tx(async (tx) => {
      const rows = await tx.update(visitors)
        .set({ facilityId: null, homestayId: null, orphanStay: "", version: sql`${visitors.version} + 1`, updatedAt: new Date(), updatedBy: user.id })
        .where(where).returning({ id: visitors.id });
      await this.svc.audit(tx, user, "visitors", null, "unassign", null, { scope: p.data.scope, ids: rows.map((r) => r.id) });
      return rows.map((r) => r.id);
    });
    if (ids.length) this.events.emit(["visitors"], user.id);
    return { cleared: ids.length };
  }
}
