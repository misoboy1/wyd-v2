// 도메인 타입 — API 응답/요청과 화면이 공유
import type { MessageTarget, PersonKind } from "./schemas.js";
export type Role = "admin" | "dept" | "host";
// 봉사자 명단(연락처 포함)·조직도 열람 역할 — 서버 registry scope, 화면 라우트·메뉴·canRead가 모두 이 값을 따름
export const VOLUNTEER_VIEW_ROLES: readonly Role[] = ["admin", "dept"];
export type Sex = "남" | "여" | "";

export interface Base {
  id: number;
  version: number;
  updatedAt?: string;
}

export interface Facility extends Base {
  rno: string;
  name: string;
  type: string;
  area: string;
  cap: number | null;
  ac: string;
  outlet: string;
  wheel: string;
  gender: string;
  status: string;
  note: string;
}
export interface Homestay extends Base {
  hid: string;
  host: string;
  zone: string;
  addr: string;
  tel: string;
  mAdult: number | null;
  fAdult: number | null;
  fStu: number | null;
  mStu: number | null;
  fYng: number | null;
  mYng: number | null;
  lang: string;
  cap: number | null;
  period: string;
  match: string;
  status: string;
  note: string;
}
export interface Visitor extends Base {
  pid: string;
  gno: string;
  name: string;
  sex: string;
  tel: string;
  country: string;
  lang: string;
  facilityId: number | null;
  homestayId: number | null;
  /** 이관 시 연결하지 못한 옛 숙소 값(연결 끊김). 새 배정 시 비워짐 */
  orphanStay: string;
  stay: string;
  role: string;
  status: string;
  note: string;
}
export interface Department extends Base {
  name: string;
  kind: string;
  task: string;
  key: boolean;
  sort: number;
}
export interface Volunteer extends Base {
  name: string;
  tel: string;
  team: string;
  role: string;
  task: string;
  langs: string;
  org: string;
  deptId: number | null;
  note: string;
}
export interface Officer extends Base {
  slot: string;
  name: string;
  tel: string;
  note: string;
  sort: number;
}
/** 팀별 카카오톡 오픈채팅방(관리자 등록). 팀원·관리자만 받음 */
export interface TeamChat extends Base {
  team: string;
  url: string;
  code: string;
}
export interface ScheduleSlot {
  id: number;
  time: string;
  text: string;
  who: string;
  sort: number;
}
export interface ScheduleDay extends Base {
  date: string;
  event: string;
  prep: string;
  sort: number;
  slots: ScheduleSlot[];
}
export interface PrepStep extends Base {
  phase: string;
  title: string;
  detail: string;
  ref: string;
  done: boolean;
  sort: number;
}
export interface Notice extends Base {
  date: string;
  title: string;
  body: string;
  author: string;
}
export interface Post extends Base {
  date: string;
  title: string;
  body: string;
  author: string;
  authorId?: number | null;
}
export interface PostComment extends Base {
  postId: number;
  body: string;
  author: string;
  authorId?: number | null;
}
/** 받은 메시지 한 건(GET /messages/inbox, /p/inbox) */
export interface InboxMessage {
  id: number;
  title: string;
  body: string;
  link: string;
  sender: string;
  createdAt: string;
  readAt: string | null;
}
/** 보낸 메시지 한 건(GET /messages/sent) — targets는 보낼 때 고른 대상 그대로 */
export interface SentMessage extends Omit<InboxMessage, "readAt"> {
  senderId: number | null;
  targets: MessageTarget[];
  total: number;
  read: number;
}
/** 개인 링크로 접속한 사람(GET /p/me) */
export interface PersonMe {
  kind: PersonKind;
  id: number;
  name: string;
}
/** 개인 링크 봉사자의 자기 팀 오픈채팅방(GET /p/chat) — 등록 안 됐거나 순례자면 null */
export type PersonChat = Pick<TeamChat, "team" | "url" | "code"> | null;
/** 개인 링크 발급 현황(GET /links) — 토큰은 발급 순간에만 응답 */
export interface PersonalLinkInfo {
  kind: PersonKind;
  refId: number;
  createdAt: string;
}

export interface Qna extends Base {
  date: string;
  author: string;
  q: string;
  a: string;
  answered: boolean;
}
export interface Place extends Base {
  cat: string;
  name: string;
  nameEn: string;
  addr: string;
  addrEn: string;
  query: string;
  desc: string;
  descEn: string;
  sort: number;
}
export interface Gori extends Base {
  date: string;
  org: string;
  rep: string;
  note: string;
  photo: string;
}
export interface WydStatus {
  date: string;
  today: number | null;
  total: number | null;
  progress: number | null;
  churches: number | null;
  orgs: number | null;
  churchTotal: number | null;
  fetchedAt: string;
}

export interface User {
  id: number;
  username: string;
  name: string;
  role: Role;
  team: string;
  homestayId: number | null;
  active: boolean;
}

export interface Dataset {
  visitors: Visitor[];
  facilities: Facility[];
  homestays: Homestay[];
  departments: Department[];
  volunteers: Volunteer[];
  officers: Officer[];
  schedule: ScheduleDay[];
  prep: PrepStep[];
  notices: Notice[];
  posts: Post[];
  postComments: PostComment[];
  qna: Qna[];
  places: Place[];
  gori: Gori[];
  teamChats: TeamChat[];
}
export type TableName = keyof Dataset;
export const TABLE_NAMES: TableName[] = [
  "visitors",
  "facilities",
  "homestays",
  "departments",
  "volunteers",
  "officers",
  "schedule",
  "prep",
  "notices",
  "posts",
  "postComments",
  "qna",
  "places",
  "gori",
  "teamChats",
];
