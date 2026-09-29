// 4대 명단 종합 내보내기(대시보드) — 기존 downloadAllCSV / printAll 이식
import {
  PARISH,
  cmpStr,
  famText,
  isSleepRoom,
  reqSex,
  roleRank,
  teamOf,
  teamOrder,
  zoneApt,
  type Department,
  type Facility,
  type Homestay,
  type Visitor,
  type Volunteer,
} from "@wyd/shared";
import { downloadCSV } from "@/lib/csv";
import { printDocument } from "@/lib/print";
import { num } from "@/lib/utils";
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

const FAC_PINNED_BOTTOM = ["만남의방(카페)", "대성전"]; // 항상 맨 아래(이 순서)
const rnoNum = (f: Facility) => Number(String(f.rno || "").replace(/\D/g, "")) || 0;

function defs(d: AllData, T: Totals): Def[] {
  const { I } = T;
  const deptName = new Map(d.departments.map((x) => [x.id, x.name]));
  const stayLabel = (v: Visitor) => {
    if (v.facilityId != null) {
      const f = I.facilityById.get(v.facilityId);
      return f && isSleepRoom(f) ? "교리실 " + f.name : "연결 끊김(교리실)";
    }
    if (v.homestayId != null) {
      const h = I.homestayById.get(v.homestayId);
      return h ? "홈 " + (h.hid ? h.hid + " " : "") + (h.host || "") : "연결 끊김(홈스테이)";
    }
    return v.orphanStay ? `연결 끊김(${v.orphanStay})` : "미배정";
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
      title: "방문자(순례자) 명단",
      cols: ["번호", "그룹", "이름", "성별", "국가", "언어", "숙박 장소", "기간", "역할", "상태", "연락처", "비고"],
      rows: visitors.map((v) => [v.pid, v.gno, v.name, v.sex, v.country, v.lang, stayLabel(v), v.stay, v.role, v.status, v.tel, v.note]),
    },
    {
      title: "홈스테이 가정 명단",
      cols: ["번호", "구역", "아파트단지", "가정", "주소", "연락처", "가족 인원", "언어", "수용", "요청 성별", "상태", "숙박자", "비고"],
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
        reqSex(h),
        h.status,
        (I.byHomestay.get(h.id) ?? []).map((p) => `${p.pid || ""} ${p.name}(${p.country || ""})`).join(" / ") || "미배정",
        h.note,
      ]),
    },
    {
      title: "봉사자 명단 (팀 중심)",
      cols: ["팀", "직책", "이름", "연락처", "담당 임무", "언어 구사", "참고: 분과·구역", "참고: 본당단체", "비고"],
      rows: vols.map((t) => [
        teamOf(t),
        t.role,
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
      title: "성당시설 (교리실·수용 현황)",
      cols: ["번호", "공간", "유형", "상태", "숙박 방문자(배정/수용)", "남녀", "냉방", "비고", "면적(실측)"],
      rows: [...facN, ...facP].map((f) => [
        f.rno,
        f.name,
        f.type,
        f.status,
        isSleepRoom(f) ? `${(I.byFacility.get(f.id) ?? []).length}/${f.cap ?? "—"}` : f.cap ? f.cap + "석" : "",
        f.gender || "공용",
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
    lines.push([`${NO[i]} ${x.title} (${x.rows.length}건)`], x.cols, ...x.rows);
  });
  const [head, ...rest] = lines;
  downloadCSV(`${PARISH.name}_WYD_종합명단`, head as string[], rest);
}

export function printAll(d: AllData, T: Totals) {
  const D = defs(d, T);
  printDocument(
    `${PARISH.name} WYD 종합 명단 보고서`,
    D.map((x, i) => ({ heading: `${NO[i]} ${x.title} · ${x.rows.length}건`, columns: x.cols, rows: x.rows })),
    {
      kpis: [
        ["방문자(순례자)", num(T.total) + "명"],
        ["홈스테이 가정", num(d.homestays.length) + "곳"],
        ["배정 완료", num(T.inRoom + T.inHs) + "명"],
        ["미배정", num(T.unassigned) + "명"],
        ["봉사자", num(d.volunteers.length) + "명"],
        ["숙박 시설", d.facilities.filter(isSleepRoom).length + "실"],
      ],
    },
  );
}
