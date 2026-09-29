// 숙소(교리실·홈스테이) 화면 공용 도우미 — 표시 문구·그룹 키·내보내기 열 정의
import type { Facility, Homestay, StayIndex, Visitor } from "@wyd/shared";
import { famText, hsCaps, isOrphan, isSleepRoom, reqSex, zoneApt } from "@wyd/shared";
import { cmp } from "@/lib/utils";

export type PlaceKind = "room" | "hs" | "orphan" | "none";

/** 만남의방·대성전은 정렬과 무관하게 항상 맨 아래(이 순서 유지) */
export const FAC_PINNED_BOTTOM = ["만남의방(카페)", "대성전"];

export const roomLabel = (f: Pick<Facility, "rno" | "name">) => (f.rno ? f.rno + " " : "") + f.name;
export const hsLabel = (h: Pick<Homestay, "hid" | "host">) => (h.hid ? h.hid + " " : "") + (h.host || "");

export function placeKind(v: Visitor, I: StayIndex): PlaceKind {
  if (isOrphan(v, I)) return "orphan";
  if (v.facilityId != null) return "room";
  if (v.homestayId != null) return "hs";
  return "none";
}
export const visFacility = (v: Visitor, I: StayIndex) => (v.facilityId != null ? I.facilityById.get(v.facilityId) : undefined);
export const visHomestay = (v: Visitor, I: StayIndex) => (v.homestayId != null ? I.homestayById.get(v.homestayId) : undefined);
/** 연결 끊김일 때 보여 줄 옛 값 */
export function orphanText(v: Visitor, I: StayIndex) {
  if (v.orphanStay) return v.orphanStay;
  const f = visFacility(v, I);
  if (f) return "교리실 " + f.name;
  return v.facilityId != null ? "시설 #" + v.facilityId : v.homestayId != null ? "가정 #" + v.homestayId : "";
}

/** 숙소 묶음 키(화면 묶어보기·정렬) — 기존 visStayText */
export function stayText(v: Visitor, I: StayIndex) {
  const k = placeKind(v, I);
  if (k === "room") return roomLabel(visFacility(v, I)!);
  if (k === "hs") return "홈 " + hsLabel(visHomestay(v, I)!);
  return k === "orphan" ? "연결 끊김" : "미배정";
}
/** CSV·인쇄용 숙박 장소 문구 — 기존 exportDefs.visitors */
export function stayExport(v: Visitor, I: StayIndex) {
  const k = placeKind(v, I);
  if (k === "room") return "교리실 " + roomLabel(visFacility(v, I)!);
  if (k === "hs") return "홈 " + hsLabel(visHomestay(v, I)!);
  return k === "orphan" ? `연결 끊김(${orphanText(v, I)})` : "미배정";
}
/** 방문자가 묵는 가정의 구역(교리실·미배정은 "") */
export const visZone = (v: Visitor, I: StayIndex) => visHomestay(v, I)?.zone || "";

// ── 방문자 묶어보기 ──
export type VisGroupBy = "none" | "gno" | "country" | "sex" | "lang" | "stay" | "status" | "stayplace";
export const VIS_GROUPS: [VisGroupBy, string][] = [["none", "그룹화 없음"], ["gno", "그룹별"], ["country", "국가별"], ["sex", "성별"], ["lang", "언어별"], ["stay", "기간별"], ["status", "상태별"], ["stayplace", "숙소별"]];
export const VIS_GROUP_LABEL: Record<string, string> = { gno: "그룹", country: "국가", sex: "성별", lang: "언어", stay: "기간", status: "상태", stayplace: "숙소" };
export function visGroupKey(x: Visitor, by: VisGroupBy, I: StayIndex): string {
  switch (by) {
    case "gno": return x.gno || "미지정";
    case "country": return x.country || "미지정";
    case "sex": return x.sex ? x.sex + "성" : "성별 미입력";
    case "lang": return x.lang || "언어 미입력";
    case "stay": return x.stay || "기간 미입력";
    case "status": return x.status || "상태 미입력";
    default: return stayText(x, I);
  }
}
/** 정렬된 목록에서 키가 처음 나오는 순서(화면 묶어보기와 인쇄가 같은 순서) */
export function groupOrder<T>(rows: T[], keyOf: (r: T) => string) {
  const count = new Map<string, number>();
  for (const r of rows) { const k = keyOf(r); count.set(k, (count.get(k) || 0) + 1); }
  return { order: [...count.keys()], count };
}

