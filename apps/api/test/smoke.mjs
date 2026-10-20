// API 통합·동시성 스모크 테스트 — 실행 중인 서버 대상
// 사용: API=http://127.0.0.1:3000/api ADMIN_USERNAME=admin ADMIN_PASSWORD=... node test/smoke.mjs
import { teamInfo } from "@wyd/shared";

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
  } catch {
    /* 본문 없는 응답 */
  }
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

// 7-1) 조회 ETag — 내용이 같으면 304(본문 없음), 응답은 사용자별(private)
const head = (path, headers = {}) => fetch(A + path, { headers: { cookie, ...headers } });
const n1 = await head("/t/notices");
const etag = n1.headers.get("etag");
ok(!!etag && n1.headers.get("cache-control") === "private, no-cache", "표 조회에 ETag + Cache-Control: private, no-cache", {
  etag,
  cc: n1.headers.get("cache-control"),
});
const n2 = await head("/t/notices", { "if-none-match": etag });
ok(n2.status === 304 && (await n2.text()) === "", "같은 ETag로 재요청 → 304 빈 본문", n2.status);
const [dAdmin, dAnon] = await Promise.all([head("/data"), fetch(A + "/data")]);
ok(dAdmin.headers.get("etag") !== dAnon.headers.get("etag"), "로그인/비로그인 /data ETag가 서로 다름(사용자별 응답)");

