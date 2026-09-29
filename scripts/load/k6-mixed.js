// k6 부하 테스트: 동시 사용자 50명이 조회(80%)·방문자 메모 수정(20%)
// 실행: k6 run -e BASE=https://<ngrok 도메인> -e USER=admin -e PASS=... scripts/load/k6-mixed.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 50,
  duration: "2m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:read}": ["p(95)<500"],
    "http_req_duration{kind:write}": ["p(95)<800"],
  },
};
const BASE = __ENV.BASE || "http://127.0.0.1:8080";
const H = { "content-type": "application/json", "x-wyd": "1", "ngrok-skip-browser-warning": "1" };

export function setup() {
  const r = http.post(`${BASE}/api/auth/login`, JSON.stringify({ username: __ENV.USER, password: __ENV.PASS }), { headers: H });
  check(r, { "login ok": (x) => x.status === 200 });
  const at = r.cookies.wyd_at[0].value;
  return { cookie: `wyd_at=${at}` };
}

export default function (ctx) {
  const h = { ...H, cookie: ctx.cookie };
  if (Math.random() < 0.8) {
    const t = ["visitors", "homestays", "facilities", "volunteers", "gori"][Math.floor(Math.random() * 5)];
    const r = http.get(`${BASE}/api/t/${t}`, { headers: h, tags: { kind: "read" } });
    check(r, { "read 200": (x) => x.status === 200 });
  } else {
    const list = http.get(`${BASE}/api/t/visitors`, { headers: h, tags: { kind: "read" } }).json();
    const v = list[Math.floor(Math.random() * list.length)];
    const r = http.patch(`${BASE}/api/t/visitors/${v.id}`, JSON.stringify({ version: v.version, note: v.note }), {
      headers: h,
      tags: { kind: "write" },
    });
    check(r, { "write 200/409": (x) => x.status === 200 || x.status === 409 }); // 409 = 동시 수정 감지(정상)
  }
  sleep(1 + Math.random());
}
