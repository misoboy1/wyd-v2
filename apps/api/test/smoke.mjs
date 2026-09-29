// API 통합·동시성 스모크 테스트 — 실행 중인 서버 대상
// 사용: API=http://127.0.0.1:3000/api ADMIN_USERNAME=admin ADMIN_PASSWORD=... node test/smoke.mjs
const A = process.env.API ?? "http://127.0.0.1:3000/api";
let cookie = "";
const call = async (method, path, body, opts = {}) => {
  const r = await fetch(A + path, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), "x-wyd": "1", cookie: opts.cookie ?? cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = r.headers.getSetCookie?.() ?? [];
  if (sc.length && !opts.cookie) cookie = sc.map((c) => c.split(";")[0]).join("; ");
  let j = null;
  try {
    j = await r.json();
  } catch {}
  return { status: r.status, body: j };
};
let fail = 0;
const ok = (cond, msg, extra) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) {
    fail++;
    if (extra !== undefined) console.log("   →", JSON.stringify(extra).slice(0, 300));
  }
};

const login = await call("POST", "/auth/login", {
  username: process.env.ADMIN_USERNAME ?? "admin",
  password: process.env.ADMIN_PASSWORD ?? "admin1234!",
});
ok(login.status === 200, "관리자 로그인");

// 1) 낙관적 잠금
const v = (await call("POST", "/t/visitors", { name: "Smoke Test", sex: "여", stay: "8/2–8/9" })).body;
ok(v && /^P\d+/.test(v.pid), "방문자 생성 + P번호 자동 발급", v);
const u1 = await call("PATCH", `/t/visitors/${v.id}`, { version: v.version, note: "첫 수정" });
const u2 = await call("PATCH", `/t/visitors/${v.id}`, { version: v.version, note: "옛 버전으로 수정" });
ok(u1.status === 200 && u2.status === 409 && u2.body.error === "CONFLICT", "같은 버전으로 두 번 수정 → 두 번째는 409 CONFLICT", u2.body);

// 2) 성별 규칙
const facs = (await call("GET", "/t/facilities")).body;
const male = facs.find((f) => f.gender === "남" && f.type.includes("숙박"));
const bad = await call("PATCH", `/t/visitors/${v.id}`, { version: u1.body.version, facilityId: male.id });
ok(bad.status === 422 && bad.body.error === "STAY", `여성 → 남성 전용 '${male.name}' 배정 거부`, bad.body);

// 3) 숙박자 있는 시설 점검중 전환 차단
const occupied = facs.find((f) => f.name === "진실");
const pol = await call("PATCH", `/t/facilities/${occupied.id}`, { version: occupied.version, status: "점검중" });
ok(pol.status === 422 && pol.body.error === "CAPACITY", "숙박자 있는 교리실 '점검중' 전환 차단", pol.body);

// 4) 동시 배정: 정원 4 교리실에 50명 동시 요청 → 정확히 4명만 성공
const room = (
  await call("POST", "/t/facilities", { name: "동시성테스트실-" + Date.now(), type: "숙박 교리실", cap: 4, gender: "남", status: "가용" })
).body;
const people = [];
for (let i = 0; i < 50; i++)
  people.push((await call("POST", "/t/visitors", { name: "동시" + i, sex: "남", stay: "8/2–8/9", note: "smoke" })).body);
const res = await Promise.all(people.map((p) => call("PATCH", `/t/visitors/${p.id}`, { version: p.version, facilityId: room.id })));
const okN = res.filter((r) => r.status === 200).length,
  stayN = res.filter((r) => r.body?.error === "STAY").length;
ok(okN === 4 && stayN === 46, `동시 50건 → 성공 ${okN} / 정원 초과 거부 ${stayN} (기대 4/46)`);

// 5) 일괄 배정 API도 같은 규칙
const room2 = (
  await call("POST", "/t/facilities", { name: "일괄테스트실-" + Date.now(), type: "숙박 교리실", cap: 3, gender: "공용", status: "가용" })
).body;
const fresh = (await call("GET", "/t/visitors")).body.filter((x) => x.note === "smoke" && !x.facilityId).slice(0, 5);
const asg = await call("POST", "/visitors/assign", {
  changes: fresh.map((p) => ({ id: p.id, version: p.version, facilityId: room2.id, homestayId: null })),
});
ok(
  asg.body.results.filter((r) => r.ok).length === 3,
  "일괄 배정 5명 → 정원 3명만 성공, 나머지 행별 오류",
  asg.body.results.map((r) => r.code),
);

// 6) 시설 삭제 → 배정 방문자 자동 미배정
const del = await call("DELETE", `/t/facilities/${room.id}?version=${room.version}`);
ok(del.status === 200 && del.body.cleared === 4, "시설 삭제 시 배정 4명 자동 해제", del.body);

// 7) 비로그인: 공개 Q&A 질문만 가능, 답변 필드 무시
const q = await call("POST", "/qna/ask", { author: "Test", q: "질문", a: "해킹 답변", answered: true }, { cookie: "" });
ok(q.status === 201 && q.body.a === "" && q.body.answered === false, "공개 질문 등록(답변 필드 무시)", q.body);
const anonW = await call("POST", "/t/notices", { title: "x" }, { cookie: "" });
ok(anonW.status === 401, "비로그인 공지 작성 거부", anonW.body);

// 정리
const mine = (await call("GET", "/t/visitors")).body.filter((x) => x.note === "smoke" || x.name === "Smoke Test");
await Promise.all(mine.map((x) => call("DELETE", `/t/visitors/${x.id}`)));
await call("DELETE", `/t/facilities/${room2.id}`);
await call("DELETE", `/t/qna/${q.body.id}`);
console.log(fail ? `\n실패 ${fail}건` : "\n모두 통과");
process.exit(fail ? 1 : 0);
