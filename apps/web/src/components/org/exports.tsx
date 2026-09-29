// 봉사자 내보내기(CSV·인쇄·선택 인쇄)와 엑셀 붙여넣기 정의 — 기존 exportDefs.tasks/org, PRINT_PICKERS.tasks, PASTE_DEFS.tasks/org
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { NO_TEAM, TEAM_NAMES, teamInfo, teamOf, teamRange } from "@wyd/shared";
import type { Department } from "@wyd/shared";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/misc";
import { downloadCSV } from "@/lib/csv";
import { printDocument } from "@/lib/print";
import type { PasteDef } from "@/components/form/PasteImport";
import { teamList, volRefText, volTeamSort, volsByTeam, type Vol } from "./vol";

type DeptName = (id: number | null | undefined) => string;

const TASK_HEAD = ["팀", "직책", "이름", "연락처", "담당 임무", "언어 구사", "참고: 분과·구역", "참고: 본당단체", "비고"];
const taskRow = (v: Vol, dn: DeptName) => [
  teamOf(v),
  v.role || "",
  v.name || "",
  v.tel || "",
  v.task || "",
  v.langs || "",
  dn(v.deptId),
  v.org || "",
  v.note || "",
];
const ORG_HEAD = ["팀", "표준 인원", "직책", "이름", "연락처", "담당 임무", "언어", "참고: 분과·구역 / 단체"];

/** 조직도 행: 팀마다 봉사자, 빈 팀은 '(배정 없음)' 한 줄 */
function orgRows(vols: Vol[], dn: DeptName): string[][] {
  const byT = volsByTeam(vols),
    out: string[][] = [];
  teamList(byT).forEach((t) => {
    const std = teamRange(t)?.txt ?? "";
    const list = byT[t] || [];
    if (list.length)
      list.forEach((v) => out.push([t, std, v.role, v.name, v.tel || "", v.task || "", v.langs || "", volRefText(v, dn(v.deptId))]));
    else out.push([t, std, "—", "(배정 없음)", "", "", "", ""]);
  });
  return out;
}
const kpis = (vols: Vol[]): [string, string][] => {
  const none = vols.filter((v) => teamOf(v) === NO_TEAM).length;
  return [
    ["봉사자", vols.length + "명"],
    ["팀 배정", vols.length - none + "명"],
    ["팀 미배정", none + "명"],
    ["조직도 팀", TEAM_NAMES.length + "개"],
  ];
};

export const volExports = {
  tasksCSV: (vols: Vol[], dn: DeptName) =>
    downloadCSV(
      "봉사자명단",
      TASK_HEAD,
      vols
        .slice()
        .sort(volTeamSort)
        .map((v) => taskRow(v, dn)),
    ),
  tasksPrint: (vols: Vol[], dn: DeptName) =>
    printDocument(
      "봉사자 명단 (팀 중심)",
      [
        {
          columns: TASK_HEAD,
          rows: vols
            .slice()
            .sort(volTeamSort)
            .map((v) => taskRow(v, dn)),
        },
      ],
      { kpis: kpis(vols) },
    ),
  orgCSV: (vols: Vol[], dn: DeptName) => downloadCSV("조직도", ORG_HEAD, orgRows(vols, dn)),
  orgPrint: (vols: Vol[], dn: DeptName) =>
    printDocument("조직도 (팀별 봉사자 명단)", [{ columns: ORG_HEAD, rows: orgRows(vols, dn) }], { kpis: kpis(vols) }),
};

/** 붙여넣기: 소속분과 이름 → deptId. 분과 책임자는 자기 팀 행만 */
export function volPasteDef(label: string, depts: Department[], ownTeam: string | null): PasteDef {
  return {
    label,
    table: "volunteers",
    cols: [
      ["team", "팀"],
      ["role", "직책(팀장/팀원)"],
      ["name", "이름"],
      ["tel", "연락처"],
      ["task", "담당임무"],
      ["langs", "언어구사"],
      ["org", "본당단체(참고)"],
      ["dept", "소속분과(참고)"],
      ["note", "비고"],
    ],
    mapRow: (o) => {
      const { dept, ...rest } = o;
      const out: Record<string, any> = { ...rest, deptId: null };
      if (dept) {
        const d = depts.find((x) => x.name.trim() === dept.trim());
        if (d) out.deptId = d.id;
        else out.note = [rest.note, `소속분과(참고): ${dept}`].filter(Boolean).join(" / "); // 표에 없는 분과는 비고로 보존
      }
      if (ownTeam && teamInfo(out as any).team !== ownTeam) return `${ownTeam} 봉사자만 추가할 수 있습니다.`;
      return out;
    },
  };
}

/** 선택 인쇄 — 팀 또는 분과·구역(참고)으로 묶고 고른 묶음만 한 문서로 */
export function VolPrintPicker({
  open,
  onOpenChange,
  vols,
  deptName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vols: Vol[];
  deptName: DeptName;
}) {
  const [by, setBy] = useState<"team" | "dept">("team");
  const [off, setOff] = useState<Set<string>>(new Set());
  const sorted = useMemo(() => vols.slice().sort(volTeamSort), [vols]);
  const groups = useMemo(() => {
    const m = new Map<string, Vol[]>();
    sorted.forEach((v) => {
      const k = by === "dept" ? deptName(v.deptId) || "미지정" : teamOf(v);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(v);
    });
    return [...m];
  }, [sorted, by, deptName]);
  const print = () => {
    const pick = groups.filter(([k]) => !off.has(k));
    printDocument(
      "봉사자 명단 (팀 중심)",
      pick.map(([k, list]) => ({ heading: `${k} · ${list.length}명`, columns: TASK_HEAD, rows: list.map((v) => taskRow(v, deptName)) })),
      { subtitle: `${by === "team" ? "팀" : "분과·구역(참고)"}별 선택 인쇄` },
    );
    onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="봉사자 선택 인쇄"
      description="묶음 기준을 고르고, 인쇄할 항목을 선택하세요. 선택한 항목만 한 문서로 인쇄됩니다."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button variant="primary" disabled={groups.every(([k]) => off.has(k))} onClick={print}>
            <Printer />
            선택 항목 인쇄
          </Button>
        </>
      }
    >
      <div className="mb-1.5 text-[12.5px] text-ink-3">묶음 기준</div>
      <Segmented
        value={by}
        onChange={(v) => {
          setBy(v);
          setOff(new Set());
        }}
        options={[
          { value: "team", label: "팀" },
          { value: "dept", label: "분과·구역(참고)" },
        ]}
      />
      <div className="mt-3 mb-1 flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOff(new Set())}>
          전체 선택
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOff(new Set(groups.map(([k]) => k)))}>
          전체 해제
        </Button>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {groups.length ? (
          groups.map(([k, list]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2.5 border-b border-line py-2 text-[14px]">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={!off.has(k)}
                onChange={(e) =>
                  setOff((s) => {
                    const n = new Set(s);
                    if (e.target.checked) n.delete(k);
                    else n.add(k);
                    return n;
                  })
                }
              />
              <span className="font-semibold">{k}</span>
              <span className="text-[12.5px] text-ink-3">· {list.length}명</span>
            </label>
          ))
        ) : (
          <div className="py-3 text-ink-3">항목이 없습니다.</div>
        )}
      </div>
    </Dialog>
  );
}
