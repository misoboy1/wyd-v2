import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../common/env.js";
import { ApiError, Forbidden, Invalid } from "../common/errors.js";
import { Limiter, clientIp } from "../common/limiter.js";
import { MessagesService } from "./messages.service.js";
import { PERSON_COOKIE, PersonService } from "./person.service.js";

// 토큰 대입 방어(SEC-05): 실패만 센다 — IP당 10분 20회
const linkFails = new Limiter(20, 10 * 60_000);
const linkSchema = z.object({ token: z.string().trim().min(20).max(100) });
const readSchema = z.object({ ids: z.array(z.number().int().positive()).max(500).optional() });
const cookieOpts = () => ({ httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "strict" as const, path: "/api" });

/**
 * 개인 링크(계정 없는 순례자·봉사자) — 링크의 토큰을 쿠키로 바꿔 두고 이후 요청·SSE·푸시 구독에 씀.
 * 신원 없음은 401 대신 403 — 웹 api.ts가 401이면 로그인 토큰 갱신을 시도하므로
 */
@Controller("p")
export class PersonController {
  constructor(
    private readonly persons: PersonService,
    private readonly svc: MessagesService,
  ) {}

  /** 쿠키가 무효로 확인되면(폐기·재발급) 지움 — 옛 기기가 요청마다 실패로 세지지 않게. 제한에 걸려 확인 못 한 경우는 그대로 둠 */
  private async current(req: FastifyRequest, reply: FastifyReply) {
    const r = await this.persons.lookup(req);
    if (!r.p && !r.limited && req.cookies?.[PERSON_COOKIE]) reply.clearCookie(PERSON_COOKIE, cookieOpts());
    return r;
  }

  /** 제한에 걸려 확인 못 했으면 403(링크 없음)이 아니라 429 — 화면이 "QR 다시 연결" 대신 "잠시 후 다시"를 안내하게 */
  private async must(req: FastifyRequest, reply: FastifyReply) {
    const { p, limited } = await this.current(req, reply);
    if (limited) throw new ApiError("RATE_LIMIT", "err.link.tooMany", 429);
    if (!p) throw Forbidden("err.link.required");
    return p;
  }

  /** QR 링크(/me#토큰)를 연 기기 연결 */
  @Post("link")
  @HttpCode(200)
  async link(@Body() body: unknown, @Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const ip = clientIp(req);
    if (linkFails.retryAfter(ip)) throw new ApiError("RATE_LIMIT", "err.link.tooMany", 429);
    const p = linkSchema.safeParse(body);
    if (!p.success) {
      linkFails.hit(ip);
      throw Invalid("err.link.invalid");
    }
    const me = await this.persons.byToken(p.data.token);
    if (!me) {
      linkFails.hit(ip);
      throw Forbidden("err.link.invalid");
    }
    reply.setCookie(PERSON_COOKIE, p.data.token, { ...cookieOpts(), maxAge: env.PERSON_TTL_SEC });
    return me;
  }

  /** 연결 안 된 기기는 401 대신 null — 공개 화면에서 매번 오류가 나지 않게 */
  @Get("me") async me(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const { p, limited } = await this.current(req, reply);
    return { person: p, limited };
  }

  /** 봉사자 자기 팀 카카오톡 오픈채팅방(없으면 null) */
  @Get("chat") async chat(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return { chat: await this.persons.chat(await this.must(req, reply)) };
  }

  @Post("unlink")
  @HttpCode(200)
  unlink(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.clearCookie(PERSON_COOKIE, cookieOpts());
    return { ok: true };
  }

  @Get("inbox") async inbox(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const p = await this.must(req, reply);
    return this.svc.inbox({ kind: p.kind, refId: p.id });
  }

  @Post("read")
  @HttpCode(200)
  async read(@Body() body: unknown, @Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const p = await this.must(req, reply);
    const b = readSchema.safeParse(body);
    if (!b.success) throw Invalid("err.checkInput");
    return this.svc.markRead({ kind: p.kind, refId: p.id }, b.data.ids);
  }
}
