// 메뉴(내비게이션) 라벨 — apps/web/src/lib/nav.ts
import type { Shape } from "../../core.js";
import type { nav as ko } from "../ko/nav.js";

export const nav = {
  group: { ops: "Operations", stay: "Lodging · Pilgrims", vol: "Volunteers", comm: "Communication", prayer: "Prayer", admin: "Admin" },
  dash: "Dashboard",
  prep: "D-DAY Prep",
  schedule: "Schedule",
  visitors: "Pilgrims",
  facilities: "Facilities",
  homestays: "Homestays",
  org: "Organization",
  volunteers: "Volunteers",
  notices: "Notices",
  posts: "Board",
  qna: "Pilgrim Q&A",
  places: "Places & Map",
  gori: "Prayer Chain",
  users: "Accounts",
} satisfies Shape<typeof ko>;
