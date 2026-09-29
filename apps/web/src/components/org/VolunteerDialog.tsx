import { useMemo } from "react";
import { TEAM_NAMES, teamInfo } from "@wyd/shared";
import { EditDialog } from "@/components/form/EditDialog";
import { Select } from "@/components/ui/input";
import { useCan } from "@/lib/auth";
import { defaultTask, type Vol } from "./vol";

/** 분과 책임자는 자기 팀만 고를 수 있음(서버도 같은 규칙) */
export function useOwnTeam(): string | null {
  const { user, isAdmin } = useCan();
  if (isAdmin || user?.role !== "dept" || !user.team) return null;
  return teamInfo({ team: user.team } as any).team;
}

/**
 * 봉사자 추가·수정 창. 팀을 고르고 담당 임무가 비어 있으면 기본 임무를 채움(기존 onComboInput 동작).
 * team: 추가 시 미리 고를 팀
 */
export function VolunteerDialog({ open, onOpenChange, row, team }: { open: boolean; onOpenChange: (v: boolean) => void; row?: Vol | null; team?: string }) {
  const own = useOwnTeam();
  const defaults = useMemo(() => {
    const t = team || own || "";
    return { team: t, role: "팀원", task: t ? defaultTask(t) : "", langs: "", org: "", deptId: null, note: "", name: "", tel: "" };
  }, [team, own]);
  const custom = useMemo(() => ({
    team: (v: Record<string, any>, set: (k: string, val: any) => void) => {
      const opts: string[] = own ? [own] : (TEAM_NAMES as string[]);
      return (
        <Select value={v.team ?? ""} onChange={(e) => {
          const t = e.target.value;
          set("team", t);
          if (!String(v.task ?? "").trim() && t) set("task", defaultTask(t));
        }}>
          {!own && <option value="">팀 미배정</option>}
          {v.team && !opts.includes(v.team) && <option value={v.team}>{v.team} (구 팀명)</option>}
          {opts.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      );
    },
  }), [own]);
  return (
    <EditDialog table="volunteers" open={open} onOpenChange={onOpenChange} row={row} defaults={defaults} custom={custom}
      title={row ? "봉사자 수정" : "봉사자 추가"}
      description={own ? `분과 책임자는 ${own} 봉사자만 추가·수정할 수 있습니다.` : "팀은 조직도 기준입니다. 분과·구역·본당단체는 참고 정보입니다."}
      deleteLabel={row ? `${row.name} 봉사자를 삭제합니다. 되돌릴 수 없습니다.` : undefined} />
  );
}
