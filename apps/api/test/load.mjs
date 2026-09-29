// 간이 부하 테스트(k6 없이): 동시 N명, 조회 80% / 수정 20%, 지정 시간 동안
// 사용: API=http://127.0.0.1:3000/api VUS=50 SECS=30 node test/load.mjs
const A = process.env.API ?? "http://127.0.0.1:3000/api", VUS = +(process.env.VUS ?? 50), SECS = +(process.env.SECS ?? 30);
const login = await fetch(A + "/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-wyd": "1" }, body: JSON.stringify({ username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "admin1234!" }) });
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const lat = { read: [], write: [] }; let err = 0, conflict = 0;
const tables = ["visitors", "homestays", "facilities", "volunteers", "gori"];
const end = Date.now() + SECS * 1000;
async function vu() {
  while (Date.now() < end) {
    const t0 = performance.now();
    if (Math.random() < 0.8) {
      const r = await fetch(`${A}/t/${tables[Math.floor(Math.random() * tables.length)]}`, { headers: { cookie } });
      await r.arrayBuffer(); if (!r.ok) err++; lat.read.push(performance.now() - t0);
    } else {
      const list = await (await fetch(`${A}/t/visitors`, { headers: { cookie } })).json();
      const v = list[Math.floor(Math.random() * list.length)];
      const t1 = performance.now();
      const r = await fetch(`${A}/t/visitors/${v.id}`, { method: "PATCH", headers: { cookie, "content-type": "application/json", "x-wyd": "1" }, body: JSON.stringify({ version: v.version, note: v.note }) });
      await r.arrayBuffer(); if (r.status === 409) conflict++; else if (!r.ok) err++; lat.write.push(performance.now() - t1);
    }
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
  }
}
await Promise.all(Array.from({ length: VUS }, vu));
const p = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * q)].toFixed(0) : "-"; };
console.log(`동시 ${VUS}명 · ${SECS}초 · 조회 ${lat.read.length}건 (p50 ${p(lat.read, .5)}ms, p95 ${p(lat.read, .95)}ms) · 수정 ${lat.write.length}건 (p50 ${p(lat.write, .5)}ms, p95 ${p(lat.write, .95)}ms) · 충돌감지 ${conflict} · 오류 ${err}`);
