import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { TABLE_NAMES, type TableName } from "@wyd/shared";
import { TablesService, isTable } from "./tables.service.js";
import { CurrentUser, RequireLogin } from "../auth/roles.decorator.js";
import type { AuthUser } from "../common/auth-user.js";
import { NotFound } from "../common/errors.js";

function tableOf(name: string): TableName {
  if (!isTable(name)) throw NotFound("표");
  return name;
}

@Controller()
export class TablesController {
  constructor(private readonly svc: TablesService) {}

  /** GET /api/data?tables=a,b — 초기 로딩용(권한 있는 표만) */
  @Get("data")
  data(@Query("tables") tables: string | undefined, @CurrentUser() user?: AuthUser) {
    const names = tables ? tables.split(",").filter(isTable) : TABLE_NAMES;
    return this.svc.dataset(names, user);
  }

  @Get("t/:table")
  list(@Param("table") t: string, @CurrentUser() user?: AuthUser) {
    return this.svc.list(tableOf(t), user);
  }

  @Post("t/:table")
  @RequireLogin()
  create(@Param("table") t: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthUser) {
    return this.svc.create(tableOf(t), body ?? {}, user);
  }

  @Post("t/:table/bulk")
  @HttpCode(200)
  @RequireLogin()
  async bulk(@Param("table") t: string, @Body() body: { rows?: Record<string, unknown>[] }, @CurrentUser() user: AuthUser) {
    return { results: await this.svc.bulk(tableOf(t), body?.rows ?? [], user) };
  }

  @Patch("t/:table/:id")
  @RequireLogin()
  update(
    @Param("table") t: string,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.update(tableOf(t), id, body ?? {}, user);
  }

  @Delete("t/:table/:id")
  @RequireLogin()
  remove(
    @Param("table") t: string,
    @Param("id", ParseIntPipe) id: number,
    @Query("version") version: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.remove(tableOf(t), id, version != null ? Number(version) : undefined, user);
  }
}
