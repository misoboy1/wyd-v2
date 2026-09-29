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
import { cn, matchQuery } from "@/lib/utils";
import { useDeptMap, volsByTeam, type Vol } from "@/components/org/vol";
import { VolTable, nextSort, sortVols, type VolSort } from "@/components/org/VolTable";
import { VolunteerDialog, useOwnTeam } from "@/components/org/VolunteerDialog";
import { TeamAdminButtons, useTeamActions } from "@/components/org/teamActions";
import { VolPrintPicker, volExports, volPasteDef } from "@/components/org/exports";

const ALL = "전체";

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
          <h2 className="text-[15px] font-bold text-ink">팀별 충원 현황</h2>
          <p className="text-[12.5px] text-ink-3">조직도 표준 인원 대비 · 카드를 누르면 그 팀만 보기</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={assigned >= need ? "green" : "blue"}>
            팀 배정 {assigned} / 표준 {need}~{needMax}명
          </Badge>
          {shortTeams > 0 && <Badge tone="red">부족 팀 {shortTeams}</Badge>}
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
                <Badge tone={short ? "red" : over ? "amber" : "green"}>
                  {n} / {rg ? rg.txt : "—"}명
                </Badge>
              </div>
              <div className={cn("mt-1.5 truncate text-[12px]", lead ? "text-ink-2" : "text-bad")}>
                {lead ? `${lead.role} ${lead.name}` : "팀장 미지정"}
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
            <div className="text-[13.5px] font-bold text-bad">{NO_TEAM}</div>
            <div className="mt-1.5">
              <Badge tone="red">{none}명</Badge>
            </div>
            <div className="mt-1.5 text-[12px] text-ink-3">편집에서 팀 지정</div>
          </button>
        )}
      </div>
      {admin && (actions.plan.length > 0 || actions.virtual.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
          <TeamAdminButtons actions={actions} showNormalize={false} />
          {actions.virtual.length > 0 && <span>가상 팀원 {actions.virtual.length}명 포함</span>}
        </div>
      )}
      {admin && actions.mapped.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">
            구 팀명(숙소관리·안내·통역 등)으로 입력된 봉사자 {actions.mapped.length}명은 조직도 팀으로 <b>추정</b> 표시 중입니다.
          </span>
          <Button size="sm" variant="secondary" loading={actions.busy === "norm"} onClick={() => void actions.normalize()}>
            팀명 표준화
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function Volunteers() {
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
  const pasteDef = useMemo(() => volPasteDef("봉사자", depts, own), [depts, own]);
  const add = () => setEdit({ team: TEAM_NAMES.includes(tf) ? tf : undefined });

  return (
    <div>
      <PageHeader
        icon={<HandHeart />}
        title="봉사자 명단"
        subtitle="조직도 팀 중심 · 팀별 충원 현황과 명단 · 소속 분과·구역·본당단체는 참고사항"
        actions={
          <>
            <Button size="sm" onClick={() => volExports.tasksCSV(vols, deptName)}>
              <Download />
              엑셀(CSV)
            </Button>
            <Button size="sm" onClick={() => volExports.tasksPrint(vols, deptName)}>
              <Printer />
              전체 인쇄
            </Button>
            <Button size="sm" onClick={() => setPicker(true)}>
              <ListChecks />
              선택 인쇄
            </Button>
            {writable && (
              <Button size="sm" onClick={() => setPaste(true)}>
                <ClipboardPaste />
                엑셀 붙여넣기
              </Button>
            )}
          </>
        }
      />

      {own && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-[13px] text-primary-soft-ink">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            분과 책임자 권한: <b>{own}</b> 봉사자만 추가·수정·삭제할 수 있습니다. 다른 팀은 보기만 가능합니다.
          </span>
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
          <SearchInput value={q} onChange={setQ} placeholder="검색: 이름·팀·직책·연락처·임무·언어·분과·단체" className="w-full sm:w-80" />
          <div className="w-[calc(50%-4px)] sm:w-56">
            <Select aria-label="팀 필터" value={tf} onChange={(e) => setTf(e.target.value)}>
              <option value={ALL}>전체 팀 ({vols.length}명)</option>
              {TEAM_NAMES.map((t) => (
                <option key={t} value={t}>
                  {t} ({(byTeam[t] || []).length}명)
                </option>
              ))}
              {byTeam[NO_TEAM] && (
                <option value={NO_TEAM}>
                  {NO_TEAM} ({byTeam[NO_TEAM].length}명)
                </option>
              )}
            </Select>
          </div>
          <div className="w-[calc(50%-4px)] sm:w-56">
            <Select aria-label="분과·구역(참고) 필터" title="참고 필터" value={df} onChange={(e) => setDf(e.target.value)}>
              <option value={ALL}>분과·구역(참고): 전체</option>
              {depts.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name} ({vols.filter((v) => v.deptId === d.id).length}명)
                </option>
              ))}
            </Select>
          </div>
          <Checkbox checked={grouped} onChange={setGrouped} label="팀별 묶기" />
          <span className="flex-1" />
          {writable && (
            <Button variant="primary" onClick={add}>
              <Plus />
              봉사자 추가
            </Button>
          )}
        </div>
      </div>
      <div className="mb-2 text-[12.5px] text-ink-3">
        표시 {data.length}명 / 전체 {vols.length}명
      </div>

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
              return ti.unknown ? <span className="text-[11.5px] text-bad">입력 팀명: {v.team}</span> : null;
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
