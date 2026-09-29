// 환경 변수 — .env 또는 docker-compose에서 주입
const num = (v: string | undefined, d: number) => (v && !isNaN(Number(v)) ? Number(v) : d);
const isProd = process.env.NODE_ENV === "production";

function need(name: string, dev: string): string {
  const v = process.env[name];
  if (v) return v;
  if (isProd) throw new Error(`환경 변수 ${name} 가 필요합니다`);
  return dev;
}

export const env = {
  isProd,
  PORT: num(process.env.PORT, 3000),
  HOST: process.env.HOST ?? "0.0.0.0",
  DATABASE_URL: need("DATABASE_URL", "postgres://wyd:wyd@localhost:5432/wyd"),
  DB_POOL_MAX: num(process.env.DB_POOL_MAX, 10),
  JWT_SECRET: need("JWT_SECRET", "dev-only-secret-change-me-dev-only-secret"),
  ACCESS_TTL_SEC: num(process.env.ACCESS_TTL_SEC, 15 * 60),
  REFRESH_TTL_SEC: num(process.env.REFRESH_TTL_SEC, 7 * 24 * 3600),
  /** https(ngrok) 뒤에서는 true — 쿠키 Secure 속성 */
  COOKIE_SECURE: (process.env.COOKIE_SECURE ?? (isProd ? "true" : "false")) === "true",
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "./.data/uploads",
  WYD_SYNC_CRON: process.env.WYD_SYNC_CRON ?? "0 10 6 * * *", // 매일 06:10 KST
  WYD_SYNC_ENABLED: (process.env.WYD_SYNC_ENABLED ?? "true") === "true",
  TZ: "Asia/Seoul",
};
