// Google Sheets(기존 Apps Script) → PostgreSQL 1회 이관
//
// 사용법 (둘 중 하나로 원본 지정)
//   node dist/cli/migrate-sheets.js --url "<Apps Script /exec 주소>" --pin "<관리자 PIN>" [--dry-run] [--replace] [--skip-virtual]
//   node dist/cli/migrate-sheets.js --file ./sheets.json [...]
//     sheets.json = 브라우저에서 <exec 주소>?action=read&pin=<PIN> 을 열어 저장한 JSON
//
//   --dry-run      DB에 쓰지 않고 건수·문제 목록만 출력
//   --replace      대상 표를 비우고 다시 채움(없으면 대상 표가 비어 있어야 실행)
//   --skip-virtual 비고에 '가상 …(임시)' 표시가 있는 테스트 데이터 제외
//
// 연결 규칙(기존 앱과 동일): 방문자 숙소 = room(교리실 이름) → hsid(가정 번호) → homestay(대표자명, 동명이면 처음 나오는 가정)
// 연결하지 못한 값은 orphanStay 에 보존하고 migration-report.csv 에 기록
import { writeFileSync, readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { normDate, normSex, VIRTUAL, isSleepRoom } from "@wyd/shared";
import { db, sqlClient } from "../db/client.js";
import * as S from "../db/schema.js";

type Row = Record<string, any>;
const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const flag = (k: string) => args.includes(k);
const DRY = flag("--dry-run"), REPLACE = flag("--replace"), SKIP_VIRTUAL = flag("--skip-virtual");

const report: string[][] = [["표", "번호/이름", "항목", "원래 값", "처리"]];
const note = (t: string, who: string, field: string, val: unknown, action: string) => report.push([t, who, field, String(val ?? ""), action]);

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const n = (v: unknown) => { const x = s(v); if (!x) return null; const k = Number(x.replace(/,/g, "")); return Number.isFinite(k) ? Math.max(0, Math.round(k)) : null; };
const b = (v: unknown) => v === true || ["true", "TRUE", "1", "Y", "예", "O"].includes(s(v));
const oneOf = (t: string, who: string, field: string, v: unknown, allowed: string[], def: string) => {
  const x = s(v); if (!x) return def;
  if (allowed.includes(x)) return x;
  note(t, who, field, x, `허용값 아님 → '${def}'`); return def;
};
const isVirtual = (r: Row) => [VIRTUAL.visMark, VIRTUAL.hsMark, VIRTUAL.volMark].some((m) => s(r.note).includes(m));

async function load(): Promise<Record<string, Row[]>> {
  const file = arg("--file"), url = arg("--url"), pin = arg("--pin");
  let d: any;
  if (file) d = JSON.parse(readFileSync(file, "utf8"));
  else if (url) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ action: "read", pin: pin ?? "" }), redirect: "follow" });
    d = await res.json();
  } else { console.error("--url 또는 --file 을 지정하세요. (파일 맨 위 사용법 참고)"); process.exit(1); }
  if (d && d.ok === false) throw new Error("원본 읽기 실패: " + d.error);
  if (d._masked) throw new Error("연락처가 가려진(masked) 데이터입니다. 관리자 PIN으로 다시 받으세요.");
  return d;
}

