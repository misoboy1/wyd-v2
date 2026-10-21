// 개인 링크 신원 — 계정 없는 순례자·봉사자. 쿠키의 토큰 원문을 sha256으로 찾고, 잠깐 캐시해 매 요청 DB 조회를 피함
import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import { teamInfo, type PersonChat, type PersonKind, type PersonMe } from "@wyd/shared";
import { db } from "../db/client.js";
import { personalLinks, teamChats, visitors, volunteers } from "../db/schema.js";
import { whoKey } from "../events/events.service.js";
import { Limiter, clientIp } from "../common/limiter.js";
import { UsersCache } from "../auth/users.cache.js";

export const PERSON_COOKIE = "wyd_pt";
const TTL = 60_000;
// 틀린 개인 링크 쿠키 — 같은 쿠키는 10분 5회, 한 IP 전체는 10분 600회까지만 DB 조회.
// 성당·숙소 Wi-Fi처럼 한 IP 뒤에 많은 기기가 있어도, 폐기된 옛 QR 기기 몇 대 때문에 정상 사용자가 막히지 않게
const tokenMisses = new Limiter(5, 10 * 60_000);
const ipMisses = new Limiter(600, 10 * 60_000);

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("base64url");

/** 메시지를 받는 주체 — 로그인 계정 또는 개인 링크 */
export interface Who {
  kind: "user" | PersonKind;
  refId: number;
}

@Injectable()
export class PersonService {
  constructor(private readonly users: UsersCache) {}
  private cache = new Map<string, { p: PersonMe | null; at: number }>();

  /** 캐시에 있는 유효 토큰(DB 조회 없음) */
  private cached(h: string): PersonMe | null {
    const hit = this.cache.get(h);
    return hit && Date.now() - hit.at < TTL ? hit.p : null;
  }

  /** 토큰 → 사람. 폐기됐거나 명단에서 지워졌으면 null */
  async byToken(token: string | undefined): Promise<PersonMe | null> {
    if (!token || token.length > 100) return null;
    const h = hashToken(token);
    const hit = this.cached(h);
    if (hit) return hit;
    const [l] = await db
      .select({ kind: personalLinks.kind, refId: personalLinks.refId })
      .from(personalLinks)
      .where(and(eq(personalLinks.tokenHash, h), isNull(personalLinks.revokedAt)))
      .limit(1);
    let p: PersonMe | null = null;
    if (l) {
      const t = l.kind === "visitor" ? visitors : volunteers;
      const [r] = await db.select({ id: t.id, name: t.name }).from(t).where(eq(t.id, l.refId)).limit(1);
      if (r) p = { kind: l.kind as PersonKind, id: r.id, name: r.name };
    }
    // 없는 토큰은 캐시하지 않음 — 무작위 쿠키로 캐시를 채워 정상 사용자 캐시가 밀려나지 않게
    if (p) {
      if (this.cache.size > 5000) this.cache.clear();
      this.cache.set(h, { p, at: Date.now() });
    }
    return p;
  }

  /**
   * 쿠키의 개인 링크. 틀린 쿠키를 반복하면 DB 조회 없이 무시(SEC-05) — 캐시된 유효 토큰은 제한과 무관.
   * limited: 제한에 걸려 확인하지 못함(무효로 확인된 것과 구분 — 이때 쿠키를 지우면 정상 사용자 연결이 끊김).
   * count=false: SSE 주기 재확인(연결을 열어 둔 것만으로 실패를 쌓지 않게)
   */
  async lookup(req: FastifyRequest, count = true): Promise<{ p: PersonMe | null; limited: boolean }> {
    const token = req.cookies?.[PERSON_COOKIE];
    if (!token || token.length > 100) return { p: null, limited: false };
    const h = hashToken(token);
    const hit = this.cached(h);
    if (hit) return { p: hit, limited: false };
    const ip = clientIp(req),
      key = `${ip}|${h}`;
    // IP 먼저 — 이미 막힌 IP의 무작위 쿠키로 토큰별 기록이 계속 늘지 않게
    if (count && (ipMisses.retryAfter(ip) || tokenMisses.retryAfter(key))) return { p: null, limited: true };
    const p = await this.byToken(token);
    if (!p && count) {
      tokenMisses.hit(key);
      ipMisses.hit(ip);
    }
    return { p, limited: false };
  }

  async person(req: FastifyRequest, count = true) {
    return (await this.lookup(req, count)).p;
  }

  /** 봉사자의 자기 팀 오픈채팅방 — 팀은 매번 명단에서 읽음(팀 이동·채팅방 변경이 바로 반영되게) */
  async chat(p: PersonMe): Promise<PersonChat> {
    if (p.kind !== "volunteer") return null;
    const [v] = await db.select({ team: volunteers.team }).from(volunteers).where(eq(volunteers.id, p.id)).limit(1);
    if (!v) return null;
    const team = teamInfo(v).team;
    const [c] = await db
      .select({ team: teamChats.team, url: teamChats.url, code: teamChats.code })
      .from(teamChats)
      .where(eq(teamChats.team, team))
      .limit(1);
    return c ?? null;
  }

  /** 요청한 주체: 로그인 계정이 우선, 없으면 개인 링크 */
  async who(req: FastifyRequest): Promise<Who | null> {
    if (req.user) return { kind: "user", refId: req.user.id };
    const p = await this.person(req);
    return p ? { kind: p.kind, refId: p.id } : null;
  }

  /** SSE 필터용 — 이 연결이 받을 수 있는 키 전부(계정 + 개인 링크). 연결 중에도 주기적으로 다시 불러 폐기·비활성화를 반영 */
  async keys(req: FastifyRequest): Promise<Set<string>> {
    const s = new Set<string>();
    if (req.user) {
      const u = await this.users.get(req.user.id);
      if (u?.active) s.add(whoKey("user", req.user.id));
    }
    const p = await this.person(req, false);
    if (p) s.add(whoKey(p.kind, p.id));
    return s;
  }

  /** 폐기·재발급 즉시 반영 */
  forget(kind: PersonKind, refId: number) {
    for (const [h, v] of this.cache) if (!v.p || (v.p.kind === kind && v.p.id === refId)) this.cache.delete(h);
  }
}
