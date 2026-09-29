import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { eq, sql } from "drizzle-orm";
import { hash, verify } from "@node-rs/argon2";
import { loginSchema } from "@wyd/shared";
import { z } from "zod";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { env } from "../common/env.js";
import { ApiError, Invalid, Unauthorized } from "../common/errors.js";
import { Limiter, clientIp } from "../common/limiter.js";
import { signToken, verifyToken, type RefreshClaims } from "./tokens.js";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./auth.guard.js";
import { RequireLogin, CurrentUser } from "./roles.decorator.js";
import { UsersCache } from "./users.cache.js";
import type { AuthUser } from "../common/auth-user.js";

// 실패 제한
// - 계정+IP 10회/15분, IP 30회/15분: 초과 시 거부. 시도는 처리 "전에" 센다 — 동시 요청으로 검사를 우회하지 못하도록
//   (성공하면 계정+IP는 초기화, IP는 이번 시도만 취소 — 성당 Wi-Fi처럼 한 IP를 여럿이 쓰는 경우 대비)
// - 계정 단위(IP를 바꿔 가며 대입하는 경우 대비): 잠그지 않고 "지연" — 잠그면 남이 관리자를 계속 잠글 수 있음(구 PIN 방식의 문제).
//   실패 5회부터 시도마다 1초씩(최대 8초) 늦추고, 같은 계정 시도는 한 번에 하나씩만 처리 → 초당 대입 횟수 상한.
//   대기열은 계정당 MAX_QUEUE건까지 — 넘치면 즉시 거부해 대기가 무한히 쌓여 진짜 사용자가 시간 초과되는 것을 막음
const byUserIp = new Limiter(10, 15 * 60_000);
const byIp = new Limiter(30, 15 * 60_000);
const byUser = new Limiter(20, 15 * 60_000);
const MAX_QUEUE = 5;
const userQueue = new Map<string, { tail: Promise<unknown>; n: number }>();
/** 같은 계정 시도를 순서대로 실행. 대기열이 가득 차면 null(실행하지 않음) */
function serialPerUser<T>(user: string, fn: () => Promise<T>): Promise<T> | null {
  const q = userQueue.get(user) ?? { tail: Promise.resolve(), n: 0 };
  if (q.n >= MAX_QUEUE) return null;
  const next = q.tail.catch(() => {}).then(fn);
  q.tail = next;
  q.n++;
  userQueue.set(user, q);
  void next
    .finally(() => {
      if (--q.n === 0 && userQueue.get(user) === q) userQueue.delete(user);
    })
    .catch(() => {});
  return next;
}
export const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
// 존재하지 않는 계정에도 같은 시간이 걸리도록 하는 더미 해시
const DUMMY = hash("dummy-password-for-timing", ARGON);

@Controller("auth")
export class AuthController {
  constructor(private readonly cache: UsersCache) {}

  private setCookies(reply: FastifyReply, id: number, tv: number) {
    const base = { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "strict" as const };
    reply.setCookie(ACCESS_COOKIE, signToken({ sub: id, typ: "access", tv }, env.ACCESS_TTL_SEC), {
      ...base,
      path: "/api",
      maxAge: env.ACCESS_TTL_SEC,
    });
    reply.setCookie(REFRESH_COOKIE, signToken({ sub: id, typ: "refresh", tv }, env.REFRESH_TTL_SEC), {
      ...base,
      path: "/api/auth",
      maxAge: env.REFRESH_TTL_SEC,
    });
  }
  private publicUser(u: typeof users.$inferSelect) {
    return { id: u.id, username: u.username, name: u.name, role: u.role, team: u.team, homestayId: u.homestayId };
  }

  @Post("login")
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const p = loginSchema.safeParse(body);
    if (!p.success) throw Invalid("아이디와 비밀번호를 입력하세요.");
    const ip = clientIp(req),
      key = `${p.data.username.toLowerCase()}|${ip}`;
    const wait = Math.max(byUserIp.retryAfter(key), byIp.retryAfter(ip));
    if (wait) throw new ApiError("RATE_LIMIT", `로그인 시도가 너무 많습니다. ${Math.ceil(wait / 60000)}분 후 다시 시도하세요.`, 429);
    const uname = p.data.username.toLowerCase();
    const run = serialPerUser(uname, async () => {
      const fails = byUser.count(uname);
      if (fails >= 5) await new Promise((r) => setTimeout(r, Math.min(8000, (fails - 4) * 1000)));
      const [row] = await db
        .select()
        .from(users)
        .where(sql`lower(${users.username}) = lower(${p.data.username})`);
      const good =
        row && row.active ? await verify(row.passwordHash, p.data.password) : (await verify(await DUMMY, p.data.password), false);
      return { u: row, ok: good };
    });
    if (!run) throw new ApiError("RATE_LIMIT", "이 계정으로 로그인 시도가 몰려 있습니다. 잠시 후 다시 시도하세요.", 429);
    byUserIp.hit(key);
    byIp.hit(ip);
    const { u, ok } = await run;
    if (!ok || !u) {
      byUser.hit(uname);
      throw new ApiError("LOGIN_FAILED", "아이디 또는 비밀번호가 올바르지 않습니다.", 401);
    }
    byUserIp.reset(key);
    byIp.undo(ip);
    byUser.reset(uname);
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
    this.setCookies(reply, u.id, u.tokenVersion);
    return { user: this.publicUser(u) };
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const c = verifyToken<RefreshClaims>(req.cookies?.[REFRESH_COOKIE], "refresh");
    if (!c) throw Unauthorized("세션이 만료되었습니다. 다시 로그인하세요.");
    this.cache.invalidate(c.sub);
    const u = await this.cache.get(c.sub);
    if (!u || !u.active || u.tokenVersion !== c.tv) throw Unauthorized("세션이 만료되었습니다. 다시 로그인하세요.");
    this.setCookies(reply, u.id, u.tokenVersion);
    return { user: this.publicUser(u) };
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.clearCookie(ACCESS_COOKIE, { path: "/api" });
    reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    return { ok: true };
  }

  @Get("me")
  me(@CurrentUser() user?: AuthUser) {
    return { user: user ?? null };
  }

  @Post("password")
  @HttpCode(200)
  @RequireLogin()
  async changePassword(@Body() body: unknown, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) reply: FastifyReply) {
    const p = z.object({ current: z.string().min(1), next: z.string().min(8, "새 비밀번호는 8자 이상").max(200) }).safeParse(body);
    if (!p.success) throw Invalid(p.error.issues[0]?.message || "입력 확인");
    const [u] = await db.select().from(users).where(eq(users.id, user.id));
    if (!u || !(await verify(u.passwordHash, p.data.current)))
      throw new ApiError("LOGIN_FAILED", "현재 비밀번호가 올바르지 않습니다.", 400);
    const tv = u.tokenVersion + 1; // 다른 기기 세션 모두 로그아웃
    await db
      .update(users)
      .set({ passwordHash: await hash(p.data.next, ARGON), tokenVersion: tv })
      .where(eq(users.id, u.id));
    this.cache.invalidate(u.id);
    this.setCookies(reply, u.id, tv);
    return { ok: true };
  }
}
