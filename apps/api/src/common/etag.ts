// 표 조회 응답에 ETag — 내용이 같으면 304(본문 없음)로 응답해 ngrok 경유 전송량을 줄인다.
// 브라우저는 Cache-Control: no-cache 응답을 매번 If-None-Match로 재검증하고, 304면 저장해 둔 본문을 그대로 쓴다.
import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";

const CACHEABLE = /^\/api\/(t\/[^/?]+|data)(\?|$)/;

export function registerEtag(fastify: FastifyInstance) {
  fastify.addHook("onSend", async (req, reply, payload) => {
    if (req.method !== "GET" || reply.statusCode !== 200 || typeof payload !== "string" || !CACHEABLE.test(req.url)) return payload;
    // 응답은 사용자(권한)마다 다르므로 private. 약한 ETag — nginx gzip이 강한 ETag를 지우지 않게
    const etag = `W/"${createHash("sha1").update(payload).digest("base64url")}"`;
    reply.header("cache-control", "private, no-cache");
    reply.header("etag", etag);
    if (req.headers["if-none-match"] === etag) {
      reply.code(304);
      return "";
    }
    return payload;
  });
}