// ── 홈스테이 ──
export type HsFill = "none" | "free" | "full" | "over";
export function hsFill(h: Homestay, I: StayIndex): HsFill {
  const n = I.byHomestay.get(h.id)?.length || 0, c = hsCaps(h).cap;
  if (!n) return "none";
  if (c && n > c) return "over";
  if (c && n === c) return "full";
  return "free";
}
/** 대표자 이름이 같은 가정(동명) */
export function dupHosts(list: Homestay[]) {
  const seen = new Map<string, number>();
  list.forEach((h) => { const k = String(h.host || "").trim(); if (k) seen.set(k, (seen.get(k) || 0) + 1); });
  return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
}
export const sexSummary = (list: Pick<Visitor, "sex">[]) => {
  const m = list.filter((p) => p.sex === "남").length, f = list.filter((p) => p.sex === "여").length, u = list.length - m - f;
  const parts: string[] = []; if (m) parts.push("남" + m); if (f) parts.push("여" + f); if (u) parts.push("미상" + u);
  return parts.join("·") || "성별 미입력";
};

// ── 성당시설 정렬 ──
const rnoNum = (f: Facility) => Number(String(f.rno || "").replace(/\D/g, "")) || 0;
export type FacSortKey = "rno" | "name" | "type" | "status" | "occ" | "gender" | "ac" | "note";
export function sortFacilities(list: Facility[], I: StayIndex, key: FacSortKey = "rno", dir: 1 | -1 = 1) {
  const normal = list.filter((f) => !FAC_PINNED_BOTTOM.includes(f.name));
  const pinned = list.filter((f) => FAC_PINNED_BOTTOM.includes(f.name)).sort((a, b) => FAC_PINNED_BOTTOM.indexOf(a.name) - FAC_PINNED_BOTTOM.indexOf(b.name));
  const occ = (f: Facility) => I.byFacility.get(f.id)?.length || 0;
  normal.sort((a, b) => {
    if (key === "occ") { const d = occ(a) - occ(b); if (d) return d * dir; return ((Number(a.cap) || 0) - (Number(b.cap) || 0)) * dir; }
    if (key === "rno") return (rnoNum(a) - rnoNum(b)) * dir;
    return cmp((a as any)[key], (b as any)[key]) * dir;
  });
  return normal.concat(pinned);
}

// ── 내보내기 열(CSV·인쇄) — 기존 exportDefs ──
export type ExportCol<T> = [header: string, get: (r: T) => string | number];
export const visitorCols = (I: StayIndex): ExportCol<Visitor>[] => [
  ["번호", (v) => v.pid || ""], ["그룹", (v) => v.gno || ""], ["이름", (v) => v.name || ""], ["성별", (v) => v.sex || ""],
  ["국가", (v) => v.country || ""], ["언어", (v) => v.lang || ""], ["숙박 장소", (v) => stayExport(v, I)],
  ["기간", (v) => v.stay || ""], ["역할", (v) => v.role || ""], ["상태", (v) => v.status || ""],
  ["연락처", (v) => v.tel || ""], ["비고", (v) => v.note || ""],
];
export const homestayCols = (I: StayIndex): ExportCol<Homestay>[] => [
  ["번호", (h) => h.hid || ""], ["구역", (h) => h.zone || ""], ["아파트단지", (h) => zoneApt(h.zone)],
  ["가정", (h) => h.host || ""], ["주소", (h) => h.addr || ""], ["연락처", (h) => h.tel || ""],
  ["가족 인원", (h) => famText(h, false)], ["언어", (h) => h.lang || ""], ["수용", (h) => h.cap ?? ""],
  ["요청 성별", (h) => reqSex(h)], ["상태", (h) => h.status || ""],
  ["숙박자", (h) => (I.byHomestay.get(h.id) || []).map((p) => (p.pid || "") + " " + p.name + "(" + (p.country || "") + ")").join(" / ") || "미배정"],
  ["비고", (h) => h.note || ""],
];
export const facilityCols = (I: StayIndex): ExportCol<Facility>[] => [
  ["번호", (f) => f.rno || ""], ["공간", (f) => f.name], ["유형", (f) => f.type], ["상태", (f) => f.status || ""],
  ["숙박 방문자(배정/수용)", (f) => (isSleepRoom(f) ? (I.byFacility.get(f.id)?.length || 0) + "/" + (f.cap || "—") : f.cap ? f.cap + "석" : "")],
  ["남녀", (f) => f.gender || "공용"], ["냉방", (f) => f.ac || ""], ["비고", (f) => f.note || ""], ["면적(실측)", (f) => f.area || ""],
];
export const applyCols = <T,>(cols: ExportCol<T>[], rows: T[]) => rows.map((r) => cols.map(([, g]) => g(r)));
