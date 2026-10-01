import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { asc, eq, sql } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { z } from "zod";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { Invalid, NotFound, mapDbError } from "../common/errors.js";
import { issuesP, tr } from "../common/i18n.js";
import { RequireLogin, CurrentUser } from "./roles.decorator.js";
import { UsersCache } from "./users.cache.js";
import { ARGON } from "./auth.controller.js";
import type { AuthUser } from "../common/auth-user.js";

const base = z.object({
  username: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[A-Za-z0-9._@-]+$/, "valid.usernameChars"),
  name: z.string().trim().max(60).default(""),
  role: z.enum(["admin", "dept", "host"]),
  team: z.string().trim().max(60).default(""),
  homestayId: z.number().int().positive().nullable().default(null),
  active: z.boolean().default(true),
});
const createSchema = base.extend({ password: z.string().min(8, "valid.passwordMin").max(200) });
const updateSchema = base.partial().extend({ password: z.string().min(8).max(200).optional() });
const pub = (u: typeof users.$inferSelect) => ({
  id: u.id,
  username: u.username,
  name: u.name,
  role: u.role,
  team: u.team,
  homestayId: u.homestayId,
  active: u.active,
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
});

/** 계정 관리(본당 관리자 전용) */
@Controller("users")
@RequireLogin("admin")
export class UsersController {
  constructor(private readonly cache: UsersCache) {}

  @Get() async list() {
    return (await db.select().from(users).orderBy(asc(users.id))).map(pub);
  }

  @Post() async create(@Body() body: unknown) {
    const p = createSchema.safeParse(body);
    if (!p.success) throw Invalid("err.invalidInput", undefined, { table: tr("err.what.account"), issues: issuesP(p.error.issues) });
    const { password, ...rest } = p.data;
    try {
      const [u] = await db
        .insert(users)
        .values({ ...rest, passwordHash: await hash(password, ARGON) })
        .returning();
      return pub(u);
    } catch (e) {
      throw mapDbError(e);
    }
  }

  @Patch(":id") async update(@Param("id", ParseIntPipe) id: number, @Body() body: unknown, @CurrentUser() me: AuthUser) {
    const p = updateSchema.safeParse(body);
    if (!p.success) throw Invalid("err.invalidInput", undefined, { table: tr("err.what.account"), issues: issuesP(p.error.issues) });
    const { password, ...rest } = p.data;
    if (id === me.id && ((rest.role && rest.role !== "admin") || rest.active === false)) throw Invalid("err.users.selfDemote");
    const set: Record<string, unknown> = { ...rest };
    // 비밀번호·권한·활성 변경 시 기존 세션 무효화
    if (password || rest.role || rest.active === false || rest.team !== undefined || rest.homestayId !== undefined)
      set.tokenVersion = sql`${users.tokenVersion} + 1`;
    if (password) set.passwordHash = await hash(password, ARGON);
    try {
      const [u] = await db.update(users).set(set).where(eq(users.id, id)).returning();
      if (!u) throw NotFound("err.what.account");
      this.cache.invalidate(id);
      return pub(u);
    } catch (e) {
      throw mapDbError(e);
    }
  }

  @Delete(":id") async remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() me: AuthUser) {
    if (id === me.id) throw Invalid("err.users.selfDelete");
    const r = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    if (!r.length) throw NotFound("err.what.account");
    this.cache.invalidate(id);
    return { ok: true };
  }
}
