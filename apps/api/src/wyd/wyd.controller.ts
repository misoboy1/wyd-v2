import { Controller, Get, HttpCode, Post } from "@nestjs/common";
import { WydService } from "./wyd.service.js";
import { RequireLogin } from "../auth/roles.decorator.js";

@Controller("wyd-status")
export class WydController {
  constructor(private readonly svc: WydService) {}
  @Get() latest() {
    return this.svc.latest();
  }
  /** 관리자 수동 동기화 */
  @Post("sync")
  @HttpCode(200)
  @RequireLogin("admin")
  async sync() {
    await this.svc.sync();
    return this.svc.latest();
  }
}
