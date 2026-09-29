// 시작 시 자동 실행되는 마이그레이션 (drizzle 폴더의 SQL 적용)
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { db, sqlClient } from "./client.js";

export async function runMigrations() {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");
  await migrate(db, { migrationsFolder: dir });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations()
    .then(() => {
      console.log("migrations applied");
      return sqlClient.end();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
