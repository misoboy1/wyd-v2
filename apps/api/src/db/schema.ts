// PostgreSQL 스키마 — 기존 Google Sheets 13개 표를 정규화.
// 모든 업무 테이블: version(낙관적 잠금, 기존 _upd 대체) · updated_at · updated_by
import { sql } from "drizzle-orm";
import {
  pgTable,
  pgSequence,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  bigint,
  date,
} from "drizzle-orm/pg-core";

const audit = {
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer("updated_by"),
};
const t = (name: string) => text(name).notNull().default("");

export const facilities = pgTable(
  "facilities",
  {
    id: serial("id").primaryKey(),
    rno: t("rno"),
    name: text("name").notNull(),
    type: t("type"),
    area: t("area"),
    cap: integer("cap"),
    ac: t("ac"),
    outlet: t("outlet"),
    wheel: t("wheel"),
    gender: text("gender").notNull().default("공용"),
    status: text("status").notNull().default("가용"),
    note: t("note"),
    ...audit,
  },
  (x) => [uniqueIndex("facilities_name_uq").on(x.name)],
);

export const homestays = pgTable(
  "homestays",
  {
    id: serial("id").primaryKey(),
    hid: text("hid").notNull(),
    host: text("host").notNull(),
    zone: t("zone"),
    addr: t("addr"),
    tel: t("tel"),
    mAdult: integer("m_adult"),
    fAdult: integer("f_adult"),
    fStu: integer("f_stu"),
    mStu: integer("m_stu"),
    fYng: integer("f_yng"),
    mYng: integer("m_yng"),
    lang: t("lang"),
    cap: integer("cap"),
    period: t("period"),
    match: t("match"),
    status: text("status").notNull().default("제안"),
    note: t("note"),
    ...audit,
  },
  (x) => [uniqueIndex("homestays_hid_uq").on(x.hid)],
);

export const visitors = pgTable(
  "visitors",
  {
    id: serial("id").primaryKey(),
    pid: text("pid").notNull(),
    gno: t("gno"),
    name: t("name"),
    sex: t("sex"),
    tel: t("tel"),
    country: t("country"),
    lang: t("lang"),
    // 이름 문자열 대신 FK — 이름 변경 연쇄 불필요, 삭제 시 자동 미배정
    facilityId: integer("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    homestayId: integer("homestay_id").references(() => homestays.id, { onDelete: "set null" }),
    orphanStay: t("orphan_stay"),
    stay: t("stay"),
    role: t("role"),
    status: text("status").notNull().default("확정"),
    note: t("note"),
    ...audit,
  },
  (x) => [
    uniqueIndex("visitors_pid_uq").on(x.pid),
    index("visitors_facility_idx").on(x.facilityId),
    index("visitors_homestay_idx").on(x.homestayId),
  ],
);

export const departments = pgTable(
  "departments",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("분과"),
    task: t("task"),
    key: boolean("key").notNull().default(false),
    sort: integer("sort").notNull().default(0),
    ...audit,
  },
  (x) => [uniqueIndex("departments_name_uq").on(x.name)],
);

export const volunteers = pgTable(
  "volunteers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    tel: t("tel"),
    team: t("team"),
    role: t("role"),
    task: t("task"),
    langs: t("langs"),
    org: t("org"),
    deptId: integer("dept_id").references(() => departments.id, { onDelete: "set null" }),
    note: t("note"),
    ...audit,
  },
  (x) => [index("volunteers_team_idx").on(x.team)],
);

export const officers = pgTable("officers", {
  id: serial("id").primaryKey(),
  slot: t("slot"),
  name: t("name"),
  tel: t("tel"),
  note: t("note"),
  sort: integer("sort").notNull().default(0),
  ...audit,
});

export const schedule = pgTable("schedule", {
  id: serial("id").primaryKey(),
  date: t("date"),
  event: t("event"),
  prep: t("prep"),
  sort: integer("sort").notNull().default(0),
  ...audit,
});
export const scheduleSlots = pgTable(
  "schedule_slots",
  {
    id: serial("id").primaryKey(),
    scheduleId: integer("schedule_id")
      .notNull()
      .references(() => schedule.id, { onDelete: "cascade" }),
    time: t("time"),
    text: t("text"),
    who: t("who"),
    sort: integer("sort").notNull().default(0),
  },
  (x) => [index("schedule_slots_day_idx").on(x.scheduleId)],
);

export const prep = pgTable("prep", {
  id: serial("id").primaryKey(),
  phase: t("phase"),
  title: t("title"),
  detail: t("detail"),
  ref: t("ref"),
  done: boolean("done").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  ...audit,
});

export const notices = pgTable("notices", {
  id: serial("id").primaryKey(),
  date: t("date"),
  title: t("title"),
  body: t("body"),
  author: t("author"),
  ...audit,
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  date: t("date"),
  title: t("title"),
  body: t("body"),
  author: t("author"),
  authorId: integer("author_id"),
  ...audit,
});

export const qna = pgTable("qna", {
  id: serial("id").primaryKey(),
  date: t("date"),
  author: t("author"),
  q: t("q"),
  a: t("a"),
  answered: boolean("answered").notNull().default(false),
  ...audit,
});

export const places = pgTable("places", {
  id: serial("id").primaryKey(),
  cat: text("cat").notNull().default("기타"),
  name: t("name"),
  nameEn: t("name_en"),
  addr: t("addr"),
  addrEn: t("addr_en"),
  query: t("query"),
  desc: t("desc"),
  descEn: t("desc_en"),
  sort: integer("sort").notNull().default(0),
  ...audit,
});

export const gori = pgTable(
  "gori",
  {
    id: serial("id").primaryKey(),
    date: text("date").notNull(),
    org: t("org"),
    rep: t("rep"),
    note: t("note"),
    photo: t("photo"),
    ...audit,
  },
  (x) => [index("gori_date_idx").on(x.date)],
);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    name: t("name"),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("dept"), // admin | dept | host
    team: t("team"), // dept: 편집 가능한 조직도 팀
    homestayId: integer("homestay_id").references(() => homestays.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    tokenVersion: integer("token_version").notNull().default(0), // 증가시키면 기존 세션 모두 무효
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (x) => [uniqueIndex("users_username_uq").on(sql`lower(${x.username})`)],
);

export const wydStatus = pgTable("wyd_status", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  today: bigint("today", { mode: "number" }),
  total: bigint("total", { mode: "number" }),
  progress: text("progress"),
  churches: bigint("churches", { mode: "number" }),
  orgs: bigint("orgs", { mode: "number" }),
  churchTotal: bigint("church_total", { mode: "number" }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    tableName: text("table_name").notNull(),
    rowId: integer("row_id"),
    action: text("action").notNull(), // create | update | delete | assign | bulk
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (x) => [index("audit_log_at_idx").on(x.at)],
);

/** 번호(P/H) 발급용 — 삭제 후에도 재사용하지 않도록 시퀀스 사용(기존 SEQ_ 스크립트 속성 대체) */
export const visitorPidSeq = pgSequence("visitor_pid_seq", { startWith: 1 });
export const homestayHidSeq = pgSequence("homestay_hid_seq", { startWith: 1 });
