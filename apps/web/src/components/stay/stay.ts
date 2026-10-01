// 숙소(교리실·홈스테이) 화면 공용 도우미 — 표시 문구·그룹 키·내보내기 열 정의
import type { Facility, Homestay, MsgKey, StayIndex, Visitor } from "@wyd/shared";
import { hsCaps, isOrphan, isSleepRoom, reqSex, zoneApt } from "@wyd/shared";
import { cmp } from "@/lib/utils";
import type { useT } from "@/lib/i18n";

/** 번역 도우미(useT()의 t·label) — 컴포넌트에서 넘겨받아 언어가 바뀌면 다시 계산 */
export type Tr = Pick<ReturnType<typeof useT>, "t" | "label">;
export type CountUnit = "people" | "homes";

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
export function orphanText(v: Visitor, I: StayIndex, { t }: Tr) {
  if (v.orphanStay) return v.orphanStay;
  const f = visFacility(v, I);
  if (f) return t("stay.place.room", { name: f.name });
  return v.facilityId != null
    ? t("stay.place.facNo", { id: String(v.facilityId) })
    : v.homestayId != null
      ? t("stay.place.hsNo", { id: String(v.homestayId) })
      : "";
}

/** 숙소 묶음 키(화면 묶어보기·정렬) — 기존 visStayText */
export function stayText(v: Visitor, I: StayIndex, { t }: Tr) {
  const k = placeKind(v, I);
  if (k === "room") return roomLabel(visFacility(v, I)!);
  if (k === "hs") return t("stay.place.hs", { label: hsLabel(visHomestay(v, I)!) });
  return k === "orphan" ? t("stay.place.orphan") : t("stay.place.unassigned");
}
/** CSV·인쇄용 숙박 장소 문구 — 기존 exportDefs.visitors */
export function stayExport(v: Visitor, I: StayIndex, tr: Tr) {
  const { t } = tr;
  const k = placeKind(v, I);
  if (k === "room") return t("stay.place.room", { name: roomLabel(visFacility(v, I)!) });
  if (k === "hs") return t("stay.place.hs", { label: hsLabel(visHomestay(v, I)!) });
  return k === "orphan" ? t("stay.place.orphanWith", { text: orphanText(v, I, tr) }) : t("stay.place.unassigned");
}
/** 방문자가 묵는 가정의 구역(교리실·미배정은 "") */
export const visZone = (v: Visitor, I: StayIndex) => visHomestay(v, I)?.zone || "";

// ── 방문자 묶어보기 ──
export type VisGroupBy = "none" | "gno" | "country" | "sex" | "lang" | "stay" | "status" | "stayplace";
export const VIS_GROUPS: [VisGroupBy, MsgKey][] = [
  ["none", "stay.group.none"],
  ["gno", "stay.group.gno"],
  ["country", "stay.group.country"],
  ["sex", "stay.group.sex"],
  ["lang", "stay.group.lang"],
  ["stay", "stay.group.stay"],
  ["status", "stay.group.status"],
  ["stayplace", "stay.group.stayplace"],
];
/** 묶음 기준 이름(제목줄·인쇄 제목) */
export const VIS_GROUP_LABEL: Record<string, MsgKey> = {
  gno: "stay.col.gno",
  country: "stay.col.country",
  sex: "stay.col.sex",
  lang: "stay.col.lang",
  stay: "stay.col.period",
  status: "stay.col.status",
  stayplace: "stay.group.stayplaceLabel",
};
/** 묶음 키 = 화면에 보이는 묶음 제목(현재 언어) */
export function visGroupKey(x: Visitor, by: VisGroupBy, I: StayIndex, tr: Tr): string {
  const { t, label } = tr;
  switch (by) {
    case "gno":
      return x.gno || t("stay.ui.unset");
    case "country":
      return x.country || t("stay.ui.unset");
    case "sex":
      return x.sex ? t("stay.group.sexOf", { sex: label("sex", x.sex) }) : t("stay.group.noSex");
    case "lang":
      return x.lang || t("stay.group.noLang");
    case "stay":
      return x.stay || t("stay.group.noStay");
    case "status":
      return x.status ? label("visitorStatus", x.status) : t("stay.group.noStatus");
    default:
      return stayText(x, I, tr);
  }
}
/** 정렬된 목록에서 키가 처음 나오는 순서(화면 묶어보기와 인쇄가 같은 순서) */
export function groupOrder<T>(rows: T[], keyOf: (r: T) => string) {
  const count = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    count.set(k, (count.get(k) || 0) + 1);
  }
  return { order: [...count.keys()], count };
}

