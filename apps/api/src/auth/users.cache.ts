import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

type U = typeof users.$inferSelect;
/** 요청마다 users 조회를 피하기 위한 짧은 캐시(10초). 권한 변경·비활성화는 invalidate로 즉시 반영 */
@Injectable()
export class UsersCache {
  private m = new Map<number, { u: U | undefined; at: number }>();
  async get(id: number): Promise<U | undefined> {
    const c = this.m.get(id);
    if (c && Date.now() - c.at < 10_000) return c.u;
    const [u] = await db.select().from(users).where(eq(users.id, id));
    this.m.set(id, { u, at: Date.now() });
    return u;
  }
  invalidate(id?: number) {
    if (id == null) this.m.clear();
    else this.m.delete(id);
  }
}