async function main() {
  const src = await load();
  const T = (k: string) => ((src[k] as Row[]) || []).filter((r) => r && typeof r === "object" && !(SKIP_VIRTUAL && isVirtual(r)));
  console.log("원본 건수:", Object.fromEntries(Object.keys(src).filter((k) => Array.isArray(src[k])).map((k) => [k, (src[k] as Row[]).length])));

  const run = async (tx: any) => {
    const tables = [S.visitors, S.homestays, S.facilities, S.volunteers, S.departments, S.officers, S.scheduleSlots, S.schedule, S.prep, S.notices, S.posts, S.qna, S.places, S.gori];
    if (REPLACE) {
      // TRUNCATE … CASCADE는 users(homestay_id FK)까지 비우므로 쓰지 않음 → 의존 순서대로 DELETE 후 id 시퀀스 초기화
      const order = ["visitors", "volunteers", "schedule_slots", "schedule", "homestays", "facilities", "departments", "officers", "prep", "notices", "posts", "qna", "places", "gori"];
      for (const t of order) {
        await tx.execute(sql.raw(`delete from ${t}`));
        await tx.execute(sql.raw(`select setval(pg_get_serial_sequence('${t}', 'id'), 1, false)`));
      }
    }
    else for (const t of tables) {
      const [{ c }] = await tx.select({ c: sql<number>`count(*)::int` }).from(t);
      if (c > 0) throw new Error("대상 DB에 이미 데이터가 있습니다. 비우고 다시 채우려면 --replace 를 붙이세요.");
    }

    // 시설: 이름 중복 제거
    const facByName = new Map<string, Row>();
    const facRows: Row[] = [];
    for (const f of T("facilities")) {
      const name = s(f.name); if (!name) { note("facilities", s(f.rno), "name", "", "이름 없음 → 제외"); continue; }
      if (facByName.has(name)) { note("facilities", name, "name", name, "중복 이름 → 제외"); continue; }
      const r = { rno: s(f.rno), name, type: s(f.type), area: s(f.area), cap: n(f.cap), ac: s(f.ac), outlet: s(f.outlet), wheel: s(f.wheel),
        gender: oneOf("facilities", name, "gender", f.gender, ["남", "여", "공용"], "공용"), status: oneOf("facilities", name, "status", f.status, ["가용", "사용중", "점검중"], "가용"), note: s(f.note) };
      facByName.set(name, r); facRows.push(r);
    }
    const facIns = facRows.length ? await tx.insert(S.facilities).values(facRows).returning() : [];
    const facId = new Map<string, { id: number; sleep: boolean }>(facIns.map((f: any) => [f.name, { id: f.id, sleep: isSleepRoom(f) }]));

    // 홈스테이: H번호 중복·빈칸은 새 번호
    const usedHid = new Set<string>(); let maxH = 0;
    T("homestays").forEach((h) => { const m = s(h.hid).match(/\d+/); if (m) maxH = Math.max(maxH, +m[0]); });
    const hsRows: Row[] = T("homestays").map((h) => {
      let hid = s(h.hid);
      if (!hid || usedHid.has(hid)) { const nh = "H" + String(++maxH).padStart(3, "0"); note("homestays", s(h.host), "hid", hid, `→ ${nh}`); hid = nh; }
      usedHid.add(hid);
      return { _srcHid: s(h.hid), hid, host: s(h.host) || "(대표자 미입력)", zone: s(h.zone), addr: s(h.addr), tel: s(h.tel),
        mAdult: n(h.mAdult), fAdult: n(h.fAdult), fStu: n(h.fStu), mStu: n(h.mStu), fYng: n(h.fYng), mYng: n(h.mYng),
        lang: s(h.lang), cap: n(h.cap), period: s(h.period), match: s(h.match),
        status: oneOf("homestays", hid, "status", h.status, ["제안", "확정", "입실", "퇴실"], "제안"), note: s(h.note) };
    });
    const hsIns = hsRows.length ? await tx.insert(S.homestays).values(hsRows.map(({ _srcHid, ...r }) => r)).returning() : [];
    const hsByHid = new Map<string, number>(), hsByHost = new Map<string, number>();
    hsIns.forEach((h: any, i: number) => {
      const srcHid = hsRows[i]._srcHid; if (srcHid && !hsByHid.has(srcHid)) hsByHid.set(srcHid, h.id);
      if (h.host && !hsByHost.has(h.host)) hsByHost.set(h.host, h.id);
    });

    // 분과·구역
    const depSeen = new Set<string>();
    const depRows = T("departments").filter((d) => { const k = s(d.name); if (!k || depSeen.has(k)) return false; depSeen.add(k); return true; })
      .map((d, i) => ({ name: s(d.name), kind: oneOf("departments", s(d.name), "kind", d.kind, ["분과", "구역"], "분과"), task: s(d.task), key: b(d.key), sort: n(d.order) ?? i }));
    const depIns = depRows.length ? await tx.insert(S.departments).values(depRows).returning() : [];
    const depId = new Map<string, number>(depIns.map((d: any) => [d.name, d.id]));

    // 봉사자
    const volRows = T("volunteers").filter((v) => s(v.name)).map((v) => {
      const dept = s(v.dept); const deptId = dept ? depId.get(dept) ?? null : null;
      let nt = s(v.note);
      if (dept && deptId == null) { nt = [nt, `참고 분과: ${dept}`].filter(Boolean).join(" / "); note("volunteers", s(v.name), "dept", dept, "분과 표에 없음 → 비고에 보존"); }
      return { name: s(v.name), tel: s(v.tel), team: s(v.team), role: s(v.role), task: s(v.task), langs: s(v.langs), org: s(v.org), deptId, note: nt };
    });
    for (let i = 0; i < volRows.length; i += 500) await tx.insert(S.volunteers).values(volRows.slice(i, i + 500));

    // 방문자
    const usedPid = new Set<string>(); let maxP = 0;
    T("visitors").forEach((v) => { const m = s(v.pid).match(/\d+/); if (m) maxP = Math.max(maxP, +m[0]); });
    let linkedRoom = 0, linkedHs = 0, orphan = 0;
    const visRows = T("visitors").map((v) => {
      let pid = s(v.pid);
      if (!pid || usedPid.has(pid)) { const np = "P" + String(++maxP).padStart(3, "0"); note("visitors", s(v.name), "pid", pid, `→ ${np}`); pid = np; }
      usedPid.add(pid);
      let facilityId: number | null = null, homestayId: number | null = null, orphanStay = "";
      const room = s(v.room), hsid = s(v.hsid), host = s(v.homestay);
      if (room) {
        const f = facId.get(room);
        if (f && f.sleep) { facilityId = f.id; linkedRoom++; } else { orphanStay = "교리실:" + room; orphan++; note("visitors", pid, "room", room, "성당시설에 없는 숙박 공간 → 연결 끊김"); }
      } else if (hsid) {
        const id = hsByHid.get(hsid);
        if (id) { homestayId = id; linkedHs++; } else { orphanStay = "가정:" + hsid + (host ? " " + host : ""); orphan++; note("visitors", pid, "hsid", hsid, "없는 가정 번호 → 연결 끊김"); }
      } else if (host) {
        const id = hsByHost.get(host);
        if (id) { homestayId = id; linkedHs++; } else { orphanStay = "가정:" + host; orphan++; note("visitors", pid, "homestay", host, "없는 대표자명 → 연결 끊김"); }
      }
      const sex = normSex(v.sex); if (s(v.sex) && !sex) note("visitors", pid, "sex", v.sex, "성별 해석 불가 → 비움");
      return { pid, gno: s(v.gno), name: s(v.name), sex, tel: s(v.tel), country: s(v.country), lang: s(v.lang), facilityId, homestayId, orphanStay,
        stay: s(v.stay), role: s(v.role), status: oneOf("visitors", pid, "status", v.status, ["확정", "변동중", "대기"], "확정"), note: s(v.note) };
    });
    for (let i = 0; i < visRows.length; i += 500) await tx.insert(S.visitors).values(visRows.slice(i, i + 500));

    // 나머지
    const officers = T("officers").map((o, i) => ({ slot: s(o.slot), name: s(o.name), tel: s(o.tel), note: s(o.note), sort: i }));
    if (officers.length) await tx.insert(S.officers).values(officers);
    for (const [i, d] of T("schedule").entries()) {
      const [row] = await tx.insert(S.schedule).values({ date: normDate(d.date), event: s(d.event), prep: s(d.prep), sort: i }).returning();
      let slots = d.slots; if (typeof slots === "string") { try { slots = JSON.parse(slots); } catch { slots = []; note("schedule", s(d.date), "slots", d.slots, "JSON 해석 불가 → 비움"); } }
      if (Array.isArray(slots) && slots.length) await tx.insert(S.scheduleSlots).values(slots.map((x: Row, j: number) => ({ scheduleId: row.id, time: s(x.time), text: s(x.text), who: s(x.who), sort: j })));
    }
    const prep = T("prep").map((p, i) => ({ phase: s(p.phase), title: s(p.title), detail: s(p.detail), ref: s(p.ref), done: b(p.done), sort: i }));
    if (prep.length) await tx.insert(S.prep).values(prep);
    for (const t of ["notices", "posts"] as const) {
      const rows = T(t).map((r) => ({ date: normDate(r.date), title: s(r.title), body: s(r.body), author: s(r.author) }));
      if (rows.length) await tx.insert(S[t]).values(rows);
    }
    const qna = T("qna").map((q) => ({ date: normDate(q.date), author: s(q.author), q: s(q.q), a: s(q.a), answered: b(q.answered) || !!s(q.a) }));
    if (qna.length) await tx.insert(S.qna).values(qna);
    const places = T("places").map((p, i) => ({ cat: oneOf("places", s(p.name), "cat", p.cat, ["성당", "교통", "대회장", "의료", "편의", "기타"], "기타"),
      name: s(p.name), nameEn: s(p.nameEn), addr: s(p.addr), addrEn: s(p.addrEn), query: s(p.query), desc: s(p.desc), descEn: s(p.descEn), sort: i }));
    if (places.length) await tx.insert(S.places).values(places);
    const gori = T("gori").map((g) => ({ date: normDate(g.date), org: s(g.org), rep: s(g.rep), note: s(g.note), photo: s(g.photo) }))
      .filter((g) => { const ok = /^\d{4}-\d{2}-\d{2}$/.test(g.date); if (!ok) note("gori", g.org, "date", g.date, "날짜 형식 아님 → 제외"); return ok; });
    if (gori.length) await tx.insert(S.gori).values(gori);

    await tx.execute(sql`select setval('visitor_pid_seq', greatest(1, ${maxP}))`);
    await tx.execute(sql`select setval('homestay_hid_seq', greatest(1, ${maxH}))`);

    console.log(`\n적재: 시설 ${facIns.length} · 가정 ${hsIns.length} · 분과 ${depIns.length} · 봉사자 ${volRows.length} · 방문자 ${visRows.length}` +
      ` (교리실 ${linkedRoom} · 홈스테이 ${linkedHs} · 연결 끊김 ${orphan} · 미배정 ${visRows.length - linkedRoom - linkedHs - orphan})` +
      ` · 임원 ${officers.length} · 일정 ${T("schedule").length} · 준비 ${prep.length} · 공지 ${T("notices").length} · 게시글 ${T("posts").length} · Q&A ${qna.length} · 장소 ${places.length} · 고리기도 ${gori.length}`);
    if (DRY) throw new Error("__DRY_RUN__");
  };

  try { await db.transaction(run); console.log("✓ 이관 완료"); }
  catch (e) { if ((e as Error).message === "__DRY_RUN__") console.log("(dry-run: 되돌림 — DB 변경 없음)"); else throw e; }
  if (report.length > 1) {
    writeFileSync("migration-report.csv", "﻿" + report.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n"));
    console.log(`확인 필요 ${report.length - 1}건 → migration-report.csv`);
  }
  await sqlClient.end();
}
main().catch(async (e) => { console.error("✗", (e as Error).message); await sqlClient.end(); process.exit(1); });
