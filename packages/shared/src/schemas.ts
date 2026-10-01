// 입력 검증(zod) — API DTO 검증과 프론트 폼 검증에서 공용
import { z } from "zod";
import { toStr } from "./text.js";
import { LOCALES } from "./i18n/core.js";
import { MESSAGES } from "./i18n/index.js";

const str = (max = 2000) => z.string().trim().max(max).default("");
const optNum = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 100000), "valid.nonNegativeNumber");
const bool = z
  .union([z.boolean(), z.string(), z.number()])
  .nullish()
  .transform((v) => v === true || v === 1 || v === "true" || v === "TRUE" || v === "1" || v === "Y" || v === "예" || v === "O");
const idRef = z
  .union([z.number().int().positive(), z.null()])
  .nullish()
  .transform((v) => v ?? null);

export const SEX_VALUES = ["", "남", "여"] as const;
/** 엑셀 등에서 들어온 성별 표기 정규화 */
export function normSex(v: unknown): string {
  const s = toStr(v).trim().toLowerCase();
  if (["남", "남자", "남성", "m", "male", "man"].includes(s)) return "남";
  if (["여", "여자", "여성", "f", "female", "woman"].includes(s)) return "여";
  return SEX_BY_LABEL.get(s) ?? "";
}
/** 화면·CSV에 나간 다국어 성별 라벨(Femme, Mujer…) → 저장값. 외국어로 내보낸 명단을 다시 붙여넣어도 성별 유지 */
const SEX_BY_LABEL = new Map(
  LOCALES.flatMap((l) => (["남", "여"] as const).map((k) => [MESSAGES[l].enums.sex[k].toLowerCase(), k] as const)),
);

export const schemas = {
  visitors: z.object({
    pid: str(20),
    gno: str(20),
    name: str(100),
    sex: z.preprocess(normSex, z.enum(SEX_VALUES)).default(""),
    tel: str(60),
    country: str(60),
    lang: str(100),
    facilityId: idRef,
    homestayId: idRef,
    orphanStay: str(200),
    stay: str(60),
    role: str(60),
    status: z.enum(["확정", "변동중", "대기", ""]).default("확정"),
    note: str(4000),
  }),
  facilities: z.object({
    rno: str(20),
    name: z.string().trim().min(1, "valid.facilityNameRequired").max(100),
    type: str(60),
    area: str(60),
    cap: optNum,
    ac: str(10),
    outlet: str(60),
    wheel: str(10),
    gender: z.enum(["남", "여", "공용"]).default("공용"),
    status: z.enum(["가용", "사용중", "점검중"]).default("가용"),
    note: str(4000),
  }),
  homestays: z.object({
    hid: str(20),
    host: z.string().trim().min(1, "valid.hostRequired").max(100),
    zone: str(40),
    addr: str(300),
    tel: str(60),
    mAdult: optNum,
    fAdult: optNum,
    fStu: optNum,
    mStu: optNum,
    fYng: optNum,
    mYng: optNum,
    lang: str(200),
    cap: optNum,
    period: str(60),
    match: str(100),
    status: z.enum(["제안", "확정", "입실", "퇴실"]).default("제안"),
    note: str(4000),
  }),
  departments: z.object({
    name: z.string().trim().min(1).max(60),
    kind: z.enum(["분과", "구역"]).default("분과"),
    task: str(1000),
    key: bool,
    sort: z.coerce.number().int().default(0),
  }),
  volunteers: z.object({
    name: z.string().trim().min(1, "valid.nameRequired").max(100),
    tel: str(60),
    team: str(60),
    role: str(30),
    task: str(300),
    langs: str(200),
    org: str(100),
    deptId: idRef,
    note: str(1000),
  }),
  officers: z.object({ slot: str(60), name: str(100), tel: str(60), note: str(300), sort: z.coerce.number().int().default(0) }),
  schedule: z.object({
    date: str(40),
    event: str(200),
    prep: str(4000),
    sort: z.coerce.number().int().default(0),
    slots: z
      .array(
        z.object({
          id: z.number().int().optional(),
          time: str(30),
          text: str(500),
          who: str(100),
          sort: z.coerce.number().int().default(0),
        }),
      )
      .max(100)
      .default([]),
  }),
  prep: z.object({
    phase: str(100),
    title: str(200),
    detail: str(4000),
    ref: str(300),
    done: bool,
    sort: z.coerce.number().int().default(0),
  }),
  notices: z.object({ date: str(20), title: z.string().trim().min(1).max(200), body: str(10000), author: str(100) }),
  posts: z.object({ date: str(20), title: z.string().trim().min(1).max(200), body: str(10000), author: str(100) }),
  qna: z.object({
    date: str(20),
    author: str(40),
    q: z.string().trim().min(1, "valid.questionRequired").max(1000),
    a: str(4000),
    answered: bool,
  }),
  places: z.object({
    cat: z.enum(["성당", "교통", "대회장", "의료", "편의", "기타"]).default("기타"),
    name: str(200),
    nameEn: str(200),
    addr: str(300),
    addrEn: str(300),
    query: str(200),
    desc: str(2000),
    descEn: str(2000),
    sort: z.coerce.number().int().default(0),
  }),
  gori: z.object({
    date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "valid.dateFormat"),
    org: str(100),
    rep: str(100),
    note: str(300),
    photo: str(500),
  }),
} as const;

export type SchemaTable = keyof typeof schemas;
/** 공개 Q&A 질문(비로그인) — 답변 필드는 받지 않음 */
export const publicQuestionSchema = z.object({ author: z.string().trim().min(1).max(40), q: z.string().trim().min(1).max(1000) });
export const loginSchema = z.object({ username: z.string().trim().min(1).max(60), password: z.string().min(1).max(200) });

/** zod issue → 번역 키(valid.*)+파라미터. 스키마에 직접 쓴 "valid.*" 메시지는 그대로, 그 외 zod 기본 메시지는 코드별 일반 문구로 */
export function issueMsg(issue: { code: string; message: string; origin?: unknown; minimum?: unknown; maximum?: unknown }): {
  key: string;
  params?: Record<string, number>;
} {
  if (issue.message.startsWith("valid.")) return { key: issue.message };
  const origin = issue.origin;
  switch (issue.code) {
    case "too_small": {
      const min = Number(issue.minimum);
      if (origin === "string") return min <= 1 ? { key: "valid.required" } : { key: "valid.tooShort", params: { min } };
      if (origin === "array" || origin === "set") return { key: "valid.tooFew", params: { min } };
      return { key: "valid.min", params: { min } };
    }
    case "too_big": {
      const max = Number(issue.maximum);
      if (origin === "string") return { key: "valid.tooLong", params: { max } };
      if (origin === "array" || origin === "set") return { key: "valid.tooMany", params: { max } };
      return { key: "valid.max", params: { max } };
    }
    case "invalid_type":
      return { key: /undefined/.test(issue.message) ? "valid.required" : "valid.invalidType" };
    case "invalid_value":
      return { key: "valid.invalidOption" };
    case "invalid_format":
      return { key: "valid.invalidFormat" };
    default:
      return { key: "valid.invalid" };
  }
}
