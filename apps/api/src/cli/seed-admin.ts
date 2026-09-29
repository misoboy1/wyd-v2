// 사용법: node dist/cli/seed-admin.js <아이디> <비밀번호> [이름]
// (docker) docker compose exec api node dist/cli/seed-admin.js admin 'S3cure!pass'
import { eq, sql } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { db, sqlClient } from "../db/client.js";
import { users } from "../db/schema.js";

const [username, password, name = "본당 관리자"] = process.argv.slice(2);
if (!username || !password || password.length < 8) {
  console.error("사용법: seed-admin <아이디> <비밀번호(8자 이상)> [이름]");
  process.exit(1);
}
const ph = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
const [ex] = await db
  .select()
  .from(users)
  .where(sql`lower(${users.username}) = lower(${username})`);
if (ex)
  await db
    .update(users)
    .set({ passwordHash: ph, role: "admin", active: true, tokenVersion: ex.tokenVersion + 1 })
    .where(eq(users.id, ex.id));
else await db.insert(users).values({ username, name, role: "admin", passwordHash: ph });
console.log(ex ? `관리자 비밀번호 재설정: ${username}` : `관리자 생성: ${username}`);
await sqlClient.end();
