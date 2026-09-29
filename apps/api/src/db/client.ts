import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";
import { env } from "../common/env.js";

export const sqlClient = postgres(env.DATABASE_URL, {
  max: env.DB_POOL_MAX,
  idle_timeout: 30,
  connect_timeout: 10,
  onnotice: () => {},
});
export const db = drizzle(sqlClient, { schema });
export type DB = PostgresJsDatabase<typeof schema>;
/** 트랜잭션 핸들(db.transaction 콜백 인자) */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