// ── 홈스테이 ──
export type HsFill = "none" | "free" | "full" | "over";
export function hsFill(h: Homestay, I: StayIndex): HsFill {
  const n = I.byHomestay.get(h.id)?.length || 0,
    c = hsCaps(h).cap;
  if (!n) return "none";
  if (c && n > c) return "over";
  if (c && n === c) return "full";
  return "free";
}
/** 대표자 이름이 같은 가정(동명) */
export function dupHosts(list: Homestay[]) {
  const seen = new Map<string, number>();
  list.forEach((h) => {
    const k = String(h.host || "").trim();
    if (k) seen.set(k, (seen.get(k) || 0) + 1);
  });
  return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
}
export const sexSummary = (list: Pick<Visitor, "sex">[], { t }: Tr) => {
  const m = list.filter((p) => p.sex === "남").length,
    f = list.filter((p) => p.sex === "여").length,
    u = list.length - m - f;
  const parts: string[] = [];
  if (m) parts.push(t("stay.sum.m", { n: m }));
  if (f) parts.push(t("stay.sum.f", { n: f }));
  if (u) parts.push(t("stay.sum.u", { n: u }));
  return parts.join("·") || t("stay.group.noSex");
};

// ── 가족 구성 문구(공용 famText의 다국어판) ──
const FAM_KEYS = ["mAdult", "fAdult", "mStu", "fStu", "mYng", "fYng"] as const;
export type FamKey = (typeof FAM_KEYS)[number];
/** 가족 구성 항목별 인원(0명 제외) */
export const famItems = (h: Homestay) => FAM_KEYS.map((k) => [k, Number((h as any)[k]) || 0] as [FamKey, number]).filter((x) => x[1] > 0);
export function famLabel(h: Homestay | null | undefined, short: boolean, { t }: Tr): string {
  if (h == null) return "—";
  const hasSex = FAM_KEYS.some((k) => (h as any)[k] != null && (h as any)[k] !== "");
  if (hasSex) {
    const items = famItems(h);
    const total = items.reduce((s, x) => s + x[1], 0);
    if (short)
      return (items.map(([k, n]) => t(`stay.fam.short.${k}`, { n })).join("·") || "0") + "·" + t("stay.fam.short.total", { n: total });
    return (
      (items.map(([k, n]) => t("stay.fam.item", { label: t(`stay.fam.${k}`), n })).join(" · ") || t("stay.fam.none")) +
      " · " +
      t("stay.fam.total", { n: total })
    );
  }
  // 하위호환: 구 stu/yng
  const anyH = h as any;
  const hasNum = (anyH.stu != null && anyH.stu !== "") || (anyH.yng != null && anyH.yng !== "");
  if (hasNum) {
    const s = Number(anyH.stu) || 0,
      y = Number(anyH.yng) || 0;
    return t(short ? "stay.fam.short.legacy" : "stay.fam.legacy", { s, y, n: s + y });
  }
  return String(anyH.family || "") || "—";
}

// ── 성당시설 정렬 ──
const rnoNum = (f: Facility) => Number(String(f.rno || "").replace(/\D/g, "")) || 0;
export type FacSortKey = "rno" | "name" | "type" | "status" | "occ" | "gender" | "ac" | "note";
export function sortFacilities(list: Facility[], I: StayIndex, key: FacSortKey = "rno", dir: 1 | -1 = 1) {
  const normal = list.filter((f) => !FAC_PINNED_BOTTOM.includes(f.name));
  const pinned = list
    .filter((f) => FAC_PINNED_BOTTOM.includes(f.name))
    .sort((a, b) => FAC_PINNED_BOTTOM.indexOf(a.name) - FAC_PINNED_BOTTOM.indexOf(b.name));
  const occ = (f: Facility) => I.byFacility.get(f.id)?.length || 0;
  normal.sort((a, b) => {
    if (key === "occ") {
      const d = occ(a) - occ(b);
      if (d) return d * dir;
      return ((Number(a.cap) || 0) - (Number(b.cap) || 0)) * dir;
    }
    if (key === "rno") return (rnoNum(a) - rnoNum(b)) * dir;
    return cmp((a as any)[key], (b as any)[key]) * dir;
  });
  return normal.concat(pinned);
}

