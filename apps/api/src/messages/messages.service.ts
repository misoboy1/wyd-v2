// 메시지 — 대상 풀기(권한 확인 포함)·저장·수신함·읽음·보낸 목록. 저장 후 SSE(대상자만)와 웹 푸시로 알림
import { Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { MESSAGE_MAX_RECIPIENTS, isSameTeam, type InboxMessage, type MessageTarget, type SentMessage } from "@wyd/shared";
import { db } from "../db/client.js";
import { auditLog, messageRecipients, messages, users, visitors, volunteers } from "../db/schema.js";
import { ApiError, Forbidden, Invalid, NotFound } from "../common/errors.js";
import type { AuthUser } from "../common/auth-user.js";
import { EventsService, whoKey } from "../events/events.service.js";
import { PushService } from "../push/push.service.js";
import type { Who } from "./person.service.js";

const deny = () => Forbidden("err.msg.targetForbidden");

/**
 * 보낼 수 있는 대상(서버가 최종 판단 — 화면 ComposeDialog도 같은 규칙으로 후보를 보여 줌)
 * - admin: 전부
 * - dept: 자기 팀(팀 전체·팀 봉사자·같은 팀 분과 계정), 관리자
 * - host: 자기 가정(가정·숙박 순례자), 관리자
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly events: EventsService,
    private readonly push: PushService,
  ) {}

  /** 대상 → 받는 사람 목록(중복 제거, 보낸 사람 본인 제외). 권한 밖 대상이 하나라도 있으면 403 */
  async resolve(u: AuthUser, targets: MessageTarget[]): Promise<Who[]> {
    const admin = u.role === "admin";
    const out = new Map<string, Who>();
    const add = (kind: Who["kind"], ids: number[]) => ids.forEach((refId) => out.set(whoKey(kind, refId), { kind, refId }));
    // 대상이 여럿이어도 계정·봉사자 명단은 한 번만 읽음(drizzle 쿼리는 await할 때마다 다시 실행되므로 Promise로 고정)
    let us: Promise<{ id: number; role: string; team: string; homestayId: number | null }[]> | undefined;
    let vols: Promise<{ id: number; team: string }[]> | undefined;
    const activeUsers = () =>
      (us ??= db
        .select({ id: users.id, role: users.role, team: users.team, homestayId: users.homestayId })
        .from(users)
        .where(eq(users.active, true))
        .then((r) => r));
    const allVolunteers = () =>
      (vols ??= db
        .select({ id: volunteers.id, team: volunteers.team })
        .from(volunteers)
        .then((r) => r));

    for (const t of targets) {
      switch (t.k) {
        case "user": {
          const r = (await activeUsers()).find((x) => x.id === t.id);
          if (!r) break;
          if (!admin && r.role !== "admin" && !(u.role === "dept" && r.role === "dept" && isSameTeam(r.team, u.team))) throw deny();
          add("user", [r.id]);
          break;
        }
        case "role":
          if (!admin && t.role !== "admin") throw deny();
          add(
            "user",
            (await activeUsers()).filter((x) => x.role === t.role).map((x) => x.id),
          );
          break;
        case "team": {
          if (!admin && !(u.role === "dept" && isSameTeam(t.team, u.team))) throw deny();
          add(
            "user",
            (await activeUsers()).filter((x) => x.role === "dept" && isSameTeam(x.team, t.team)).map((x) => x.id),
          );
          const vs = await allVolunteers();
          add(
            "volunteer",
            vs.filter((v) => isSameTeam(v.team, t.team)).map((v) => v.id),
          );
          break;
        }
        case "homestay": {
          if (!admin && !(u.role === "host" && u.homestayId === t.id)) throw deny();
          add(
            "user",
            (await activeUsers()).filter((x) => x.role === "host" && x.homestayId === t.id).map((x) => x.id),
          );
          const vs = await db.select({ id: visitors.id }).from(visitors).where(eq(visitors.homestayId, t.id));
          add(
            "visitor",
            vs.map((v) => v.id),
          );
          break;
        }
        case "group": {
          if (!admin) throw deny();
          const vs = await db.select({ id: visitors.id }).from(visitors).where(eq(visitors.gno, t.gno));
          add(
            "visitor",
            vs.map((v) => v.id),
          );
          break;
        }
        case "visitor": {
          const [v] = await db.select({ id: visitors.id, homestayId: visitors.homestayId }).from(visitors).where(eq(visitors.id, t.id));
          if (!v) break;
          if (!admin && !(u.role === "host" && u.homestayId != null && v.homestayId === u.homestayId)) throw deny();
          add("visitor", [v.id]);
          break;
        }
        case "volunteer": {
          const v = (await allVolunteers()).find((x) => x.id === t.id);
          if (!v) break;
          if (!admin && !(u.role === "dept" && isSameTeam(v.team, u.team))) throw deny();
          add("volunteer", [v.id]);
          break;
        }
        case "allVisitors":
        case "allVolunteers": {
          if (!admin) throw deny();
          const tb = t.k === "allVisitors" ? visitors : volunteers;
          add(
            t.k === "allVisitors" ? "visitor" : "volunteer",
            (await db.select({ id: tb.id }).from(tb)).map((v) => v.id),
          );
          break;
        }
      }
    }
    out.delete(whoKey("user", u.id));
    return [...out.values()];
  }

  async send(u: AuthUser, input: { title: string; body: string; link: string; to: MessageTarget[] }) {
    const who = await this.resolve(u, input.to);
    if (!who.length) throw Invalid("err.msg.noRecipients");
    if (who.length > MESSAGE_MAX_RECIPIENTS)
      throw new ApiError("VALIDATION", "err.msg.tooMany", 400, undefined, { max: MESSAGE_MAX_RECIPIENTS });
    const m = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(messages)
        .values({ title: input.title, body: input.body, link: input.link, sender: u.name || u.username, senderId: u.id, targets: input.to })
        .returning();
      // 행 3개 × 1000 = 바인딩 3000개 — Postgres 한도(65535) 안에서 나눠 넣음
      for (let i = 0; i < who.length; i += 1000)
        await tx.insert(messageRecipients).values(who.slice(i, i + 1000).map((w) => ({ messageId: row.id, kind: w.kind, refId: w.refId })));
      // 감사 로그 — 누가 누구(대상)에게 몇 명에게 보냈는지(본문은 메시지 표에)
      await tx.insert(auditLog).values({
        userId: u.id,
        tableName: "messages",
        rowId: row.id,
        action: "create",
        after: { title: row.title, targets: input.to, recipients: who.length },
      });
      return row;
    });
    this.events.emitTo(
      who.map((w) => whoKey(w.kind, w.refId)),
      ["inbox"],
      { id: m.id, title: m.title },
    );
    this.events.emitTo([whoKey("user", u.id)], ["sent"]);
    this.push.send(who, (w) => ({
      title: m.title,
      body: m.body.length > 140 ? m.body.slice(0, 139) + "…" : m.body,
      url: w.kind === "user" ? "/inbox" : "/me",
      tag: `msg-${m.id}`,
    }));
    return { id: m.id, recipients: who.length };
  }

  async inbox(w: Who): Promise<InboxMessage[]> {
    const rows = await db
      .select({
        id: messages.id,
        title: messages.title,
        body: messages.body,
        link: messages.link,
        sender: messages.sender,
        createdAt: messages.createdAt,
        readAt: messageRecipients.readAt,
      })
      .from(messageRecipients)
      .innerJoin(messages, eq(messages.id, messageRecipients.messageId))
      .where(and(eq(messageRecipients.kind, w.kind), eq(messageRecipients.refId, w.refId)))
      .orderBy(desc(messages.id))
      .limit(200);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), readAt: r.readAt?.toISOString() ?? null }));
  }

  /** ids 없으면 전부 읽음 */
  async markRead(w: Who, ids?: number[]) {
    const r = await db
      .update(messageRecipients)
      .set({ readAt: sql`now()` })
      .where(
        and(
          eq(messageRecipients.kind, w.kind),
          eq(messageRecipients.refId, w.refId),
          isNull(messageRecipients.readAt),
          ids ? inArray(messageRecipients.messageId, ids) : undefined,
        ),
      )
      .returning({ messageId: messageRecipients.messageId });
    if (!r.length) return { updated: 0 };
    // 같은 사람의 다른 기기 배지, 보낸 사람의 읽음 수 갱신
    this.events.emitTo([whoKey(w.kind, w.refId)], ["inbox"]);
    const senders = await db
      .selectDistinct({ id: messages.senderId })
      .from(messages)
      .where(
        inArray(
          messages.id,
          r.map((x) => x.messageId),
        ),
      );
    const keys = senders.flatMap((s) => (s.id == null ? [] : [whoKey("user", s.id)]));
    this.events.emitTo(keys, ["sent"]);
    return { updated: r.length };
  }

  /** 관리자는 전체, 그 외는 자기가 보낸 것 */
  async sent(u: AuthUser): Promise<SentMessage[]> {
    const rows = await db
      .select({
        id: messages.id,
        title: messages.title,
        body: messages.body,
        link: messages.link,
        sender: messages.sender,
        senderId: messages.senderId,
        targets: messages.targets,
        createdAt: messages.createdAt,
        total: sql<number>`count(${messageRecipients.refId})::int`,
        read: sql<number>`count(${messageRecipients.readAt})::int`,
      })
      .from(messages)
      .leftJoin(messageRecipients, eq(messageRecipients.messageId, messages.id))
      .where(u.role === "admin" ? undefined : eq(messages.senderId, u.id))
      .groupBy(messages.id)
      .orderBy(desc(messages.id))
      .limit(200);
    return rows.map((r) => ({ ...r, targets: r.targets as MessageTarget[], createdAt: r.createdAt.toISOString() }));
  }

  /** 보낸 사람 본인 또는 관리자. 받은 사람 수신함에서도 사라짐(cascade) */
  async remove(u: AuthUser, id: number) {
    const [m] = await db.select({ senderId: messages.senderId }).from(messages).where(eq(messages.id, id));
    if (!m) throw NotFound("err.what.message");
    if (u.role !== "admin" && m.senderId !== u.id) throw Forbidden();
    const rs = await db
      .select({ kind: messageRecipients.kind, refId: messageRecipients.refId })
      .from(messageRecipients)
      .where(eq(messageRecipients.messageId, id));
    await db.transaction(async (tx) => {
      await tx.delete(messages).where(eq(messages.id, id));
      await tx
        .insert(auditLog)
        .values({ userId: u.id, tableName: "messages", rowId: id, action: "delete", before: { senderId: m.senderId } });
    });
    this.events.emitTo(
      rs.map((r) => whoKey(r.kind, r.refId)),
      ["inbox"],
    );
    this.events.emitTo([whoKey("user", u.id), ...(m.senderId != null ? [whoKey("user", m.senderId)] : [])], ["sent"]);
    return { ok: true };
  }

  /** 보내기 화면 계정 후보 — 이름·역할·팀만(연락처 없음). 받을 수 있는 사람만 */
  async directory(u: AuthUser) {
    const rows = await db
      .select({ id: users.id, name: users.name, username: users.username, role: users.role, team: users.team })
      .from(users)
      .where(eq(users.active, true))
      .orderBy(users.id);
    return rows.filter(
      (r) =>
        r.id !== u.id &&
        (u.role === "admin" || r.role === "admin" || (u.role === "dept" && r.role === "dept" && isSameTeam(r.team, u.team))),
    );
  }
}
