import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ClipboardPaste, Download, Network, Pencil, Plus, Printer, UserRound } from "lucide-react";
import type { Officer } from "@wyd/shared";
import { NO_TEAM, TEAM_NAMES, WYD_TEAMS, isTeamLead, teamInfo, teamRange } from "@wyd/shared";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/table";
import { EditDialog } from "@/components/form/EditDialog";
import { PasteImport } from "@/components/form/PasteImport";
import { useTable } from "@/lib/data";
import { useCan } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Tel, teamList, teamName, useDeptMap, volsByTeam, type Vol } from "@/components/org/vol";
import { VolTable, nextSort, sortVols, type VolSort } from "@/components/org/VolTable";
import { VolunteerDialog, useOwnTeam } from "@/components/org/VolunteerDialog";
import { TeamAdminButtons, useTeamActions } from "@/components/org/teamActions";
import { volExports, volPasteDef } from "@/components/org/exports";
import { DeptSection, TargetSection } from "@/components/org/OrgRefs";

// ── 임원(본당위원회) ─────────────────────────────────────────
function OfficerNode({ o, head, onEdit }: { o: Officer; head?: boolean; onEdit?: () => void }) {
  const { t: tr } = useT();
  return (
    <div
      className={cn(
        "relative min-w-40 rounded-2xl border bg-surface px-4 py-3 text-center shadow-soft",
        head ? "border-primary/40 bg-primary-soft/40" : "border-line",
      )}
    >
      <div className="text-[11.5px] font-semibold text-ink-3">{o.slot}</div>
      <div className={cn("font-semibold text-ink", head ? "text-[16px]" : "text-[14.5px]")}>{o.name || "—"}</div>
      {o.tel && (
        <div className="mt-0.5 text-[12px]">
          <Tel tel={o.tel} />
        </div>
      )}
      {o.note && <div className="mt-1 text-[11.5px] text-ink-3">{o.note}</div>}
      {onEdit && (
        <Button size="sm" variant="ghost" className="mt-1.5" onClick={onEdit}>
          <Pencil />
          {tr("org.edit")}
        </Button>
      )}
    </div>
  );
}
function Officers({ admin }: { admin: boolean }) {
  const { t: tr } = useT();
  const { rows, isLoading } = useTable("officers");
  const [edit, setEdit] = useState<{ row?: Officer | null } | null>(null);
  const offs = useMemo(() => rows.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id), [rows]);
  const head = offs.find((o) => o.slot === "위원장") ?? offs[0];
  const rest = offs.filter((o) => o !== head);
  const defaults = useMemo(
    () => ({ slot: "", name: "", tel: "", note: "", sort: offs.reduce((m, o) => Math.max(m, o.sort ?? 0), 0) + 1 }),
    [offs],
  );
  if (isLoading) return <Skeleton className="mb-6 h-40" />;
  return (
    <section className="mb-6" aria-label={tr("org.page.officers")}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-ink">{tr("org.page.officers")}</h2>
        {admin && (
          <Button size="sm" onClick={() => setEdit({})}>
            <Plus />
            {tr("org.page.officer")}
          </Button>
        )}
      </div>
      {offs.length ? (
        <div className="flex flex-col items-center gap-0">
          {head && <OfficerNode o={head} head onEdit={admin ? () => setEdit({ row: head }) : undefined} />}
          {head && rest.length > 0 && <div className="h-5 w-px bg-line-strong" aria-hidden />}
          {rest.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 border-t border-line-strong pt-4">
              {rest.map((o) => (
                <OfficerNode key={o.id} o={o} onEdit={admin ? () => setEdit({ row: o }) : undefined} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <Card className="p-6 text-center text-[13.5px] text-ink-3">{tr("org.page.noOfficers")}</Card>
      )}
      <EditDialog
        table="officers"
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        row={edit?.row}
        defaults={defaults}
        size="md"
        title={edit?.row ? tr("org.page.officerEdit") : tr("org.page.officerAdd")}
      />
    </section>
  );
}

// ── 팀 중심 조직표 ───────────────────────────────────────────
interface TeamRow {
  team: string;
  list: Vol[];
}
/** 팀 미배정 행의 표시 정보(임무 안내는 화면에서 번역) */
const NO_TEAM_INFO = { task: "", dept: "—", when: "—", noTeam: true };

export default function Org() {
  const { t: tr, label, locale } = useT();
  const { rows: vols, isLoading } = useTable("volunteers");
  const { depts, name: deptName } = useDeptMap();
  const { isAdmin, canWrite } = useCan();
  const own = useOwnTeam();
  const actions = useTeamActions(vols);
  const byTeam = useMemo(() => volsByTeam(vols), [vols]);
  const teams = useMemo<TeamRow[]>(() => teamList(byTeam).map((t) => ({ team: t, list: byTeam[t] || [] })), [byTeam]);

  const [open, setOpen] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<VolSort>({ key: "team", dir: 1 });
  const [edit, setEdit] = useState<{ row?: Vol | null; team?: string } | null>(null);
  const [paste, setPaste] = useState(false);
  const pasteDef = useMemo(() => volPasteDef("org.paste.labelOrg", depts, own, locale), [depts, own, locale]);
  const allOpen = teams.every((t) => open.has(t.team));
  const toggle = (t: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  const canAdd = (t: string) => t !== NO_TEAM && canWrite("volunteers", { team: t });
  const none = byTeam[NO_TEAM]?.length ?? 0;
  const allSorted = useMemo(() => sortVols(vols, sort, false, deptName), [vols, sort, deptName]);

  const columns: Column<TeamRow>[] = [
    {
      key: "team",
      header: tr("org.col.team"),
      className: "min-w-40",
      cell: ({ team }) => {
        const w: any = WYD_TEAMS.find((x: any) => x.team === team) ?? NO_TEAM_INFO;
        return (
          <div>
            <div className={cn("text-[14.5px] font-bold", team === NO_TEAM ? "text-bad" : "text-ink")}>{teamName(tr, team)}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {w.when && w.when !== "—" && <Badge tone={w.when === "본대회" ? "amber" : "green"}>{w.when}</Badge>}
              {w.dept && w.dept !== "—" && (
                <span
                  title={tr("org.page.refDeptTip")}
                  className="rounded-full border border-dashed border-line-strong px-2 py-px text-[11.5px] whitespace-nowrap text-ink-3"
                >
                  {tr("org.page.refDept", { dept: w.dept })}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "count",
      header: tr("org.page.colCount"),
      cell: ({ team, list }) => {
        const rg = teamRange(team),
          n = list.length;
        const tone = !rg ? "red" : n < rg.min ? "red" : n > rg.max ? "amber" : "green";
        return (
          <div className="whitespace-nowrap">
            <Badge tone={tone}>{rg ? tr("org.page.countRange", { n, range: rg.txt }) : tr("common.people", { n })}</Badge>
            {rg && n < rg.min && <div className="mt-1 text-[12px] font-medium text-bad">{tr("org.short", { n: rg.min - n })}</div>}
          </div>
        );
      },
    },
    {
      key: "lead",
      header: tr("org.page.colLead"),
      cell: ({ team, list }) => {
        const leads = list.filter((v) => isTeamLead(v.role));
        if (!leads.length)
          return (
            <span className={cn("text-[12.5px]", team === NO_TEAM ? "text-ink-3" : "text-bad")}>
              {team === NO_TEAM ? "—" : tr("org.leadMissing")}
            </span>
          );
        return (
          <div className="space-y-1">
            {leads.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
                <Badge tone="amber">{label("volRole", v.role)}</Badge>
                <b>{v.name}</b>
                <span className="text-[12px]">
                  <Tel tel={v.tel} />
                </span>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: "members",
      header: tr("org.page.colMembers"),
      className: "min-w-64",
      cell: ({ team, list }) => {
        const w: any = WYD_TEAMS.find((x: any) => x.team === team) ?? NO_TEAM_INFO;
        const mem = list.filter((v) => !isTeamLead(v.role));
        return (
          <div>
            <div className="flex flex-wrap items-center gap-1">
              {mem.length ? (
                <>
                  {mem.slice(0, 8).map((v) => (
                    <span key={v.id} className="rounded-full bg-surface-2 px-2 py-0.5 text-[12.5px] text-ink-2">
                      {v.name}
                    </span>
                  ))}
                  {mem.length > 8 && <span className="text-[12px] text-ink-3">{tr("org.page.moreN", { n: mem.length - 8 })}</span>}
                </>
              ) : (
                <span className="text-[12.5px] text-ink-3">—</span>
              )}
            </div>
            <div className="mt-1.5 text-[12px] leading-relaxed text-ink-3">{w.noTeam ? tr("org.page.noTeamTask") : w.task}</div>
          </div>
        );
      },
    },
    {
      key: "roster",
      header: tr("org.page.colRoster"),
      cell: ({ team, list }) => (
        <div className="flex flex-col items-start gap-1">
          <Button
            size="sm"
            variant={open.has(team) ? "soft" : "secondary"}
            aria-expanded={open.has(team)}
            onClick={(e) => {
              e.stopPropagation();
              toggle(team);
            }}
          >
            {open.has(team) ? (
              <>
                <ChevronUp />
                {tr("org.page.collapse")}
              </>
            ) : (
              <>
                <ChevronDown />
                {tr("org.page.rosterBtn", { n: list.length })}
              </>
            )}
          </Button>
          {canAdd(team) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setEdit({ team });
              }}
            >
              <Plus />
              {tr("org.volunteer")}
            </Button>
          )}
        </div>
      ),
    },
  ];

  const roster = ({ team, list }: TeamRow) => {
    const rg = teamRange(team);
    return (
      <div className="px-3 py-3 sm:px-4">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[13.5px]">
          <b>{teamName(tr, team)}</b>
          <span className="text-ink-3">
            {tr("org.page.rosterCount", { n: list.length })}
            {rg ? ` / ${tr("org.page.rosterStd", { range: rg.txt })}` : ""}
          </span>
          <span className="flex-1" />
          {canAdd(team) && (
            <Button size="sm" onClick={() => setEdit({ team })}>
              <Plus />
              {tr("org.page.addToTeam")}
            </Button>
          )}
        </div>
        <div className="rounded-xl border border-line bg-surface max-md:border-0 max-md:bg-transparent">
          <VolTable
            rows={list}
            byTeam={byTeam}
            onOpen={(v) => setEdit({ row: v })}
            deptName={deptName}
            hideTeam
            hideNote
            extraRef={(v) => {
              const ti = teamInfo(v);
              return ti.mapped ? (
                <span className="text-[11.5px] text-warn">{tr("org.oldTeam", { team: v.team })}</span>
              ) : ti.unknown ? (
                <span className="text-[11.5px] text-bad">{tr("org.inputTeam", { team: v.team })}</span>
              ) : null;
            }}
            empty={
              <div className="px-3 py-4 text-[13px] text-ink-3">
                {canAdd(team) ? tr("org.page.rosterEmptyAdd") : tr("org.page.rosterEmpty")}
              </div>
            }
          />
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        icon={<Network />}
        title={tr("nav.org")}
        subtitle={tr("org.page.subtitle")}
        actions={
          <>
            <Button size="sm" onClick={() => volExports.orgCSV(vols, deptName)}>
              <Download />
              {tr("org.csv")}
            </Button>
            <Button size="sm" onClick={() => volExports.orgPrint(vols, deptName)}>
              <Printer />
              {tr("org.printAll")}
            </Button>
            {canWrite("volunteers") && (
              <Button size="sm" onClick={() => setPaste(true)}>
                <ClipboardPaste />
                {tr("org.pasteExcel")}
              </Button>
            )}
            {canWrite("volunteers") && (
              <Button size="sm" variant="primary" onClick={() => setEdit({})}>
                <Plus />
                {tr("org.volunteer")}
              </Button>
            )}
          </>
        }
      />

      <Officers admin={isAdmin} />

      <Card className="mb-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-ink">{tr("org.page.chartTitle")}</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              {tr("org.page.chartSub", { teams: TEAM_NAMES.length, n: vols.length - none })}
              {none > 0 && (
                <>
                  {" "}
                  · <b className="text-bad">{tr("org.page.chartNone", { n: none })}</b>
                </>
              )}{" "}
              · {tr("org.page.chartRef")}
            </p>
          </div>
          {isAdmin && <TeamAdminButtons actions={actions} />}
          <Button size="sm" variant="ghost" onClick={() => setOpen(allOpen ? new Set() : new Set(teams.map((t) => t.team)))}>
            {allOpen ? (
              <>
                <ChevronUp />
                {tr("org.page.collapseAll")}
              </>
            ) : (
              <>
                <ChevronDown />
                {tr("org.page.expandAll")}
              </>
            )}
          </Button>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : (
          <DataTable
            rows={teams}
            columns={columns}
            rowKey={(r) => r.team}
            isExpanded={(r) => open.has(r.team)}
            renderExpanded={roster}
            onRowClick={(r) => toggle(r.team)}
            rowClassName={(r) => (r.team === NO_TEAM ? "bg-bad-soft/30" : undefined)}
          />
        )}
      </Card>

      <Button className="mb-4" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll}>
        {showAll ? (
          <>
            <ChevronUp />
            {tr("org.page.hideAll")}
          </>
        ) : (
          <>
            <UserRound />
            {tr("org.page.showAll", { n: vols.length })}
          </>
        )}
      </Button>
      {showAll && (
        <Card className="mb-6 p-0 max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          <VolTable
            rows={allSorted}
            byTeam={byTeam}
            sort={sort}
            onSort={(k) => setSort((s) => nextSort(s, k))}
            onOpen={(v) => setEdit({ row: v })}
            deptName={deptName}
            hideNote
          />
        </Card>
      )}

      <DeptSection depts={depts} vols={vols} admin={isAdmin} />
      <TargetSection vols={vols} />

      <VolunteerDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} row={edit?.row} team={edit?.team} />
      <PasteImport def={pasteDef} open={paste} onOpenChange={setPaste} />
    </div>
  );
}
