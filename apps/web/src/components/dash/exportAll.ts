// 4대 명단 종합 내보내기(대시보드) — 기존 downloadAllCSV / printAll 이식
import {
  PARISH,
  cmpStr,
  enumLabel,
  famText,
  isSleepRoom,
  reqSex,
  roleRank,
  teamOf,
  teamOrder,
  translateDynamic,
  zoneApt,
  type Department,
  type EnumGroup,
  type Facility,
  type Homestay,
  type Visitor,
  type Volunteer,
} from "@wyd/shared";
import { downloadCSV } from "@/lib/csv";
import { printDocument } from "@/lib/print";
import { getLocale, tt } from "@/lib/i18n";
import type { Totals } from "./stats";

export interface AllData {
  visitors: Visitor[];
  facilities: Facility[];
  homestays: Homestay[];
  volunteers: Volunteer[];
  departments: Department[];
}
type Cell = string | number;
interface Def {
  title: string;
  cols: string[];
  rows: Cell[][];
}

type Sheet = "visitors" | "homestays" | "volunteers" | "facilities";
/** 열 머리글 — dash.export.<sheet>.cols.<key> */
const cols = (sheet: Sheet, keys: string[]) => keys.map((k) => translateDynamic(getLocale(), `dash.export.${sheet}.cols.${k}`));

const FAC_PINNED_BOTTOM = ["만남의방(카페)", "대성전"]; // 항상 맨 아래(이 순서)
const rnoNum = (f: Facility) => Number(String(f.rno || "").replace(/\D/g, "")) || 0;

function defs(d: AllData, T: Totals): Def[] {
  const { I } = T;
  const L = (g: EnumGroup, v: string | null | undefined) => enumLabel(getLocale(), g, v);
  const deptName = new Map(d.departments.map((x) => [x.id, x.name]));
  const stayLabel = (v: Visitor) => {
    if (v.facilityId != null) {
      const f = I.facilityById.get(v.facilityId);
      return f && isSleepRoom(f) ? tt("dash.export.stayRoom", { name: f.name }) : tt("dash.export.orphanRoom");
    }
    if (v.homestayId != null) {
      const h = I.homestayById.get(v.homestayId);
      return h ? tt("dash.export.stayHome", { name: [h.hid, h.host].filter(Boolean).join(" ") }) : tt("dash.export.orphanHs");
    }
    return v.orphanStay ? tt("dash.export.orphanRaw", { v: v.orphanStay }) : tt("dash.export.unassigned");
  };
  const visitors = d.visitors.slice().sort((a, b) => cmpStr(a.pid || "", b.pid || ""));
  const homestays = d.homestays.slice().sort((a, b) => cmpStr(a.hid || "", b.hid || ""));
  const vols = d.volunteers
    .slice()
    .sort((a, b) => teamOrder(teamOf(a)) - teamOrder(teamOf(b)) || roleRank(a.role) - roleRank(b.role) || cmpStr(a.name, b.name));
  const facN = d.facilities.filter((x) => !FAC_PINNED_BOTTOM.includes(x.name)).sort((a, b) => rnoNum(a) - rnoNum(b));
  const facP = d.facilities
    .filter((x) => FAC_PINNED_BOTTOM.includes(x.name))
    .sort((a, b) => FAC_PINNED_BOTTOM.indexOf(a.name) - FAC_PINNED_BOTTOM.indexOf(b.name));
  return [
    {
      title: tt("dash.export.visitors.title"),
      cols: cols("visitors", ["pid", "gno", "name", "sex", "country", "lang", "stay", "period", "role", "status", "tel", "note"]),
      rows: visitors.map((v) => [
        v.pid,
        v.gno,
        v.name,
        L("sex", v.sex),
        v.country,
        v.lang,
        stayLabel(v),
        v.stay,
        v.role,
        L("visitorStatus", v.status),
        v.tel,
        v.note,
      ]),
    },
    {
      title: tt("dash.export.homestays.title"),
      cols: cols("homestays", ["hid", "zone", "apt", "host", "addr", "tel", "family", "lang", "cap", "reqSex", "status", "guests", "note"]),
      rows: homestays.map((h) => [
        h.hid,
        h.zone,
        zoneApt(h.zone),
        h.host,
        h.addr,
        h.tel,
        famText(h, undefined),
        h.lang,
        h.cap ?? "",
        L("sex", reqSex(h)),
        L("homestayStatus", h.status),
        (I.byHomestay.get(h.id) ?? []).map((p) => `${p.pid || ""} ${p.name}(${p.country || ""})`).join(" / ") ||
          tt("dash.export.unassigned"),
        h.note,
      ]),
    },
    {
      title: tt("dash.export.volunteers.title"),
      cols: cols("volunteers", ["team", "role", "name", "tel", "task", "langs", "dept", "org", "note"]),
      rows: vols.map((t) => [
        teamOf(t),
        L("volRole", t.role),
        t.name,
        t.tel,
        t.task,
        t.langs,
        t.deptId != null ? (deptName.get(t.deptId) ?? "") : "",
        t.org,
        t.note,
      ]),
    },
    {
      title: tt("dash.export.facilities.title"),
      cols: cols("facilities", ["rno", "name", "type", "status", "guests", "gender", "ac", "note", "area"]),
      rows: [...facN, ...facP].map((f) => [
        f.rno,
        f.name,
        f.type,
        L("facilityStatus", f.status),
        isSleepRoom(f)
          ? `${(I.byFacility.get(f.id) ?? []).length}/${f.cap ?? "—"}`
          : f.cap
            ? tt("dash.export.seats", { n: Number(f.cap) })
            : "",
        L("sex", f.gender || "공용"),
        f.ac,
        f.note,
        f.area,
      ]),
    },
  ].map((x) => ({ ...x, rows: x.rows.map((r) => r.map((c) => (c == null ? "" : c))) as Cell[][] }));
}

const NO = ["①", "②", "③", "④"];

/** 한 파일에 섹션 머리글로 구분(기존 형식) */
export function downloadAllCSV(d: AllData, T: Totals) {
  const D = defs(d, T);
  const lines: Cell[][] = [];
  D.forEach((x, i) => {
    if (i) lines.push([]); // 섹션 사이 빈 줄
    lines.push([tt("dash.export.section", { no: NO[i], title: x.title, n: x.rows.length })], x.cols, ...x.rows);
  });
  const [head, ...rest] = lines;
  downloadCSV(`${PARISH.name}_WYD_${tt("dash.export.fileName")}`, head as string[], rest);
}

export function printAll(d: AllData, T: Totals) {
  const D = defs(d, T);
  printDocument(
    tt("dash.export.reportTitle", { parish: PARISH.name }),
    D.map((x, i) => ({
      heading: tt("dash.export.sectionPrint", { no: NO[i], title: x.title, n: x.rows.length }),
      columns: x.cols,
      rows: x.rows,
    })),
    {
      kpis: [
        [tt("dash.export.kpi.visitors"), tt("common.people", { n: T.total })],
        [tt("dash.export.kpi.families"), tt("dash.quick.families", { n: d.homestays.length })],
        [tt("dash.export.kpi.assigned"), tt("common.people", { n: T.inRoom + T.inHs })],
        [tt("dash.export.kpi.unassigned"), tt("common.people", { n: T.unassigned })],
        [tt("dash.export.kpi.volunteers"), tt("common.people", { n: d.volunteers.length })],
        [tt("dash.export.kpi.rooms"), tt("dash.export.rooms", { n: d.facilities.filter(isSleepRoom).length })],
      ],
    },
  );
}
