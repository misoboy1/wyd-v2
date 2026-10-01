import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import type { Role } from "@wyd/shared";
import { ROLES_KEY } from "./roles.decorator.js";
import { verifyToken, type AccessClaims } from "./tokens.js";
import { UsersCache } from "./users.cache.js";
import { Forbidden, Unauthorized, ApiError } from "../common/errors.js";

export const ACCESS_COOKIE = "wyd_at";
export const REFRESH_COOKIE = "wyd_rt";

/**
 * 전역 가드: 쿠키의 access 토큰을 확인해 req.user 설정(없으면 비로그인으로 통과).
 * - @RequireLogin() 이 붙은 라우트만 로그인/역할 강제
 * - 쓰기 요청(POST·PATCH·PUT·DELETE)은 X-WYD 헤더 필수(CSRF 방어: 교차 출처 폼 전송은 사용자 지정 헤더를 못 붙임)
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersCache,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== "http") return true;
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    if (req.method !== "GET" && req.method !== "HEAD" && req.headers["x-wyd"] !== "1") {
      throw new ApiError("CSRF", "err.csrf", 403);
    }
    const claims = verifyToken<AccessClaims>(req.cookies?.[ACCESS_COOKIE], "access");
    if (claims) {
      const u = await this.users.get(claims.sub);
      if (u && u.active && u.tokenVersion === claims.tv)
        req.user = { id: u.id, username: u.username, name: u.name, role: u.role as Role, team: u.team, homestayId: u.homestayId };
    }
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles === undefined) return true;
    if (!req.user) throw Unauthorized();
    if (roles.length && !roles.includes(req.user.role)) throw Forbidden();
    return true;
  }
}
