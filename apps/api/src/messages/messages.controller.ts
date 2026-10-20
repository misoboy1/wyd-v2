import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post } from "@nestjs/common";
import { messageSchema, MESSAGE_MAX_RECIPIENTS } from "@wyd/shared";
import { z } from "zod";
import { Invalid } from "../common/errors.js";
import { issuesP, tr } from "../common/i18n.js";
import type { AuthUser } from "../common/auth-user.js";
import { CurrentUser, RequireLogin } from "../auth/roles.decorator.js";
import { MessagesService } from "./messages.service.js";

const readSchema = z.object({ ids: z.array(z.number().int().positive()).max(500).optional() });

/** 로그인 계정의 메시지 — 보내기·수신함·보낸 목록. 개인 링크(순례자·봉사자)는 /p */
@Controller("messages")
@RequireLogin()
export class MessagesController {
  constructor(private readonly svc: MessagesService) {}

  /** dryRun이면 저장 없이 받을 인원만 */
  @Post()
  async send(@Body() body: unknown, @CurrentUser() u: AuthUser) {
    const p = messageSchema.safeParse(body);
    if (!p.success) throw Invalid("err.invalidInput", undefined, { table: tr("err.what.message"), issues: issuesP(p.error.issues) });
    const { dryRun, ...input } = p.data;
    if (dryRun) {
      const n = (await this.svc.resolve(u, input.to)).length;
      return { recipients: n, max: MESSAGE_MAX_RECIPIENTS };
    }
    return this.svc.send(u, input);
  }

  @Get("inbox") inbox(@CurrentUser() u: AuthUser) {
    return this.svc.inbox({ kind: "user", refId: u.id });
  }

  @Post("read")
  @HttpCode(200)
  read(@Body() body: unknown, @CurrentUser() u: AuthUser) {
    const p = readSchema.safeParse(body);
    if (!p.success) throw Invalid("err.checkInput");
    return this.svc.markRead({ kind: "user", refId: u.id }, p.data.ids);
  }

  @Get("sent") sent(@CurrentUser() u: AuthUser) {
    return this.svc.sent(u);
  }

  @Get("directory") directory(@CurrentUser() u: AuthUser) {
    return this.svc.directory(u);
  }

  @Delete(":id") remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.svc.remove(u, id);
  }
}
