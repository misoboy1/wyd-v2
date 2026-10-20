// 개인 링크 신원 — 계정 없는 순례자·봉사자. 쿠키의 토큰 원문을 sha256으로 찾고, 잠깐 캐시해 매 요청 DB 조회를 피함
import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import type { PersonKind, PersonMe } from "@wyd/shared";
import { db } from "../db/client.js";
import { personalLinks, visitors, volunteers } from "../db/schema.js";
import { whoKey } from "../events/events.service.js";
import { Limiter, clientIp } from "../common/limiter.js";
import { UsersCache } from "../auth/users.cache.js";

export const PERSON_COOKIE = "wyd_pt";
const TTL = 60_000;
// 틀린 개인 링크 쿠키: IP당 10분 60회까지만 DB 조회
const cookieMisses = new Limiter(60, 10 * 60_000);

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

  /** 토큰 → 사람. 폐기됐거나 명단에서 지워졌으면 null */
  async byToken(token: string | undefined): Promise<PersonMe | null> {
    if (!token || token.length > 100) return null;
    const h = hashToken(token);
    const hit = this.cache.get(h);
    if (hit && Date.now() - hit.at < TTL) return hit.p;
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
   * 쿠키의 개인 링크. 틀린 쿠키를 반복하는 IP는 DB 조회 없이 무시(SEC-05).
   * count=false: SSE 주기 재확인 — 폐기된 기기가 연결을 열어 둔 것만으로 같은 IP(성당 Wi-Fi)의 정상 사용자가 막히지 않게
   */
  async person(req: FastifyRequest, count = true) {
    const token = req.cookies?.[PERSON_COOKIE];
    if (!token) return null;
    const ip = clientIp(req);
    if (count && cookieMisses.retryAfter(ip)) return null;
    const p = await this.byToken(token);
    if (!p && count) cookieMisses.hit(ip);
    return p;
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
