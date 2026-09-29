// 봉사자 공용 도우미 — 조직도·봉사자 명단 화면이 함께 씀(기존 volsByTeam·teamBadge·volRefHtml 이식)
import { useMemo } from "react";
import { AlertTriangle, Phone } from "lucide-react";
import type { Department, Volunteer } from "@wyd/shared";
import {
  NO_TEAM,
  TEAM_NAMES,
  TEAM_TASK_DEFAULT,
  VIRTUAL,
  WYD_TEAMS,
  cmpStr,
  isTeamLead,
  roleColor,
  roleRank,
  teamInfo,
  teamOf,
  teamOrder,
} from "@wyd/shared";
import { Badge } from "@/components/ui/badge";
import { Tip } from "@/components/ui/menu";
import { useTable } from "@/lib/data";
import { isBrokenTel, telHref } from "@/lib/utils";

export type Vol = Volunteer;

/** 팀별 봉사자(직책순·이름순). 팀 미배정 포함 */
export function volsByTeam(list: Vol[]): Record<string, Vol[]> {
  const g: Record<string, Vol[]> = {};
  list.forEach((v) => {
    const t = teamOf(v);
    (g[t] ||= []).push(v);
  });
  Object.values(g).forEach((a) => a.sort((x, y) => roleRank(x.role) - roleRank(y.role) || cmpStr(x.name, y.name)));
  return g;
}
export const volTeamSort = (a: Vol, b: Vol) =>
  teamOrder(teamOf(a)) - teamOrder(teamOf(b)) || roleRank(a.role) - roleRank(b.role) || cmpStr(a.name, b.name);
/** 한국어 제외 언어만 표시 */
export const showLangs = (s: string) =>
  String(s || "")
    .split(/[\/,·]/)
    .map((x) => x.trim())
    .filter((x) => x && x !== "한국어")
    .join("/");
export const isVirtualVol = (v: Vol) => String(v.note || "").includes(VIRTUAL.volMark);
/** 팀을 고르면 채워줄 기본 임무(조직도 팀 임무 첫 항목 → 구 팀명 기본값) */
export function defaultTask(team: string): string {
  const w = WYD_TEAMS.find((x: any) => x.team === team);
  if (w) return String(w.task).split(/[,，]/)[0].trim();
  return (TEAM_TASK_DEFAULT as Record<string, string>)[team] ?? "";
}
/** 표시할 팀 목록: 조직도 팀 + (있으면) 팀 미배정 */
export const teamList = (byTeam: Record<string, Vol[]>): string[] => TEAM_NAMES.concat(byTeam[NO_TEAM] ? [NO_TEAM] : []);

/** 분과·구역 id → 이름 조회(참고 정보) */
export function useDeptMap() {
  const { rows } = useTable("departments");
  return useMemo(() => {
    const sorted = rows.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id);
    const byId = new Map<number, Department>(sorted.map((d) => [d.id, d]));
    return { depts: sorted, byId, name: (id: number | null | undefined) => (id != null ? (byId.get(id)?.name ?? "") : "") };
  }, [rows]);
}
export const volRefText = (v: Vol, deptName: string) => [deptName, v.org && v.org !== "없음" ? v.org : ""].filter(Boolean).join(" / ");

// ── 표시 조각 ─────────────────────────────────────────────
export function TeamBadge({ v }: { v: Vol }) {
  const ti = teamInfo(v);
  if (ti.team === NO_TEAM)
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <Badge tone="red">{NO_TEAM}</Badge>
        {ti.unknown && <span className="text-[11.5px] text-ink-3">(입력: {ti.raw})</span>}
      </span>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone="blue">{ti.team}</Badge>
      {ti.mapped && (
        <Tip content="구 팀명에서 추정한 팀입니다. [팀명 표준화]로 확정하세요.">
          <span className="cursor-help text-[11.5px] text-warn">추정(구: {ti.raw})</span>
        </Tip>
      )}
    </span>
  );
}
export const RoleBadge = ({ role }: { role: string }) => (
  <Badge tone={roleColor(role) === "amber" ? "amber" : "gray"}>{role || "팀원"}</Badge>
);
export function LangBadge({ langs }: { langs: string }) {
  const s = showLangs(langs);
  return s ? (
    <span className="inline-flex flex-wrap gap-1">
      {s.split("/").map((l) => (
        <Badge key={l} tone="green">
          {l}
        </Badge>
      ))}
    </span>
  ) : (
    <span className="text-ink-3">—</span>
  );
}
export function RefChips({ v, deptName }: { v: Vol; deptName: string }) {
  const p = [deptName, v.org && v.org !== "없음" ? v.org : ""].filter(Boolean);
  if (!p.length) return <span className="text-ink-3">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {p.map((x) => (
        <span
          key={x}
          className="rounded-full border border-dashed border-line-strong bg-surface-2 px-2 py-px text-[11.5px] whitespace-nowrap text-ink-3"
        >
          {x}
        </span>
      ))}
    </span>
  );
}
export function Tel({ tel }: { tel: string }) {
  if (!tel) return <span className="text-ink-3">—</span>;
  if (tel.includes("••••"))
    return (
      <Tip content="공개 화면에서는 연락처를 가립니다.">
        <span className="text-ink-3">{tel}</span>
      </Tip>
    );
  if (isBrokenTel(tel))
    return (
      <Tip content="시트에서 +로 시작하는 번호가 수식으로 인식되어 깨졌습니다. 편집에서 다시 입력하세요.">
        <span className="inline-flex items-center gap-1 text-[12px] text-bad">
          <AlertTriangle className="size-3.5" />
          연락처 오류(재입력)
        </span>
      </Tip>
    );
  return (
    <a
      href={telHref(tel)}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 whitespace-nowrap text-primary hover:underline"
    >
      <Phone className="size-3" />
      {tel}
    </a>
  );
}
export { isTeamLead };
