// 테스트용 데이터 — 사용법: node dist/cli/seed-demo.js [--scale]
//   기본: 기존 데모(방문자 16·가정 8·봉사자 43·공지/게시판/Q&A)
//   --scale: 부하 테스트용 방문자 1,000명·가정 500곳 추가(비고에 '가상 …(임시)' 표시 → 일괄 삭제 가능)
import { DEMO, VIRTUAL, VG_COUNTRIES, VG_HS_TYPES, VG_ZONES } from "@wyd/shared";
import { sql } from "drizzle-orm";
import { db, sqlClient } from "../db/client.js";
import * as S from "../db/schema.js";
import { seedContent } from "./bootstrap.js";

const D = DEMO as any;
await seedContent();
const facs = await db.select().from(S.facilities);
const byName = new Map(facs.map((f) => [f.name, f.id]));
const depts = await db.select().from(S.departments);
const deptId = new Map(depts.map((d) => [d.name, d.id]));

// 기본 데모는 봉사자 표가 비어 있을 때만(여러 번 실행해도 중복되지 않게)
const [{ nv }] = await db.select({ nv: sql<number>`count(*)::int` }).from(S.volunteers);
if (nv === 0) {
const hs = await db.insert(S.homestays).values(D.homestays.map(({ id: _i, ...h }: any) => ({ ...h, note: h.note ?? "" }))).onConflictDoNothing().returning();
const hsByHost = new Map(hs.map((h) => [h.host, h.id]));
await db.insert(S.visitors).values(D.visitors.map(({ id: _i, room, homestay, ...v }: any) => ({
  ...v, facilityId: room ? byName.get(room) ?? null : null, homestayId: homestay ? hsByHost.get(homestay) ?? null : null,
}))).onConflictDoNothing();
await db.insert(S.volunteers).values(D.volunteers.map(({ id: _i, dept, ...v }: any) => ({ ...v, org: v.org ?? "", note: v.note ?? "", deptId: deptId.get(dept) ?? null })));
for (const t of ["notices", "posts", "qna"] as const) await db.insert(S[t] as any).values(D[t].map(({ id: _i, ...r }: any) => ({ ...r, a: r.a ?? undefined })));
} else console.log("기본 데모 건너뜀(봉사자 데이터가 이미 있음)");

if (process.argv.includes("--scale")) {
  const H: any[] = [];
  for (let i = 0; i < 500; i++) {
    const t = VG_HS_TYPES[i % VG_HS_TYPES.length] as any;
    H.push({ hid: "H" + String(1000 + i), host: `${VIRTUAL.hsName} H${1000 + i}`, zone: VG_ZONES[i % VG_ZONES.length], tel: VIRTUAL.hsTel, lang: "영어",
      mStu: t.mStu ?? 0, mYng: t.mYng ?? 0, fStu: t.fStu ?? 0, fYng: t.fYng ?? 0, cap: t.cap, period: "7/29–8/10", status: "확정", note: VIRTUAL.hsMark });
  }
  for (let i = 0; i < H.length; i += 200) await db.insert(S.homestays).values(H.slice(i, i + 200)).onConflictDoNothing();
  const V: any[] = [];
  for (let g = 0; V.length < 1000; g++) {
    const [country, lang] = VG_COUNTRIES[g % VG_COUNTRIES.length] as [string, string];
    const size = 4 + (g % 9);
    for (let k = 0; k < size && V.length < 1000; k++) V.push({ pid: "P" + String(1000 + V.length), gno: "G" + (100 + g), name: VIRTUAL.visName, sex: k % 2 ? "여" : "남", tel: VIRTUAL.visTel, country, lang, stay: "8/2–8/9", status: "확정", note: VIRTUAL.visMark });
  }
  for (let i = 0; i < V.length; i += 200) await db.insert(S.visitors).values(V.slice(i, i + 200)).onConflictDoNothing();
  console.log("부하 테스트 데이터: 가정 500 · 방문자 1,000 추가");
}
// 시퀀스를 현재 최대 번호 뒤로
await sqlClient`select setval('visitor_pid_seq', greatest(1, coalesce((select max(nullif(regexp_replace(pid,'\\D','','g'),'')::int) from visitors),0)))`;
await sqlClient`select setval('homestay_hid_seq', greatest(1, coalesce((select max(nullif(regexp_replace(hid,'\\D','','g'),'')::int) from homestays),0)))`;
console.log("데모 데이터 입력 완료");
await sqlClient.end();
