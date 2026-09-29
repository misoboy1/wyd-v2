import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../common/env.js";

// 최소 JWT(HS256) — 외부 라이브러리 없이 서명·검증
export interface AccessClaims { sub: number; typ: "access"; tv: number; exp: number }
export interface RefreshClaims { sub: number; typ: "refresh"; tv: number; exp: number }

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (data: string) => createHmac("sha256", env.JWT_SECRET).update(data).digest();

export function signToken(claims: Omit<AccessClaims, "exp"> | Omit<RefreshClaims, "exp">, ttlSec: number): string {
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  return `${head}.${body}.${b64(sign(`${head}.${body}`))}`;
}
export function verifyToken<T extends { exp: number; typ: string }>(token: string | undefined, typ: T["typ"]): T | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expect = sign(`${parts[0]}.${parts[1]}`);
  const got = Buffer.from(parts[2], "base64url");
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
  try {
    const c = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as T;
    if (c.typ !== typ || typeof c.exp !== "number" || c.exp < Date.now() / 1000) return null;
    return c;
  } catch { return null; }
}
