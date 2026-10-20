import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { linkIssueSchema, PERSON_KINDS, type PersonalLinkInfo, type PersonKind } from "@wyd/shared";
import { db } from "../db/client.js";
import { auditLog, personalLinks, visitors, volunteers } from "../db/schema.js";
import { Invalid, NotFound, mapDbError } from "../common/errors.js";
import type { AuthUser } from "../common/auth-user.js";
import { CurrentUser, RequireLogin } from "../auth/roles.decorator.js";
import { PushService } from "../push/push.service.js";
import { PersonService, hashToken, newToken } from "./person.service.js";

const isKind = (k: string): k is PersonKind => (PERSON_KINDS as readonly string[]).includes(k);

/** 개인 링크 발급·폐기(관리자). 토큰 원문은 발급 응답에만 — 다시 보려면 재발급 */
@Controller("links")
@RequireLogin("admin")
export class LinksController {
  constructor(
    private readonly persons: PersonService,
    private readonly push: PushService,
  ) {}

  @Get() async list(): Promise<PersonalLinkInfo[]> {
    const rows = await db
      .select({ kind: personalLinks.kind, refId: personalLinks.refId, createdAt: personalLinks.createdAt })
      .from(personalLinks)
      .where(isNull(personalLinks.revokedAt))
      .orderBy(desc(personalLinks.id));
    return rows.map((r) => ({ kind: r.kind as PersonKind, refId: r.refId, createdAt: r.createdAt.toISOString() }));
  }

  /** 발급(이미 있으면 재발급 — 이전 링크와 그 기기 알림은 끊김) */
  @Post() async issue(@Body() body: unknown, @CurrentUser() u: AuthUser) {
    const p = linkIssueSchema.safeParse(body);
    if (!p.success) throw Invalid("err.checkInput");
    const { kind } = p.data;
    const ids = [...new Set(p.data.ids)];
    const tb = kind === "visitor" ? visitors : volunteers;
    const found = await db.select({ id: tb.id }).from(tb).where(inArray(tb.id, ids));
    if (found.length !== ids.length) throw NotFound(kind === "visitor" ? "err.table.visitors" : "err.table.volunteers");
    const issued = ids.map((refId) => ({ refId, token: newToken() }));
    // 같은 사람을 동시에 발급하면 부분 고유 인덱스(personal_links_active_uq)에 걸림 → 409(err.dup.link)
    await db
      .transaction(async (tx) => {
        await tx
          .update(personalLinks)
          .set({ revokedAt: sql`now()` })
          .where(and(eq(personalLinks.kind, kind), inArray(personalLinks.refId, ids), isNull(personalLinks.revokedAt)));
        await tx
          .insert(personalLinks)
          .values(issued.map((x) => ({ kind, refId: x.refId, tokenHash: hashToken(x.token), createdBy: u.id })));
        // 감사 로그(보안 행위) — 토큰은 남기지 않음
        await tx.insert(auditLog).values({ userId: u.id, tableName: "personal_links", action: "create", after: { kind, refIds: ids } });
      })
      .catch((e: unknown) => {
        throw mapDbError(e);
      });
    await this.push.removeOwner(kind, ids);
    ids.forEach((id) => this.persons.forget(kind, id));
    return issued.map((x) => ({ kind, ...x }));
  }

  @Delete(":kind/:id") async revoke(@Param("kind") kind: string, @Param("id", ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    if (!isKind(kind)) throw Invalid("err.checkInput");
    const r = await db.transaction(async (tx) => {
      const rows = await tx
        .update(personalLinks)
        .set({ revokedAt: sql`now()` })
        .where(and(eq(personalLinks.kind, kind), eq(personalLinks.refId, id), isNull(personalLinks.revokedAt)))
        .returning({ id: personalLinks.id });
      if (rows.length)
        await tx.insert(auditLog).values({ userId: u.id, tableName: "personal_links", action: "delete", before: { kind, refId: id } });
      return rows;
    });
    if (!r.length) throw NotFound("err.what.link");
    await this.push.removeOwner(kind, [id]);
    this.persons.forget(kind, id);
    return { ok: true };
  }
}
