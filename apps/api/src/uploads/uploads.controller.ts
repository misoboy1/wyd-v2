import { Controller, HttpCode, Param, ParseIntPipe, Post, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { TablesService } from "../tables/tables.service.js";
import { RequireLogin, CurrentUser } from "../auth/roles.decorator.js";
import type { AuthUser } from "../common/auth-user.js";
import { env } from "../common/env.js";
import { Invalid } from "../common/errors.js";

const MAX = 10 * 1024 * 1024;
const OK_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);

/** 고리기도 사진 업로드 — 리사이즈(최대 1600px, WebP) 후 uploads 볼륨에 저장, nginx가 /uploads/ 로 서빙 */
@Controller("gori")
export class UploadsController {
  constructor(private readonly svc: TablesService) {}

  @Post(":id/photo") @HttpCode(200) @RequireLogin("admin")
  async upload(@Param("id", ParseIntPipe) id: number, @Query("version") version: string, @Req() req: FastifyRequest, @CurrentUser() user: AuthUser) {
    const file = await req.file({ limits: { fileSize: MAX, files: 1 } });
    if (!file) throw Invalid("사진 파일이 없습니다.");
    if (!OK_TYPES.has(file.mimetype)) throw Invalid("jpg·png·webp·gif·heic 사진만 올릴 수 있습니다.");
    const buf = await file.toBuffer();
    if (file.file.truncated) throw Invalid("사진은 10MB 이하만 올릴 수 있습니다.");
    let out: Buffer;
    try {
      out = await sharp(buf, { failOn: "error" }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    } catch { throw Invalid("이미지를 읽을 수 없습니다(손상된 파일이거나 지원하지 않는 형식)."); }
    const dir = path.resolve(env.UPLOAD_DIR, "gori");
    await mkdir(dir, { recursive: true });
    const name = `${id}-${randomUUID().slice(0, 8)}.webp`;
    await writeFile(path.join(dir, name), out);
    try {
      return await this.svc.update("gori", id, { version: Number(version), photo: `/uploads/gori/${name}` }, user);
    } catch (e) {
      await unlink(path.join(dir, name)).catch(() => {});
      throw e;
    }
  }
}