// ── 내보내기 열(CSV·인쇄) — 기존 exportDefs ──
export type ExportCol<T> = [header: string, get: (r: T) => string | number];
export const visitorCols = (I: StayIndex, tr: Tr): ExportCol<Visitor>[] => {
  const { t, label } = tr;
  return [
    [t("stay.col.pid"), (v) => v.pid || ""],
    [t("stay.col.gno"), (v) => v.gno || ""],
    [t("stay.col.name"), (v) => v.name || ""],
    [t("stay.col.sex"), (v) => label("sex", v.sex)],
    [t("stay.col.country"), (v) => v.country || ""],
    [t("stay.col.lang"), (v) => v.lang || ""],
    [t("stay.col.stayPlace"), (v) => stayExport(v, I, tr)],
    [t("stay.col.period"), (v) => v.stay || ""],
    [t("stay.col.role"), (v) => v.role || ""],
    [t("stay.col.status"), (v) => label("visitorStatus", v.status)],
    [t("stay.col.tel"), (v) => v.tel || ""],
    [t("stay.col.note"), (v) => v.note || ""],
  ];
};
export const homestayCols = (I: StayIndex, tr: Tr): ExportCol<Homestay>[] => {
  const { t, label } = tr;
  return [
    [t("stay.col.pid"), (h) => h.hid || ""],
    [t("stay.col.zone"), (h) => h.zone || ""],
    [t("stay.col.zoneApt"), (h) => zoneApt(h.zone)],
    [t("stay.col.host"), (h) => h.host || ""],
    [t("stay.col.addr"), (h) => h.addr || ""],
    [t("stay.col.tel"), (h) => h.tel || ""],
    [t("stay.col.family"), (h) => famLabel(h, false, tr)],
    [t("stay.col.lang"), (h) => h.lang || ""],
    [t("stay.col.cap"), (h) => h.cap ?? ""],
    [t("stay.col.reqSex"), (h) => label("sex", reqSex(h))],
    [t("stay.col.status"), (h) => label("homestayStatus", h.status)],
    [
      t("stay.col.guests"),
      (h) =>
        (I.byHomestay.get(h.id) || []).map((p) => (p.pid || "") + " " + p.name + "(" + (p.country || "") + ")").join(" / ") ||
        t("stay.place.unassigned"),
    ],
    [t("stay.col.note"), (h) => h.note || ""],
  ];
};
export const facilityCols = (I: StayIndex, tr: Tr): ExportCol<Facility>[] => {
  const { t, label } = tr;
  return [
    [t("stay.col.pid"), (f) => f.rno || ""],
    [t("stay.col.space"), (f) => f.name],
    [t("stay.col.type"), (f) => f.type],
    [t("stay.col.status"), (f) => label("facilityStatus", f.status)],
    [
      t("stay.col.facOcc"),
      (f) =>
        isSleepRoom(f)
          ? (I.byFacility.get(f.id)?.length || 0) + "/" + (f.cap || "—")
          : f.cap
            ? t("stay.fac.seats", { n: Number(f.cap) })
            : "",
    ],
    [t("stay.col.gender"), (f) => label("sex", f.gender || "공용")],
    [t("stay.col.ac"), (f) => f.ac || ""],
    [t("stay.col.note"), (f) => f.note || ""],
    [t("stay.col.area"), (f) => f.area || ""],
  ];
};
export const applyCols = <T>(cols: ExportCol<T>[], rows: T[]) => rows.map((r) => cols.map(([, g]) => g(r)));
