// 첫 기동 시: ① 관리자 계정(ADMIN_USERNAME/ADMIN_PASSWORD 환경 변수) ② 비어 있는 기준 콘텐츠 표 채우기
// 기준 콘텐츠 = 기존 index.html의 실측 시설·일정·준비 단계·장소·고리기도 배정표·분과·임원 (가상 인물 데이터는 넣지 않음)
import { count } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { DEMO, PREP_DEFAULT } from "@wyd/shared";
import { db } from "../db/client.js";
import * as S from "../db/schema.js";

const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
const strip = <T extends Record<string, unknown>>(r: T) => { const { id: _id, ...rest } = r; return rest; };

export async function ensureBootstrap() {
  const [{ n }] = await db.select({ n: count() }).from(S.users);
  if (n === 0 && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    await db.insert(S.users).values({ username: process.env.ADMIN_USERNAME, name: "본당 관리자", role: "admin", passwordHash: await hash(process.env.ADMIN_PASSWORD, ARGON) });
    console.log(`관리자 계정 생성: ${process.env.ADMIN_USERNAME} (로그인 후 비밀번호를 바꾸세요)`);
  }
  if (process.env.SEED_CONTENT === "false") return;
  await seedContent();
}

export async function seedContent(force = false) {
  const D = DEMO as any;
  const empty = async (t: any) => force || (await db.select({ n: count() }).from(t))[0].n === 0;
  if (await empty(S.facilities)) await db.insert(S.facilities).values(D.facilities.map((f: any) => ({ ...strip(f), note: f.note ?? "" })));
  if (await empty(S.departments)) await db.insert(S.departments).values(D.departments.map((d: any) => ({ name: d.name, kind: d.kind, task: d.task, key: !!d.key, sort: d.order ?? 0 })));
  if (await empty(S.officers)) await db.insert(S.officers).values(D.officers.map((o: any, i: number) => ({ ...strip(o), sort: i })));
  if (await empty(S.prep)) await db.insert(S.prep).values((PREP_DEFAULT as any[]).map((p, i) => ({ phase: p.phase, title: p.title, detail: p.detail, ref: p.ref, done: !!p.done, sort: i })));
  if (await empty(S.places)) await db.insert(S.places).values(D.places.map((p: any, i: number) => ({ ...strip(p), sort: i })));
  if (await empty(S.gori)) await db.insert(S.gori).values(D.gori.map((g: any) => ({ date: g.date, org: g.org, rep: g.rep ?? "", note: g.note ?? "", photo: g.photo ?? "" })));
  if (await empty(S.schedule)) {
    for (const [i, d] of (D.schedule as any[]).entries()) {
      const [row] = await db.insert(S.schedule).values({ date: d.date, event: d.event, prep: d.prep ?? "", sort: i }).returning();
      if (d.slots?.length) await db.insert(S.scheduleSlots).values(d.slots.map((s: any, j: number) => ({ scheduleId: row.id, time: s.time ?? "", text: s.text ?? "", who: s.who ?? "", sort: j })));
    }
  }
}
