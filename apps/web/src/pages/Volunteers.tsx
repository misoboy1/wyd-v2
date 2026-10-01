import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardPaste, Download, HandHeart, Info, Plus, Printer, ListChecks } from "lucide-react";
import { NO_TEAM, TEAM_NAMES, WYD_TEAMS, isTeamLead, teamInfo, teamOf, teamRange } from "@wyd/shared";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, SearchInput, Select } from "@/components/ui/input";
import { PasteImport } from "@/components/form/PasteImport";
import { useTable } from "@/lib/data";
import { useCan } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { cn, matchQuery } from "@/lib/utils";
import { teamName, useDeptMap, volsByTeam, type Vol } from "@/components/org/vol";
import { VolTable, nextSort, sortVols, type VolSort } from "@/components/org/VolTable";
import { VolunteerDialog, useOwnTeam } from "@/components/org/VolunteerDialog";
import { TeamAdminButtons, useTeamActions } from "@/components/org/teamActions";
import { VolPrintPicker, volExports, volPasteDef } from "@/components/org/exports";

const ALL = "*"; // 필터 '전체' 값(팀 이름과 겹치지 않음)

/** ① 팀별 충원 현황(조직도 표준 인원 대비) — 카드를 누르면 그 팀만 보기 */
function Staffing({
  vols,
  byTeam,
  filter,
  onFilter,
  admin,
}: {
  vols: Vol[];
  byTeam: Record<string, Vol[]>;
  filter: string;
  onFilter: (t: string) => void;
  admin: boolean;
}) {
  const { t: tr, label } = useT();
  const actions = useTeamActions(vols);
  const need = WYD_TEAMS.reduce((s: number, t: any) => s + (teamRange(t.team)?.min ?? 0), 0);
  const needMax = WYD_TEAMS.reduce((s: number, t: any) => s + (teamRange(t.team)?.max ?? 0), 0);
  const none = byTeam[NO_TEAM]?.length ?? 0;
  const assigned = vols.length - none;
  const shortTeams = TEAM_NAMES.filter((t) => {
    const r = teamRange(t);
    return r && (byTeam[t] || []).length < r.min;
  }).length;
  return (
    <Card className="mb-4 border-primary/30 bg-gradient-to-br from-primary-soft/70 to-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold text-ink">{tr("org.vols.staffTitle")}</h2>
          <p className="text-[12.5px] text-ink-3">{tr("org.vols.staffSub")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={assigned >= need ? "green" : "blue"}>{tr("org.vols.staffAssigned", { n: assigned, min: need, max: needMax })}</Badge>
          {shortTeams > 0 && <Badge tone="red">{tr("org.vols.shortTeams", { n: shortTeams })}</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {TEAM_NAMES.map((t) => {
          const list = byTeam[t] || [],
            n = list.length,
            rg = teamRange(t);
          const short = !!rg && n < rg.min,
            over = !!rg && n > rg.max;
          const lead = list.find((v) => isTeamLead(v.role));
          const on = filter === t;
          return (
            <button
              key={t}
              onClick={() => onFilter(on ? ALL : t)}
              aria-pressed={on}
              className={cn(
                "rounded-xl border bg-surface p-3 text-left transition hover:shadow-card",
                on ? "border-primary ring-2 ring-[var(--ring)]" : short ? "border-bad/40" : "border-line",
              )}
            >
              <div className="truncate text-[13.5px] font-bold text-ink" title={t}>
                {t}
              </div>
              <div className="mt-1.5">
                <Badge tone={short ? "red" : over ? "amber" : "green"}>{tr("org.vols.cardCount", { n, range: rg ? rg.txt : "—" })}</Badge>
              </div>
              <div className={cn("mt-1.5 truncate text-[12px]", lead ? "text-ink-2" : "text-bad")}>
                {lead ? `${label("volRole", lead.role)} ${lead.name}` : tr("org.leadMissing")}
              </div>
            </button>
          );
        })}
        {none > 0 && (
          <button
            onClick={() => onFilter(filter === NO_TEAM ? ALL : NO_TEAM)}
            aria-pressed={filter === NO_TEAM}
            className={cn(
              "rounded-xl border border-bad/40 bg-surface p-3 text-left transition hover:shadow-card",
              filter === NO_TEAM && "border-primary ring-2 ring-[var(--ring)]",
            )}
          >
            <div className="text-[13.5px] font-bold text-bad">{tr("org.noTeam")}</div>
            <div className="mt-1.5">
              <Badge tone="red">{tr("common.people", { n: none })}</Badge>
            </div>
            <div className="mt-1.5 text-[12px] text-ink-3">{tr("org.vols.pickTeam")}</div>
          </button>
        )}
      </div>
      {admin && (actions.plan.length > 0 || actions.virtual.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
          <TeamAdminButtons actions={actions} showNormalize={false} />
          {actions.virtual.length > 0 && <span>{tr("org.vols.virtualIncl", { n: actions.virtual.length })}</span>}
        </div>
      )}
      {admin && actions.mapped.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">{tr("org.vols.mappedWarn", { n: actions.mapped.length })}</span>
          <Button size="sm" variant="secondary" loading={actions.busy === "norm"} onClick={() => void actions.normalize()}>
            {tr("org.act.normToast")}
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function Volunteers() {
  const { t: tr, locale } = useT();
  const { rows: vols, isLoading } = useTable("volunteers");
  const { depts, name: deptName } = useDeptMap();
  const { isAdmin, canWrite } = useCan();
  const own = useOwnTeam();
  const byTeam = useMemo(() => volsByTeam(vols), [vols]);

  const [q, setQ] = useState("");
  const [tf, setTf] = useState(ALL);
  const [df, setDf] = useState<string>(ALL);
  const [grouped, setGrouped] = useState(true);
  const [sort, setSort] = useState<VolSort>({ key: "team", dir: 1 });
  const [edit, setEdit] = useState<{ row?: Vol | null; team?: string } | null>(null);
  const [paste, setPaste] = useState(false);
  const [picker, setPicker] = useState(false);

  const data = useMemo(() => {
    const list = vols.filter(
      (v) =>
        (tf === ALL || teamOf(v) === tf) &&
        (df === ALL || String(v.deptId ?? "") === df) &&
        matchQuery(q, teamOf(v), v.team, v.role, v.name, v.tel, v.task, v.langs, deptName(v.deptId), v.org, v.note),
    );
    return sortVols(list, sort, grouped, deptName);
  }, [vols, tf, df, q, sort, grouped, deptName]);

  const writable = canWrite("volunteers");
  const pasteDef = useMemo(() => volPasteDef("org.paste.labelVol", depts, own, locale), [depts, own, locale]);
  const add = () => setEdit({ team: TEAM_NAMES.includes(tf) ? tf : undefined });

  return (
    <div>
      <PageHeader
        icon={<HandHeart />}
        title={tr("nav.volunteers")}
        subtitle={tr("org.vols.subtitle")}
        actions={
          <>
            <Button size="sm" onClick={() => volExports.tasksCSV(vols, deptName)}>
              <Download />
              {tr("org.csv")}
            </Button>
            <Button size="sm" onClick={() => volExports.tasksPrint(vols, deptName)}>
              <Printer />
              {tr("org.printAll")}
            </Button>
            <Button size="sm" onClick={() => setPicker(true)}>
              <ListChecks />
              {tr("org.printPick")}
            </Button>
            {writable && (
              <Button size="sm" onClick={() => setPaste(true)}>
                <ClipboardPaste />
                {tr("org.pasteExcel")}
              </Button>
            )}
          </>
        }
      />

      {own && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-[13px] text-primary-soft-ink">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>{tr("org.vols.ownInfo", { team: own })}</span>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="mb-4 h-56" />
      ) : (
        <Staffing vols={vols} byTeam={byTeam} filter={tf} onFilter={setTf} admin={isAdmin} />
      )}

      {/* ② 명단: 검색·팀·분과(참고) 필터 + 팀별 묶기 */}
      <div className="sticky top-14 z-10 -mx-3 mb-3 border-b border-line bg-bg/90 px-3 py-2.5 backdrop-blur sm:top-16 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder={tr("org.vols.searchPh")} className="w-full sm:w-80" />
          <div className="w-[calc(50%-4px)] sm:w-56">
            <Select aria-label={tr("org.vols.teamFilter")} value={tf} onChange={(e) => setTf(e.target.value)}>
              <option value={ALL}>{tr("org.vols.allTeams", { n: vols.length })}</option>
              {TEAM_NAMES.map((t) => (
                <option key={t} value={t}>
                  {tr("org.vols.optCount", { name: t, n: (byTeam[t] || []).length })}
                </option>
              ))}
              {byTeam[NO_TEAM] && (
                <option value={NO_TEAM}>{tr("org.vols.optCount", { name: teamName(tr, NO_TEAM), n: byTeam[NO_TEAM].length })}</option>
              )}
            </Select>
          </div>
          <div className="w-[calc(50%-4px)] sm:w-56">
            <Select
              aria-label={tr("org.vols.deptFilter")}
              title={tr("org.vols.refFilter")}
              value={df}
              onChange={(e) => setDf(e.target.value)}
            >
              <option value={ALL}>{tr("org.vols.deptAll")}</option>
              {depts.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {tr("org.vols.optCount", { name: d.name, n: vols.filter((v) => v.deptId === d.id).length })}
                </option>
              ))}
            </Select>
          </div>
          <Checkbox checked={grouped} onChange={setGrouped} label={tr("org.vols.grouped")} />
          <span className="flex-1" />
          {writable && (
            <Button variant="primary" onClick={add}>
              <Plus />
              {tr("org.addVolunteer")}
            </Button>
          )}
        </div>
      </div>
      <div className="mb-2 text-[12.5px] text-ink-3">{tr("org.vols.shown", { n: data.length, total: vols.length })}</div>

      <Card className="p-0 max-md:border-0 max-md:bg-transparent max-md:shadow-none">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <VolTable
            rows={data}
            byTeam={byTeam}
            grouped={grouped}
            sort={sort}
            onSort={(k) => setSort((s) => nextSort(s, k))}
            onOpen={(v) => setEdit({ row: v })}
            onAddToTeam={(t) => setEdit({ team: t })}
            deptName={deptName}
            extraRef={(v) => {
              const ti = teamInfo(v);
              return ti.unknown ? <span className="text-[11.5px] text-bad">{tr("org.inputTeam", { team: v.team })}</span> : null;
            }}
          />
        )}
      </Card>

      <VolunteerDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} row={edit?.row} team={edit?.team} />
      <PasteImport def={pasteDef} open={paste} onOpenChange={setPaste} />
      <VolPrintPicker open={picker} onOpenChange={setPicker} vols={vols} deptName={deptName} />
    </div>
  );
}
