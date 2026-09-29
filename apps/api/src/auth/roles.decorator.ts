import { SetMetadata, createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Role } from "@wyd/shared";
import type { FastifyRequest } from "fastify";

export const ROLES_KEY = "wyd:roles";
/** 로그인 필수 + (선택) 역할 제한. 인자 없으면 로그인만 요구 */
export const RequireLogin = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<FastifyRequest>().user);
