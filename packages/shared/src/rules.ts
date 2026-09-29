// 숙소 배정 규칙 — 기존 index.html(roomFit/hsFit/buildIdx/planAutoAssign)을 FK(id) 연결 모델로 이식.
// 프론트(후보 표시·자동 배정 미리보기)와 서버(트랜잭션 재검사)가 같은 함수를 사용한다.
import type { Facility, Homestay, Visitor } from "./types.js";
import { hsCaps, isRRoom, isSleepRoom, periodFits, reqSex, cmpStr, VIRTUAL } from "./content.js";

export interface FitResult {
  avail: boolean;
  reason: string;
  used: number;
  cap: number;
  gender: string;
}

/** 교리실 배정 가능 판정. guests = 현재 숙박자(본인 제외) */
export function roomFit(f: Pick<Facility, "gender" | "cap" | "status" | "type">, sex: string, guests: Pick<Visitor, "sex">[]): FitResult {
  const g = f.gender || "공용",
    cap = Number(f.cap) || 0,
    used = guests.length;
  let reason = "";
  if (!isSleepRoom(f)) reason = "숙박불가";
  else if (f.status === "점검중") reason = "점검중";
  else if (!cap) reason = "정원미입력";
  else if (!(g === "공용" || !sex || g === sex)) reason = g + "전용";
  else if (used >= cap) reason = "만실";
  // 신규 규칙(v2): 공용실도 이미 한 성별이 숙박 중이면 이성 배정 불가 (홈스테이와 동일 기준)
  else if (g === "공용" && sex && guests.some((x) => x.sex && x.sex !== sex)) reason = "이성숙박중";
  return { avail: !reason, reason, used, cap, gender: g };
}

/** 홈스테이 배정 가능 판정. guests = 현재 숙박자(본인 제외). stay 주면 가능 기간도 검사 */
export function hsFit(h: Homestay, sex: string, guests: Pick<Visitor, "sex">[], stay?: string): FitResult {
  const c = hsCaps(h),
    rq = reqSex(h),
    used = guests.length;
  let reason = "";
  if (h.status === "퇴실") reason = "퇴실";
  else if (!c.cap) reason = "수용미입력";
  else if (!(rq === "—" || rq === "남녀" || !sex || rq === sex)) reason = rq + "요청";
  else if (used >= c.cap) reason = "정원참";
  else if (sex && c.mixed) {
    const lim = sex === "남" ? c.mCap : c.fCap;
    if (guests.filter((g) => g.sex === sex).length >= lim) reason = sex + "정원참";
  } else if (sex && !c.mixed && guests.some((g) => g.sex && g.sex !== sex)) reason = "이성숙박중";
  if (!reason && stay !== undefined && !periodFits(h.period, stay)) reason = "기간불일치";
  return { avail: !reason, reason, used, cap: c.cap, gender: rq };
}

export interface StayIndex {
  byFacility: Map<number, Visitor[]>;
  byHomestay: Map<number, Visitor[]>;
  facilityById: Map<number, Facility>;
  homestayById: Map<number, Homestay>;
  inRoom: number;
  inHs: number;
  unassigned: number;
  orphan: number;
}

/** 점유 인덱스: 방문자 1회 순회로 시설별·가정별 숙박자 계산 */
export function buildStayIndex(visitors: Visitor[], facilities: Facility[], homestays: Homestay[]): StayIndex {
  const facilityById = new Map(facilities.map((f) => [f.id, f]));
  const homestayById = new Map(homestays.map((h) => [h.id, h]));
  const byFacility = new Map<number, Visitor[]>(),
    byHomestay = new Map<number, Visitor[]>();
  let inRoom = 0,
    inHs = 0,
    unassigned = 0,
    orphan = 0;
  for (const v of visitors) {
    if (v.facilityId != null) {
      const f = facilityById.get(v.facilityId);
      if (f && isSleepRoom(f)) {
        push(byFacility, f.id, v);
        inRoom++;
      } else orphan++;
      continue;
    }
    if (v.homestayId != null) {
      if (homestayById.has(v.homestayId)) {
        push(byHomestay, v.homestayId, v);
        inHs++;
      } else orphan++;
      continue;
    }
    if (v.orphanStay) orphan++;
    else unassigned++;
  }
  return { byFacility, byHomestay, facilityById, homestayById, inRoom, inHs, unassigned, orphan };
}
function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const a = m.get(k);
  if (a) a.push(v);
  else m.set(k, [v]);
}

