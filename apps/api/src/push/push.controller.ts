import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { pushSubscriptionSchema } from "@wyd/shared";
import { z } from "zod";
import { ApiError, Forbidden, Invalid } from "../common/errors.js";
import { PersonService, type Who } from "../messages/person.service.js";
import { PushService, isPushEndpoint } from "./push.service.js";

const unsubSchema = z.object({ endpoint: z.string().max(1000) });
const asSchema = z.object({ as: z.literal("person").optional() });

/** 웹 푸시 구독 — 로그인 계정 또는 개인 링크로 연결된 기기 */
@Controller("push")
export class PushController {
  constructor(
    private readonly push: PushService,
    private readonly persons: PersonService,
  ) {}

  /** 구독 주인 — 기본은 로그인 계정 우선. as: "person"이면 개인 링크(/me 화면: 같은 기기에 로그인돼 있어도 순례자·봉사자 알림) */
  private async who(req: FastifyRequest, body: unknown): Promise<Who | null> {
    if (asSchema.safeParse(body).data?.as !== "person") return this.persons.who(req);
    const p = await this.persons.person(req);
    return p ? { kind: p.kind, refId: p.id } : null;
  }

  /** VAPID 공개키(브라우저 구독에 필요). 서버 설정이 없으면 null */
  @Get("key") key() {
    return { key: this.push.publicKey };
  }

  @Post("subscribe")
  @HttpCode(200)
  async subscribe(@Body() body: unknown, @Req() req: FastifyRequest) {
    const who = await this.who(req, body);
    if (!who) throw Forbidden("err.link.required");
    if (!this.push.enabled) throw new ApiError("PUSH_OFF", "err.push.disabled", 503);
    const p = pushSubscriptionSchema.safeParse(body);
    if (!p.success || !isPushEndpoint(p.data.endpoint)) throw Invalid("err.push.endpoint");
    await this.push.subscribe(who, p.data);
    return { ok: true };
  }

  @Post("unsubscribe")
  @HttpCode(200)
  async unsubscribe(@Body() body: unknown, @Req() req: FastifyRequest) {
    const who = await this.who(req, body);
    if (!who) throw Forbidden("err.link.required");
    const p = unsubSchema.safeParse(body);
    if (!p.success) throw Invalid("err.checkInput");
    return { ok: true, removed: await this.push.unsubscribe(who, p.data.endpoint) };
  }
}
