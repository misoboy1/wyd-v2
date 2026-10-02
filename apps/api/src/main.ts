import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { AppModule } from "./app.module.js";
import { env } from "./common/env.js";
import { registerEtag } from "./common/etag.js";
import { runMigrations } from "./db/migrate.js";
import { ensureBootstrap } from "./cli/bootstrap.js";
import { loadAllLocales } from "@wyd/shared";

async function main() {
  await loadAllLocales(); // 응답 언어(Accept-Language)별 오류 문구 — 모든 언어 사전 상시 메모리
  await runMigrations();
  await ensureBootstrap();

  const adapter = new FastifyAdapter({
    trustProxy: true,
    bodyLimit: 5 * 1024 * 1024,
    logger: env.isProd ? { level: "warn" } : { level: "info" },
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, { logger: ["error", "warn", "log"] });
  app.setGlobalPrefix("api");
  await app.register(cookie as any);
  await app.register(helmet, { contentSecurityPolicy: false }); // CSP는 nginx에서 (정적 페이지 기준)
  await app.register(multipart as any);
  registerEtag(app.getHttpAdapter().getInstance());
  // 개발 모드: 업로드 파일 직접 서빙(운영에서는 nginx가 /uploads/ 서빙)
  if (!env.isProd) {
    const root = path.resolve(env.UPLOAD_DIR);
    mkdirSync(root, { recursive: true });
    // 개발 전용 패키지 → 동적 import(운영 이미지에는 없어도 기동에 영향 없음)
    const { default: fstatic } = await import("@fastify/static");
    await app.register(fstatic, { root, prefix: "/uploads/", decorateReply: false });
  }
  app.enableShutdownHooks();
  await app.listen({ port: env.PORT, host: env.HOST });
  console.log(`WYD API listening on :${env.PORT}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