export function isOrphan(v: Visitor, I: StayIndex): boolean {
  if (v.facilityId != null) {
    const f = I.facilityById.get(v.facilityId);
    return !f || !isSleepRoom(f);
  }
  if (v.homestayId != null) return !I.homestayById.has(v.homestayId);
  return !!v.orphanStay;
}

export interface StayCandidate extends FitResult {
  kind: "room" | "hs";
  id: number;
  label: string;
  rr?: boolean;
  zone: string;
  lang: string;
  search: string;
}
/** 방문자 편집 창 숙소 후보. selfId = 편집 중 방문자(자기 자리는 점유에서 제외) */
export function stayCandidates(I: StayIndex, sex: string, selfId: number | null, stay?: string): StayCandidate[] {
  const out: StayCandidate[] = [];
  for (const f of I.facilityById.values()) {
    if (!isSleepRoom(f)) continue;
    const guests = (I.byFacility.get(f.id) || []).filter((v) => v.id !== selfId);
    const rno = String(f.rno || "").trim(),
      rr = isRRoom(f);
    out.push({
      ...roomFit(f, sex, guests),
      kind: "room",
      id: f.id,
      rr,
      label: (rno ? rno + " " : "") + f.name,
      zone: "",
      lang: "",
      search: [rno, f.name, f.type, f.gender, f.status, f.note, "교리실", rr ? "R교리실" : "번호없음"].join(" "),
    });
  }
  for (const h of I.homestayById.values()) {
    const guests = (I.byHomestay.get(h.id) || []).filter((v) => v.id !== selfId);
    const hid = String(h.hid || "").trim();
    out.push({
      ...hsFit(h, sex, guests, stay),
      kind: "hs",
      id: h.id,
      label: (hid ? hid + " " : "") + (h.host || ""),
      zone: h.zone || "",
      lang: h.lang || "",
      search: [hid, h.host, h.zone, h.addr, h.lang, h.match, h.status, h.note, "홈스테이"].join(" "),
    });
  }
  return out;
}

// ══ 자동 배정 ══════════════════════════════════════════════════════════
export interface AutoAssignOptions {
  prefer: "room" | "hs";
  lang: boolean;
  confirmedOnly: boolean;
  includeWaiting: boolean;
  rOnly: boolean;
  /** 대상 방문자 id 한정(없으면 전체) */
  onlyIds?: number[];
}
export const AA_DEFAULT: AutoAssignOptions = { prefer: "room", lang: true, confirmedOnly: false, includeWaiting: true, rOnly: true };

export interface AssignSlot {
  kind: "room" | "hs";
  id: number;
  label: string;
  gender: string;
  rq?: string;
  mixed?: boolean;
  virt?: boolean;
  period?: string;
  free: number;
  mFree: number;
  fFree: number;
  lock: string;
  groups: Set<string>;
  langs: string[];
  n0: number;
  add: Visitor[];
}
export interface AssignPlan {
  plan: { visitorId: number; kind: "room" | "hs"; targetId: number }[];
  unplaced: Visitor[];
  skip: { noSex: number; waiting: number; moved: number; orphanIncluded: number };
  targets: number;
  slots: {
    kind: "room" | "hs";
    id: number;
    label: string;
    add: { id: number; pid: string; gno: string; sex: string; name: string }[];
    n0: number;
  }[];
}
export const aaLangs = (s: string) =>
  String(s || "")
    .split(/[\/,·\s]+/)
    .map((x) => x.trim())
    .filter((x) => x && x !== "한국어");
const isVirtualVisitor = (v: Visitor) => String(v.note || "").includes(VIRTUAL.visMark);
const isVirtualHost = (h: Homestay) => String(h.note || "").includes(VIRTUAL.hsMark);

