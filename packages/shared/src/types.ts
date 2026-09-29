// 도메인 타입 — API 응답/요청과 화면이 공유
export type Role = "admin" | "dept" | "host";
export type Sex = "남" | "여" | "";

export interface Base { id: number; version: number; updatedAt?: string }

export interface Facility extends Base {
  rno: string; name: string; type: string; area: string; cap: number | null;
  ac: string; outlet: string; wheel: string; gender: string; status: string; note: string;
}
export interface Homestay extends Base {
  hid: string; host: string; zone: string; addr: string; tel: string;
  mAdult: number | null; fAdult: number | null; fStu: number | null; mStu: number | null; fYng: number | null; mYng: number | null;
  lang: string; cap: number | null; period: string; match: string; status: string; note: string;
}
export interface Visitor extends Base {
  pid: string; gno: string; name: string; sex: string; tel: string; country: string; lang: string;
  facilityId: number | null; homestayId: number | null;
  /** 이관 시 연결하지 못한 옛 숙소 값(연결 끊김). 새 배정 시 비워짐 */
  orphanStay: string;
  stay: string; role: string; status: string; note: string;
}
export interface Department extends Base { name: string; kind: string; task: string; key: boolean; sort: number }
export interface Volunteer extends Base {
  name: string; tel: string; team: string; role: string; task: string; langs: string; org: string;
  deptId: number | null; note: string;
}
export interface Officer extends Base { slot: string; name: string; tel: string; note: string; sort: number }
export interface ScheduleSlot { id: number; time: string; text: string; who: string; sort: number }
export interface ScheduleDay extends Base { date: string; event: string; prep: string; sort: number; slots: ScheduleSlot[] }
export interface PrepStep extends Base { phase: string; title: string; detail: string; ref: string; done: boolean; sort: number }
export interface Notice extends Base { date: string; title: string; body: string; author: string }
export interface Post extends Base { date: string; title: string; body: string; author: string; authorId?: number | null }
export interface Qna extends Base { date: string; author: string; q: string; a: string; answered: boolean }
export interface Place extends Base {
  cat: string; name: string; nameEn: string; addr: string; addrEn: string; query: string; desc: string; descEn: string; sort: number;
}
export interface Gori extends Base { date: string; org: string; rep: string; note: string; photo: string }
export interface WydStatus { date: string; today: number | null; total: number | null; progress: number | null; churches: number | null; orgs: number | null; churchTotal: number | null; fetchedAt: string }

export interface User { id: number; username: string; name: string; role: Role; team: string; homestayId: number | null; active: boolean }

export interface Dataset {
  visitors: Visitor[]; facilities: Facility[]; homestays: Homestay[]; departments: Department[];
  volunteers: Volunteer[]; officers: Officer[]; schedule: ScheduleDay[]; prep: PrepStep[];
  notices: Notice[]; posts: Post[]; qna: Qna[]; places: Place[]; gori: Gori[];
}
export type TableName = keyof Dataset;
export const TABLE_NAMES: TableName[] = [
  "visitors", "facilities", "homestays", "departments", "volunteers", "officers",
  "schedule", "prep", "notices", "posts", "qna", "places", "gori",
];
