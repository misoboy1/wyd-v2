// 로컬 개발용 PostgreSQL (Docker 없이) — embedded-postgres 바이너리 사용
// 실행: node scripts/dev-db.mjs  → postgres://wyd:wyd@localhost:54329/wyd
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(".data/pg");
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "wyd", password: "wyd", port: 54329, persistent: true });
if (!existsSync(path.join(dir, "PG_VERSION"))) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("wyd");
} catch {
  /* 이미 있음 */
}
console.log("dev postgres ready: postgres://wyd:wyd@localhost:54329/wyd");
const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