/**
 * 미배정 방문자를 (그룹, 성별, 숙박기간, 가상여부) 단위로 묶어 큰 단위부터 배치.
 * 점수: 같은 그룹 +1000, 선호 숙소 +300, 언어 일치 +200, 크기 맞춤 최대 +100, 홈스테이 1인 단독 −250
 */
export function planAutoAssign(visitors: Visitor[], facilities: Facility[], homestays: Homestay[], opt: AutoAssignOptions): AssignPlan {
  const I = buildStayIndex(visitors, facilities, homestays);
  const only = opt.onlyIds ? new Set(opt.onlyIds) : null;
  const skip = { noSex: 0, waiting: 0, moved: 0, orphanIncluded: 0 };
  const targets: Visitor[] = [];
  for (const v of visitors) {
    if (only && !only.has(v.id)) continue;
    const f = v.facilityId != null ? I.facilityById.get(v.facilityId) : undefined;
    if (isOrphan(v, I)) skip.orphanIncluded++;
    else if (opt.rOnly && f && !isRRoom(f)) skip.moved++;
    else if (v.facilityId != null || v.homestayId != null) continue;
    if (!opt.includeWaiting && v.status === "대기") {
      skip.waiting++;
      continue;
    }
    if (v.sex !== "남" && v.sex !== "여") {
      skip.noSex++;
      continue;
    }
    targets.push(v);
  }
  const targetIds = new Set(targets.map((v) => v.id));
  // 재배정 대상은 현재 자리에서 빠진 것으로 계산
  const occupants = (arr: Visitor[] | undefined) => (arr || []).filter((x) => !targetIds.has(x.id));

  const slots: AssignSlot[] = [];
  facilities
    .filter((f) => isSleepRoom(f) && (!opt.rOnly || isRRoom(f)) && f.status !== "점검중" && (Number(f.cap) || 0) > 0)
    .sort((a, b) => cmpStr(a.rno || "~" + a.name, b.rno || "~" + b.name))
    .forEach((f) => {
      const g = occupants(I.byFacility.get(f.id));
      const sexes = new Set(g.map((x) => x.sex).filter(Boolean));
      const gender = f.gender || "공용";
      slots.push({
        kind: "room",
        id: f.id,
        label: (f.rno ? f.rno + " " : "") + f.name,
        gender,
        free: (Number(f.cap) || 0) - g.length,
        mFree: Infinity,
        fFree: Infinity,
        lock: gender === "공용" ? (sexes.size === 1 ? [...sexes][0] : sexes.size > 1 ? "__blocked__" : "") : "",
        groups: new Set(g.map((x) => x.gno).filter(Boolean)),
        langs: [],
        n0: g.length,
        add: [],
      });
    });
  homestays
    .filter((h) => h.status !== "퇴실" && (!opt.confirmedOnly || h.status === "확정" || h.status === "입실"))
    .sort((a, b) => cmpStr(a.hid, b.hid))
    .forEach((h) => {
      const c = hsCaps(h);
      if (!c.cap) return;
      const g = occupants(I.byHomestay.get(h.id));
      const sexes = new Set(g.map((x) => x.sex).filter(Boolean));
      slots.push({
        kind: "hs",
        id: h.id,
        virt: isVirtualHost(h),
        period: h.period,
        label: (h.hid ? h.hid + " " : "") + (h.host || ""),
        gender: "",
        rq: reqSex(h),
        mixed: c.mixed,
        free: c.cap - g.length,
        mFree: c.mCap - g.filter((x) => x.sex === "남").length,
        fFree: c.fCap - g.filter((x) => x.sex === "여").length,
        lock: !c.mixed && sexes.size === 1 ? [...sexes][0] : !c.mixed && sexes.size > 1 ? "__blocked__" : "",
        groups: new Set(g.map((x) => x.gno).filter(Boolean)),
        langs: aaLangs(h.lang),
        n0: g.length,
        add: [],
      });
    });

  type Unit = { gno: string; sex: string; stay: string; virt: boolean; members: Visitor[] };
  const freeFor = (s: AssignSlot, u: Unit) => {
    if (s.kind === "room") {
      if (!(s.gender === "공용" || s.gender === u.sex)) return 0;
      if (s.lock && s.lock !== u.sex) return 0;
      return s.free;
    }
    if (s.virt && !u.virt) return 0; // 실제 방문자는 가상(테스트) 가정에 배정하지 않음
    if (!periodFits(s.period, u.stay)) return 0;
    if (!(s.rq === "—" || s.rq === "남녀" || s.rq === u.sex)) return 0;
    if (!s.mixed && s.lock && s.lock !== u.sex) return 0;
    return s.mixed ? Math.min(s.free, u.sex === "남" ? s.mFree : s.fFree) : s.free;
  };

  const unitMap = new Map<string, Unit>();
  for (const v of targets) {
    const vt = isVirtualVisitor(v);
    const k = (v.gno ? "G:" + v.gno : "P:" + v.id) + "|" + v.sex + "|" + (v.stay || "") + "|" + (vt ? 1 : 0);
    let u = unitMap.get(k);
    if (!u) {
      u = { gno: v.gno || "", sex: v.sex, stay: v.stay || "", virt: vt, members: [] };
      unitMap.set(k, u);
    }
    u.members.push(v);
  }
  const units = [...unitMap.values()].sort((a, b) => b.members.length - a.members.length || cmpStr(a.gno, b.gno));
  units.forEach((u) => u.members.sort((a, b) => cmpStr(a.pid, b.pid)));

  const plan: AssignPlan["plan"] = [],
    unplaced: Visitor[] = [];
  for (const u of units) {
    const rem = u.members.slice();
    const langCnt: Record<string, number> = {};
    rem.forEach((v) =>
      aaLangs(v.lang).forEach((l) => {
        langCnt[l] = (langCnt[l] || 0) + 1;
      }),
    );
    const mainLang = Object.keys(langCnt).sort((a, b) => langCnt[b] - langCnt[a])[0] || "";
    while (rem.length) {
      let best: AssignSlot | null = null,
        bestScore = -Infinity,
        bestFree = 0;
      for (const s of slots) {
        const fr = freeFor(s, u);
        if (fr <= 0) continue;
        const n = rem.length;
        let sc = 0;
        if (u.gno && s.groups.has(u.gno)) sc += 1000;
        if (s.kind === opt.prefer) sc += 300;
        if (opt.lang && s.kind === "hs" && mainLang && s.langs.includes(mainLang)) sc += 200;
        if (fr >= n) sc += 100 - Math.min(99, fr - n);
        else sc += Math.min(99, fr);
        if (s.kind === "hs" && s.n0 + s.add.length === 0 && Math.min(fr, n) === 1) sc -= 250;
        if (sc > bestScore) {
          bestScore = sc;
          best = s;
          bestFree = fr;
        }
      }
      if (!best) break;
      const take = Math.min(bestFree, rem.length);
      const moved = rem.splice(0, take);
      for (const v of moved) {
        plan.push({ visitorId: v.id, kind: best.kind, targetId: best.id });
        best.add.push(v);
      }
      best.free -= take;
      if (best.kind === "hs") {
        if (u.sex === "남") best.mFree -= take;
        else best.fFree -= take;
        if (!best.mixed) best.lock = u.sex;
      } else if (best.gender === "공용") best.lock = u.sex;
      if (u.gno) best.groups.add(u.gno);
    }
    unplaced.push(...rem);
  }
  return {
    plan,
    unplaced,
    skip,
    targets: targets.length,
    slots: slots
      .filter((s) => s.add.length)
      .map((s) => ({
        kind: s.kind,
        id: s.id,
        label: s.label,
        n0: s.n0,
        add: s.add.map((v) => ({ id: v.id, pid: v.pid, gno: v.gno, sex: v.sex, name: v.name })),
      })),
  };
}

/** CSV 셀 보호(수식 시작 문자·줄바꿈) — 기존 csvCell과 동일 */
export function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+@\t\r]/.test(s) || (/^-/.test(s) && !/^-?\d+(\.\d+)?$/.test(s))) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** 날짜 정규화: ISO 타임스탬프 → KST YYYY-MM-DD, 그 외는 그대로 */
export function normDate(v: unknown): string {
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime()))
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  }
  return s;
}
export const todayKST = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
