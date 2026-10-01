import { Fragment, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Lock, Pencil, Plus } from "lucide-react";
import { NO_TEAM, cmpStr, roleRank, teamOf, teamOrder, teamRange, type MsgKey } from "@wyd/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCan } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  LangBadge,
  RefChips,
  RoleBadge,
  Tel,
  TeamBadge,
  isTeamLead,
  isVirtualVol,
  teamName,
  volRefText,
  volTeamSort,
  type Vol,
} from "./vol";

export type VolSortKey = "team" | "role" | "name" | "tel" | "task" | "langs" | "ref" | "note";
export interface VolSort {
  key: VolSortKey;
  dir: 1 | -1;
}

/** 기존 sortVol 규칙. grouped면 팀 순서를 먼저 */
export function sortVols(list: Vol[], sort: VolSort, grouped: boolean, deptName: (id: number | null) => string): Vol[] {
  return list.slice().sort((a, b) => {
    if (grouped) {
      const d = teamOrder(teamOf(a)) - teamOrder(teamOf(b));
      if (d) return d;
    }
    if (sort.key === "team") return volTeamSort(a, b) * sort.dir;
    if (sort.key === "role") return (roleRank(a.role) - roleRank(b.role) || cmpStr(a.name, b.name)) * sort.dir;
    if (sort.key === "ref") return cmpStr(volRefText(a, deptName(a.deptId)), volRefText(b, deptName(b.deptId))) * sort.dir;
    return cmpStr((a as any)[sort.key], (b as any)[sort.key]) * sort.dir;
  });
}
export const nextSort = (cur: VolSort, key: VolSortKey): VolSort =>
  cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: 1 };

const COLS: [VolSortKey, MsgKey][] = [
  ["team", "org.col.team"],
  ["role", "org.col.role"],
  ["name", "org.col.name"],
  ["tel", "org.col.tel"],
  ["task", "org.col.task"],
  ["langs", "org.col.langs"],
  ["ref", "org.col.ref"],
  ["note", "org.col.note"],
];

/**
 * 봉사자 표(넓은 화면) + 카드 목록(휴대폰). 팀별 묶기 시 팀 머리 행 표시.
 * 편집 권한이 없는 행은 '보기'로 열림(분과 책임자는 자기 팀만 편집).
 */
