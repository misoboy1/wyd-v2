import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { publicQuestionSchema, todayKST } from "@wyd/shared";
import { TablesService } from "./tables.service.js";
import { ApiError, Invalid } from "../common/errors.js";
import { Limiter, clientIp } from "../common/limiter.js";
import { sqlClient } from "../db/client.js";

const qnaLimit = new Limiter(5, 10 * 60_000); // IP당 10분 5건

@Controller()
export class PublicController {
  constructor(private readonly svc: TablesService) {}

  /** 비로그인 방문자 질문 등록 — 답변 필드는 받지 않음 */
  @Post("qna/ask")
  async ask(@Body() body: unknown, @Req() req: FastifyRequest) {
    const p = publicQuestionSchema.safeParse(body);
    if (!p.success) throw Invalid("질문자와 질문 내용을 입력하세요(질문자 40자, 질문 1000자 이내).");
    const ip = clientIp(req), wait = qnaLimit.retryAfter(ip);
    if (wait) throw new ApiError("RATE_LIMIT", "질문이 너무 많습니다. 잠시 후 다시 등록하세요.", 429);
    qnaLimit.hit(ip);
    const row = await this.svc.tx((tx) => this.svc.createIn(tx, "qna", { ...p.data, date: todayKST(), a: "", answered: false }, undefined, { skipAuth: true }));
    this.svc.events.emit(["qna"]);
    return row;
  }

  @Get("health")
  async health() {
    await sqlClient`select 1`;
    return { ok: true, version: process.env.APP_VERSION ?? "2.0.0", time: new Date().toISOString() };
  }
}
