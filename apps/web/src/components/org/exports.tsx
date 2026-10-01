// 봉사자 내보내기(CSV·인쇄·선택 인쇄)와 엑셀 붙여넣기 정의 — 기존 exportDefs.tasks/org, PRINT_PICKERS.tasks, PASTE_DEFS.tasks/org
// 머리글·제목만 번역하고 셀 값(팀·직책 등 저장값)은 그대로 둔다 — 다시 붙여넣기할 수 있게
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { NO_TEAM, TEAM_NAMES, teamInfo, teamOf, teamRange } from "@wyd/shared";
import { translate, type Department, type Locale, type MsgKey, type Params } from "@wyd/shared";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/misc";
import { downloadCSV } from "@/lib/csv";
import { printDocument } from "@/lib/print";
import { tt, useT } from "@/lib/i18n";
import type { PasteDef } from "@/components/form/PasteImport";
import { teamList, teamName, volRefText, volTeamSort, volsByTeam, type Vol } from "./vol";

type DeptName = (id: number | null | undefined) => string;

const TASK_HEAD_KEYS: MsgKey[] = [
  "org.col.team",
  "org.col.role",
  "org.col.name",
  "org.col.tel",
  "org.col.task",
  "org.col.langs",
  "org.exp.refDept",
  "org.exp.refOrg",
  "org.col.note",
];
const taskHead = () => TASK_HEAD_KEYS.map((k) => tt(k));
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
const ORG_HEAD_KEYS: MsgKey[] = [
  "org.col.team",
  "org.exp.std",
  "org.col.role",
  "org.col.name",
  "org.col.tel",
  "org.col.task",
  "org.exp.lang",
  "org.exp.refBoth",
];
const orgHead = () => ORG_HEAD_KEYS.map((k) => tt(k));

/** 조직도 행: 팀마다 봉사자, 빈 팀은 '(배정 없음)' 한 줄 */
function orgRows(vols: Vol[], dn: DeptName): string[][] {
  const byT = volsByTeam(vols),
    out: string[][] = [];
  teamList(byT).forEach((t) => {
    const std = teamRange(t)?.txt ?? "";
    const list = byT[t] || [];
    if (list.length)
      list.forEach((v) => out.push([t, std, v.role, v.name, v.tel || "", v.task || "", v.langs || "", volRefText(v, dn(v.deptId))]));
    else out.push([t, std, "—", tt("org.exp.noneAssigned"), "", "", "", ""]);
  });
  return out;
}
const kpis = (vols: Vol[]): [string, string][] => {
  const none = vols.filter((v) => teamOf(v) === NO_TEAM).length;
  return [
    [tt("org.exp.kpiVols"), tt("common.people", { n: vols.length })],
    [tt("org.exp.kpiAssigned"), tt("common.people", { n: vols.length - none })],
    [tt("org.noTeam"), tt("common.people", { n: none })],
    [tt("org.exp.kpiTeams"), tt("org.exp.teamsCount", { n: TEAM_NAMES.length })],
  ];
};

export const volExports = {
  tasksCSV: (vols: Vol[], dn: DeptName) =>
    downloadCSV(
      tt("org.exp.fileTasks"),
      taskHead(),
      vols
        .slice()
        .sort(volTeamSort)
        .map((v) => taskRow(v, dn)),
    ),
  tasksPrint: (vols: Vol[], dn: DeptName) =>
    printDocument(
      tt("org.exp.titleTasks"),
      [
        {
          columns: taskHead(),
          rows: vols
            .slice()
            .sort(volTeamSort)
            .map((v) => taskRow(v, dn)),
        },
      ],
      { kpis: kpis(vols) },
    ),
  orgCSV: (vols: Vol[], dn: DeptName) => downloadCSV(tt("org.exp.fileOrg"), orgHead(), orgRows(vols, dn)),
  orgPrint: (vols: Vol[], dn: DeptName) =>
    printDocument(tt("org.exp.titleOrg"), [{ columns: orgHead(), rows: orgRows(vols, dn) }], { kpis: kpis(vols) }),
};

/** 붙여넣기: 소속분과 이름 → deptId. 분과 책임자는 자기 팀 행만 */
export function volPasteDef(labelKey: MsgKey, depts: Department[], ownTeam: string | null, locale: Locale): PasteDef {
  const t = (k: MsgKey, p?: Params) => translate(locale, k, p);
  return {
    label: t(labelKey),
    table: "volunteers",
    cols: [
      ["team", t("org.col.team")],
      ["role", t("org.paste.role")],
      ["name", t("org.col.name")],
      ["tel", t("org.col.tel")],
      ["task", t("org.paste.task")],
      ["langs", t("org.paste.langs")],
      ["org", t("org.paste.org")],
      ["dept", t("org.paste.dept")],
      ["note", t("org.col.note")],
    ],
    mapRow: (o) => {
      const { dept, ...rest } = o;
      const out: Record<string, any> = { ...rest, deptId: null };
      if (dept) {
        const d = depts.find((x) => x.name.trim() === dept.trim());
        if (d) out.deptId = d.id;
        else out.note = [rest.note, `소속분과(참고): ${dept}`].filter(Boolean).join(" / "); // 표에 없는 분과는 비고로 보존
      }
      if (ownTeam && teamInfo(out as any).team !== ownTeam) return t("org.paste.ownOnly", { team: ownTeam });
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
  const { t } = useT();
  const [by, setBy] = useState<"team" | "dept">("team");
  const [off, setOff] = useState<Set<string>>(new Set());
  const sorted = useMemo(() => vols.slice().sort(volTeamSort), [vols]);
  const groups = useMemo(() => {
    const m = new Map<string, Vol[]>();
    sorted.forEach((v) => {
      const k = by === "dept" ? deptName(v.deptId) : teamOf(v);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(v);
    });
    return [...m];
  }, [sorted, by, deptName]);
  const shown = (k: string) => (by === "dept" ? k || t("org.pick.unset") : teamName(t, k));
  const print = () => {
    const pick = groups.filter(([k]) => !off.has(k));
    printDocument(
      t("org.exp.titleTasks"),
      pick.map(([k, list]) => ({
        heading: t("org.pick.heading", { name: shown(k), n: list.length }),
        columns: taskHead(),
        rows: list.map((v) => taskRow(v, deptName)),
      })),
      { subtitle: t("org.pick.subtitle", { by: by === "team" ? t("org.col.team") : t("org.pick.byDept") }) },
    );
    onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t("org.pick.title")}
      description={t("org.pick.desc")}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" disabled={groups.every(([k]) => off.has(k))} onClick={print}>
            <Printer />
            {t("org.pick.print")}
          </Button>
        </>
      }
    >
      <div className="mb-1.5 text-[12.5px] text-ink-3">{t("org.pick.by")}</div>
      <Segmented
        value={by}
        onChange={(v) => {
          setBy(v);
          setOff(new Set());
        }}
        options={[
          { value: "team", label: t("org.col.team") },
          { value: "dept", label: t("org.pick.byDept") },
        ]}
      />
      <div className="mt-3 mb-1 flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOff(new Set())}>
          {t("org.pick.selectAll")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOff(new Set(groups.map(([k]) => k)))}>
          {t("org.pick.clearAll")}
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
              <span className="font-semibold">{shown(k)}</span>
              <span className="text-[12.5px] text-ink-3">· {t("common.people", { n: list.length })}</span>
            </label>
          ))
        ) : (
          <div className="py-3 text-ink-3">{t("common.empty")}</div>
        )}
      </div>
    </Dialog>
  );
}