export function VolTable({
  rows,
  byTeam,
  grouped,
  sort,
  onSort,
  onOpen,
  onAddToTeam,
  deptName,
  hideTeam,
  hideNote,
  extraRef,
  empty,
}: {
  rows: Vol[];
  byTeam: Record<string, Vol[]>;
  grouped?: boolean;
  sort?: VolSort;
  onSort?: (k: VolSortKey) => void;
  onOpen: (v: Vol) => void;
  onAddToTeam?: (team: string) => void;
  deptName: (id: number | null) => string;
  hideTeam?: boolean;
  hideNote?: boolean;
  extraRef?: (v: Vol) => ReactNode;
  empty?: ReactNode;
}) {
  const { canWrite, loggedIn } = useCan();
  const { t: tr, label } = useT();
  const cols = COLS.filter(([k]) => !(hideTeam && k === "team") && !(hideNote && k === "note"));
  const canAdd = (t: string) => t !== NO_TEAM && canWrite("volunteers", { team: t });
  const groupHead = (t: string) => {
    const all = byTeam[t] || [],
      rg = teamRange(t),
      lead = all.find((x) => isTeamLead(x.role));
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("font-bold", t === NO_TEAM ? "text-bad" : "text-ink")}>{teamName(tr, t)}</span>
        <span className="text-[12.5px] text-ink-3">
          · {tr("common.people", { n: all.length })}
          {rg ? ` / ${tr("org.tbl.std", { range: rg.txt })}` : ""}
          {lead ? ` · ${label("volRole", lead.role)} ${lead.name}` : ""}
        </span>
        <span className="flex-1" />
        {onAddToTeam && canAdd(t) && (
          <Button size="sm" variant="ghost" onClick={() => onAddToTeam(t)}>
            <Plus />
            {tr("common.add")}
          </Button>
        )}
      </div>
    );
  };
  const action = (v: Vol) => {
    const w = canWrite("volunteers", v);
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(v);
        }}
        aria-label={tr(w ? "org.editName" : "org.viewName", { name: v.name })}
      >
        {w ? (
          <>
            <Pencil />
            {tr("org.edit")}
          </>
        ) : (
          <>
            <Eye />
            {tr("org.view")}
          </>
        )}
      </Button>
    );
  };
  const cell = (k: VolSortKey, v: Vol): ReactNode => {
    switch (k) {
      case "team":
        return <TeamBadge v={v} />;
      case "role":
        return <RoleBadge role={v.role} />;
      case "name":
        return (
          <span className="font-semibold whitespace-nowrap">
            {v.name}
            {isVirtualVol(v) && <Badge className="ml-1.5">{tr("org.virtual")}</Badge>}
          </span>
        );
      case "tel":
        return <Tel tel={v.tel} />;
      case "task":
        return v.task || <span className="text-ink-3">—</span>;
      case "langs":
        return <LangBadge langs={v.langs} />;
      case "ref":
        return (
          <span className="inline-flex flex-wrap items-center gap-1">
            <RefChips v={v} deptName={deptName(v.deptId)} />
            {extraRef?.(v)}
          </span>
        );
      case "note":
        return <span className="text-ink-3">{v.note || "—"}</span>;
    }
  };

  let prev: string | null = null;
  const withHeads = rows.map((v) => {
    const t = teamOf(v);
    const head = grouped && t !== prev ? t : null;
    prev = t;
    return { v, head };
  });

  if (!rows.length) return <>{empty ?? <div className="py-10 text-center text-[13.5px] text-ink-3">{tr("org.tbl.empty")}</div>}</>;
  return (
    <>
      {/* 휴대폰: 카드 */}
      <div className="flex flex-col gap-2 md:hidden">
        {withHeads.map(({ v, head }) => (
          <Fragment key={v.id}>
            {head && <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[13.5px]">{groupHead(head)}</div>}
            <div className="rounded-xl border border-line bg-surface p-3 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <RoleBadge role={v.role} />
                  {cell("name", v)}
                </div>
                <div className="-mt-1 -mr-1 flex items-center gap-1">
                  {loggedIn && !canWrite("volunteers", v) && <Lock className="size-3.5 text-ink-3" aria-label={tr("org.viewOnly")} />}
                  {action(v)}
                </div>
              </div>
              {!hideTeam && (
                <div className="mt-1.5">
                  <TeamBadge v={v} />
                </div>
              )}
              <div className="mt-1.5 text-[13px] text-ink-2">{v.task || "—"}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                <Tel tel={v.tel} />
                <LangBadge langs={v.langs} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <RefChips v={v} deptName={deptName(v.deptId)} />
                {extraRef?.(v)}
              </div>
              {!hideNote && v.note && <div className="mt-1.5 text-[12.5px] text-ink-3">{v.note}</div>}
            </div>
          </Fragment>
        ))}
      </div>
      {/* 넓은 화면: 표 */}
      <div className="overflow-x-auto max-md:hidden">
        <table className="w-full border-separate border-spacing-0 text-[13.5px]">
          <thead>
            <tr>
              {cols.map(([k, l]) => {
                const on = sort?.key === k;
                return (
                  <th
                    key={k}
                    scope="col"
                    aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                    className="border-b border-line bg-surface-2 px-3 py-2.5 text-left text-[12.5px] font-semibold whitespace-nowrap text-ink-3"
                  >
                    {onSort ? (
                      <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => onSort(k)}>
                        {tr(l)}
                        {on ? (
                          sort.dir === 1 ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      tr(l)
                    )}
                  </th>
                );
              })}
              <th scope="col" className="border-b border-line bg-surface-2 px-3 py-2.5 text-left text-[12.5px] font-semibold text-ink-3">
                {tr("org.manage")}
              </th>
            </tr>
          </thead>
          <tbody>
            {withHeads.map(({ v, head }) => (
              <Fragment key={v.id}>
                {head && (
                  <tr>
                    <td colSpan={cols.length + 1} className="border-b border-line bg-surface-2/70 px-3 py-2">
                      {groupHead(head)}
                    </td>
                  </tr>
                )}
                <tr className="group cursor-pointer" onClick={() => onOpen(v)}>
                  {cols.map(([k]) => (
                    <td
                      key={k}
                      className={cn(
                        "border-b border-line px-3 py-2.5 align-middle group-hover:bg-surface-2/60",
                        k === "task" && "min-w-40",
                        k === "note" && "max-w-56",
                      )}
                    >
                      {cell(k, v)}
                    </td>
                  ))}
                  <td className="border-b border-line px-2 py-1.5 whitespace-nowrap group-hover:bg-surface-2/60">{action(v)}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