// 8) 역할별 권한 (TEST-02) — host·dept 임시 계정. 계정은 중간에 실패해도 finally에서 삭제
const hs = (await call("GET", "/t/homestays")).body;
const [myHs, otherHs] = [hs[0], hs[1]];
const vols = (await call("GET", "/t/volunteers")).body;
// 서버(sameTeam)와 같은 기준: 별칭까지 정규화한 팀으로 비교
const otherTeamVol = vols.find((x) => teamInfo(x).team !== "환대팀");
const outsideVisitor = (await call("GET", "/t/visitors")).body.find((x) => x.homestayId !== myHs?.id);
const stamp = Date.now();
const mk = async (role, extra) => {
  const r = await call("POST", "/users", { username: `t${role}${stamp}`, name: role, role, password: "test-pass-1234", ...extra });
  ok(r.status === 201 || r.status === 200, `임시 ${role} 계정 생성`, r.body);
  return r.body;
};
const loginAs = async (u) => {
  const r = await fetch(A + "/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-wyd": "1" },
    body: JSON.stringify({ username: u.username, password: "test-pass-1234" }),
  });
  ok(r.status === 200, `${u.role} 로그인`, r.status);
  return r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
};
const temp = [];
try {
  if (!myHs || !otherHs) console.log("- host 권한 검사 건너뜀: 홈스테이 가정이 2곳 이상 필요");
  else {
    const hostU = await mk("host", { homestayId: myHs.id });
    temp.push(hostU);
    const hostC = await loginAs(hostU);
    const leak = await call("PATCH", `/t/homestays/${otherHs.id}`, { version: -1 }, { cookie: hostC });
    ok(
      leak.status === 404 && !JSON.stringify(leak.body).includes(otherHs.addr || "@@"),
      "host: 다른 가정에 버전 충돌을 유도해도 개인정보 없이 404",
      leak.body,
    );
    if (!outsideVisitor) console.log("- host 방문자 삭제 검사 건너뜀: 다른 가정 방문자 없음");
    else {
      const leakDel = await call("DELETE", `/t/visitors/${outsideVisitor.id}?version=-1`, undefined, { cookie: hostC });
      ok([403, 404].includes(leakDel.status) && !leakDel.body?.detail, "host: 권한 밖 방문자 삭제 시도 → 행 정보 없이 거부", leakDel.body);
    }
    const hostVols = await call("GET", "/t/volunteers", undefined, { cookie: hostC });
    ok(hostVols.status === 200 && hostVols.body.length === 0, "host: 봉사자 명단(연락처) 받지 않음", hostVols.body?.length);
    const hostHs = await call("GET", "/t/homestays", undefined, { cookie: hostC });
    ok(hostHs.body.length === 1 && hostHs.body[0].id === myHs.id, "host: 자기 가정만 조회");
    const hostOtherMsg = await call(
      "POST",
      "/messages",
      { title: "x", body: "x", to: [{ k: "homestay", id: otherHs.id }], dryRun: true },
      { cookie: hostC },
    );
    ok(hostOtherMsg.status === 403, "host: 다른 가정에 메시지 → 403", hostOtherMsg.body);
    if (outsideVisitor) {
      const hostVisMsg = await call(
        "POST",
        "/messages",
        { title: "x", body: "x", to: [{ k: "visitor", id: outsideVisitor.id }], dryRun: true },
        { cookie: hostC },
      );
      ok(hostVisMsg.status === 403, "host: 다른 가정 순례자에게 메시지 → 403", hostVisMsg.body);
    }
  }
  const deptU = await mk("dept", { team: "환대팀" });
  temp.push(deptU);
  const deptC = await loginAs(deptU);
  if (!otherTeamVol) console.log("- dept 다른 팀 수정 검사 건너뜀: 환대팀 외 봉사자 없음");
  else {
    const deptOther = await call("PATCH", `/t/volunteers/${otherTeamVol.id}`, { version: -1, note: "x" }, { cookie: deptC });
    ok(deptOther.status === 403 && !deptOther.body?.detail, "dept: 다른 팀 봉사자 수정 → 403(행 정보 없음)", deptOther.body);
  }
  const deptNotice = await call("POST", "/t/notices", { title: "x" }, { cookie: deptC });
  ok(deptNotice.status === 403, "dept: 공지 작성 거부", deptNotice.body);

  // 8-1) 게시글 댓글: 로그인 사용자 작성, 수정·삭제는 본인(또는 관리자)만, 글 삭제 시 함께 삭제
  const post = (await call("POST", "/t/posts", { title: "smoke 댓글 글", body: "x" })).body;
  const cAdmin = await call("POST", "/t/postComments", { postId: post.id, body: "관리자 댓글", authorId: 999, author: "가짜 이름" });
  ok(
    cAdmin.status === 201 && cAdmin.body.authorId === login.body?.user?.id && cAdmin.body.author === login.body?.user?.name,
    "댓글 작성 + authorId·작성자 이름은 서버가 설정(위조 무시)",
    cAdmin.body,
  );
  const cNoPost = await call("POST", "/t/postComments", { postId: 2147483647, body: "x" });
  ok(cNoPost.status === 404, "없는 글에 댓글 → 404", cNoPost.body);
  const cAnon = await call("POST", "/t/postComments", { postId: post.id, body: "x" }, { cookie: "" });
  ok(cAnon.status === 401, "비로그인 댓글 작성 거부", cAnon.body);
  const cDeptEdit = await call(
    "PATCH",
    `/t/postComments/${cAdmin.body.id}`,
    { version: cAdmin.body.version, body: "y" },
    { cookie: deptC },
  );
  ok(cDeptEdit.status === 403, "dept: 남의 댓글 수정 → 403", cDeptEdit.body);
  const cDept = await call("POST", "/t/postComments", { postId: post.id, body: "dept 댓글" }, { cookie: deptC });
  ok(cDept.status === 201 && cDept.body.authorId === deptU.id, "dept: 댓글 작성", cDept.body);
  const cMove = await call(
    "PATCH",
    `/t/postComments/${cDept.body.id}`,
    { version: cDept.body.version, postId: 1, body: "수정" },
    { cookie: deptC },
  );
  ok(
    cMove.status === 200 && cMove.body.postId === post.id && cMove.body.body === "수정",
    "dept: 본인 댓글 수정(다른 글로 이동 불가)",
    cMove.body,
  );
  const cDeptDel = await call("DELETE", `/t/postComments/${cDept.body.id}?version=${cMove.body.version}`, undefined, { cookie: deptC });
  ok(cDeptDel.status === 200, "dept: 본인 댓글 삭제", cDeptDel.body);
  await call("DELETE", `/t/posts/${post.id}?version=${post.version}`);
  const left = (await call("GET", "/t/postComments")).body.filter((c) => c.postId === post.id);
  ok(left.length === 0, "글 삭제 → 댓글도 함께 삭제", left);

  // 8-2) 메시지: 대상자에게만 보임·읽음·권한·SSE 대상 한정·개인 링크·푸시 구독 주소 제한
  // SSE 한 연결을 열어 두고 ms 동안 받은 change 이벤트를 모음
  const listen = (c, ms = 1500) =>
    new Promise((resolve) => {
      const ac = new AbortController(),
        got = [];
      setTimeout(() => {
        ac.abort();
        resolve(got);
      }, ms);
      fetch(A + "/events", { headers: { cookie: c }, signal: ac.signal })
        .then(async (r) => {
          const rd = r.body.getReader(),
            dec = new TextDecoder();
          let buf = "";
          for (;;) {
            const { value, done } = await rd.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            for (const m of buf.matchAll(/event: change\n(?:id: .*\n)?data: (.+)\n/g)) got.push(JSON.parse(m[1]));
            buf = buf.slice(buf.lastIndexOf("\n\n") + 1);
          }
        })
        .catch(() => {});
    });
  const dry = await call("POST", "/messages", { title: "t", body: "b", to: [{ k: "user", id: deptU.id }], dryRun: true });
  ok(dry.status === 201 && dry.body.recipients === 1, "메시지 dryRun: 받을 인원만 계산", dry.body);
  const deptSse = listen(deptC),
    anonSse = listen("");
  await new Promise((r) => setTimeout(r, 300)); // 구독이 붙은 뒤 보냄
  const sent = await call("POST", "/messages", { title: "smoke 메시지", body: "본문", to: [{ k: "user", id: deptU.id }] });
  ok(sent.status === 201 && sent.body.recipients === 1, "관리자 → 분과 계정 메시지 보내기", sent.body);
  const [deptEv, anonEv] = await Promise.all([deptSse, anonSse]);
  ok(
    deptEv.some((e) => e.tables.includes("inbox") && e.msg?.id === sent.body.id && !("to" in e)),
    "SSE: 받는 사람에게 inbox 이벤트(받는 사람 목록은 빼고)",
    deptEv,
  );
  ok(!anonEv.some((e) => e.tables.includes("inbox")), "SSE: 다른 연결에는 inbox 이벤트 없음", anonEv);
  const dIn = await call("GET", "/messages/inbox", undefined, { cookie: deptC });
  const got = dIn.body.find((m) => m.id === sent.body.id);
  ok(got && got.readAt === null && got.sender === login.body?.user?.name, "받는 사람 수신함에 안읽음으로 보임", dIn.body);
  const aIn = await call("GET", "/messages/inbox");
  ok(!aIn.body.some((m) => m.id === sent.body.id), "보낸 사람(비대상) 수신함에는 없음");
  const rd = await call("POST", "/messages/read", { ids: [sent.body.id] }, { cookie: deptC });
  ok(rd.body.updated === 1, "읽음 처리", rd.body);
  const st = (await call("GET", "/messages/sent")).body.find((m) => m.id === sent.body.id);
  ok(st && st.total === 1 && st.read === 1, "보낸 목록: 1/1명 읽음", st);
  const deptAll = await call("POST", "/messages", { title: "x", body: "x", to: [{ k: "allVisitors" }] }, { cookie: deptC });
  ok(deptAll.status === 403, "dept: 모든 순례자에게 보내기 → 403", deptAll.body);
  const deptUp = await call("POST", "/messages", { title: "문의", body: "x", to: [{ k: "role", role: "admin" }] }, { cookie: deptC });
  ok(deptUp.status === 201 && deptUp.body.recipients >= 1, "dept: 관리자 전체에게 보내기 허용", deptUp.body);
  if (otherTeamVol) {
    const deptOtherMsg = await call(
      "POST",
      "/messages",
      { title: "x", body: "x", to: [{ k: "volunteer", id: otherTeamVol.id }], dryRun: true },
      { cookie: deptC },
    );
    ok(deptOtherMsg.status === 403, "dept: 다른 팀 봉사자에게 메시지 → 403", deptOtherMsg.body);
  }
  const deptOtherTeam = await call(
    "POST",
    "/messages",
    { title: "x", body: "x", to: [{ k: "team", team: "시설팀" }], dryRun: true },
    { cookie: deptC },
  );
  ok(deptOtherTeam.status === 403, "dept: 다른 팀 전체에게 메시지 → 403", deptOtherTeam.body);
  // 팀 이름이 조직도에 없는 계정끼리(둘 다 '팀 미배정')를 같은 팀으로 보지 않음
  const oddU = await mk("dept", { username: `tdeptodd${stamp}`, team: "없는팀X" + stamp });
  temp.push(oddU);
  const oddC = await loginAs(oddU);
  const oddV = (await call("POST", "/t/volunteers", { name: "smoke 미배정", team: "다른없는팀Y" })).body;
  const oddMsg = await call(
    "POST",
    "/messages",
    { title: "x", body: "x", to: [{ k: "volunteer", id: oddV.id }], dryRun: true },
    { cookie: oddC },
  );
  ok(oddMsg.status === 403, "dept(팀 미배정): 다른 미배정 봉사자에게 메시지 → 403", oddMsg.body);
  const oddTeam = await call(
    "POST",
    "/messages",
    { title: "x", body: "x", to: [{ k: "team", team: "다른없는팀Y" }], dryRun: true },
    { cookie: oddC },
  );
  ok(oddTeam.status === 403, "dept(팀 미배정): 미배정 팀 전체 → 403", oddTeam.body);
  await call("DELETE", `/t/volunteers/${oddV.id}?version=${oddV.version}`);
  const deptDel = await call("DELETE", `/messages/${sent.body.id}`, undefined, { cookie: deptC });
  ok(deptDel.status === 403, "dept: 남이 보낸 메시지 삭제 → 403", deptDel.body);
  const badLink = await call("POST", "/messages", {
    title: "x",
    body: "x",
    link: "javascript:alert(1)",
    to: [{ k: "user", id: deptU.id }],
  });
  ok(badLink.status === 400, "javascript: 링크 거부", badLink.body);
  const anonMsg = await call("POST", "/messages", { title: "x", body: "x", to: [{ k: "role", role: "admin" }] }, { cookie: "" });
  ok(anonMsg.status === 401, "비로그인 메시지 보내기 거부", anonMsg.body);
  await call("DELETE", `/messages/${sent.body.id}`);
  const dIn2 = await call("GET", "/messages/inbox", undefined, { cookie: deptC });
  ok(!dIn2.body.some((m) => m.id === sent.body.id), "메시지 삭제 → 받은 사람 수신함에서도 사라짐");
  await call("DELETE", `/messages/${deptUp.body.id}`);

  // 개인 링크(계정 없는 순례자)
  const pv = (await call("POST", "/t/visitors", { name: "Smoke Link", sex: "여", note: "smoke" })).body;
  const iss = await call("POST", "/links", { kind: "visitor", ids: [pv.id] });
  const token = iss.body?.[0]?.token;
  ok(iss.status === 201 && typeof token === "string" && token.length >= 40, "개인 링크 발급(토큰은 발급 응답에만)", iss.body);
  const deptIss = await call("POST", "/links", { kind: "visitor", ids: [pv.id] }, { cookie: deptC });
  ok(deptIss.status === 403, "dept: 개인 링크 발급 거부", deptIss.body);
  const linkRes = await fetch(A + "/p/link", {
    method: "POST",
    headers: { "content-type": "application/json", "x-wyd": "1" },
    body: JSON.stringify({ token }),
  });
  const pc = (linkRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  ok(linkRes.status === 200 && pc.startsWith("wyd_pt="), "QR 링크로 기기 연결 → 쿠키 발급", linkRes.status);
  const pme = await call("GET", "/p/me", undefined, { cookie: pc });
  ok(pme.body?.person?.id === pv.id && pme.body.person.kind === "visitor", "개인 링크 신원 확인", pme.body);
  const pSse = listen(pc);
  await new Promise((r) => setTimeout(r, 300));
  const toV = await call("POST", "/messages", { title: "순례자 안내", body: "x", to: [{ k: "visitor", id: pv.id }] });
  ok(
    (await pSse).some((e) => e.msg?.id === toV.body.id),
    "SSE: 개인 링크 연결에도 inbox 이벤트",
  );
  const pIn = await call("GET", "/p/inbox", undefined, { cookie: pc });
  ok(pIn.status === 200 && pIn.body.some((m) => m.id === toV.body.id), "순례자 수신함에 메시지", pIn.body);
  const noLink = await call("GET", "/p/inbox", undefined, { cookie: "" });
  ok(noLink.status === 403, "개인 링크 없이 /p/inbox → 403", noLink.body);
  const wrong = await call("POST", "/p/link", { token: "x".repeat(43) }, { cookie: "" });
  ok(wrong.status === 403, "틀린 토큰 → 403", wrong.body);
  const evil = await call("POST", "/push/subscribe", { endpoint: "https://127.0.0.1/x", keys: { p256dh: "a", auth: "b" } }, { cookie: pc });
  ok(evil.status === 400, "푸시 구독: 브라우저 푸시 서비스가 아닌 주소 거부(SSRF 방지)", evil.body);
  const fcm = { endpoint: `https://fcm.googleapis.com/fcm/send/smoke-${stamp}`, keys: { p256dh: "a", auth: "b" } };
  const subOk = await call("POST", "/push/subscribe", fcm, { cookie: pc });
  ok(subOk.status === 200 || subOk.status === 503, "푸시 구독 등록(서버 VAPID 없으면 503)", subOk.body);
  await call("POST", "/push/unsubscribe", { endpoint: fcm.endpoint }, { cookie: pc });
  const re = await call("POST", "/links", { kind: "visitor", ids: [pv.id] });
  const oldTok = await call("GET", "/p/me", undefined, { cookie: pc });
  ok(re.status === 201 && oldTok.body?.person === null, "재발급 → 이전 링크 무효", oldTok.body);
  // 새 링크로 다시 연결한 뒤 폐기 → 수신함 403
  const link2 = await fetch(A + "/p/link", {
    method: "POST",
    headers: { "content-type": "application/json", "x-wyd": "1" },
    body: JSON.stringify({ token: re.body[0].token }),
  });
  const pc2 = (link2.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const before = await call("GET", "/p/inbox", undefined, { cookie: pc2 });
  const rv = await call("DELETE", `/links/visitor/${pv.id}`);
  const after = await call("GET", "/p/inbox", undefined, { cookie: pc2 });
  ok(before.status === 200 && rv.status === 200 && after.status === 403, "링크 폐기 → 그 기기 수신함 403", [
    before.status,
    rv.status,
    after.status,
  ]);
  await call("DELETE", `/messages/${toV.body.id}`);
} finally {
  for (const u of temp) if (u?.id) await call("DELETE", `/users/${u.id}`);
}

// 9) 로그인 대입 방어: 한 계정에 동시 요청 → 대기열 상한(5)을 넘는 요청은 즉시 429
// 없는 계정명이라 계정 잠금 영향 없음. IP 한도(30회/15분)에는 대기열에 들어간 5건만 기록되므로 15분에 몇 번 반복해도 됨
const burst = await Promise.all(
  Array.from({ length: 8 }, () => call("POST", "/auth/login", { username: `nobody${stamp}`, password: "wrong-pass" }, { cookie: "" })),
);
const codes = burst.map((r) => r.status);
ok(!codes.includes(200) && codes.filter((c) => c === 429).length >= 1, "동시 로그인 8건 → 대기열 초과분 429", codes);

// 정리
const mine = (await call("GET", "/t/visitors")).body.filter((x) => x.note === "smoke" || x.name === "Smoke Test");
await Promise.all(mine.map((x) => call("DELETE", `/t/visitors/${x.id}`)));
await call("DELETE", `/t/facilities/${room2.id}`);
await call("DELETE", `/t/qna/${q.body.id}`);
console.log(fail ? `\n실패 ${fail}건` : "\n모두 통과");
process.exit(fail ? 1 : 0);
