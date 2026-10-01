import { useMemo } from "react";
import { TEAM_NAMES, teamInfo } from "@wyd/shared";
import { EditDialog } from "@/components/form/EditDialog";
import { Select } from "@/components/ui/input";
import { useCan } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { defaultTask, type Vol } from "./vol";

/** 분과 책임자는 자기 팀만 고를 수 있음(서버도 같은 규칙) */
export function useOwnTeam(): string | null {
  const { user, isAdmin } = useCan();
  if (isAdmin || user?.role !== "dept" || !user.team) return null;
  return teamInfo({ team: user.team } as any).team;
}

/** 팀 선택 — 팀을 고르면 비어 있는 담당 임무에 기본 임무를 채움 */
function TeamSelect({ v, set, own }: { v: Record<string, any>; set: (k: string, val: any) => void; own: string | null }) {
  const { t: tr } = useT();
  const opts: string[] = own ? [own] : TEAM_NAMES;
  return (
    <Select
      value={v.team ?? ""}
      onChange={(e) => {
        const t = e.target.value;
        set("team", t);
        if (!String(v.task ?? "").trim() && t) set("task", defaultTask(t));
      }}
    >
      {!own && <option value="">{tr("org.noTeam")}</option>}
      {v.team && !opts.includes(v.team) && <option value={v.team}>{tr("org.oldTeamOpt", { team: v.team })}</option>}
      {opts.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </Select>
  );
}

/**
 * 봉사자 추가·수정 창. 팀을 고르고 담당 임무가 비어 있으면 기본 임무를 채움(기존 onComboInput 동작).
 * team: 추가 시 미리 고를 팀
 */
export function VolunteerDialog({
  open,
  onOpenChange,
  row,
  team,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row?: Vol | null;
  team?: string;
}) {
  const { t: tr } = useT();
  const own = useOwnTeam();
  const defaults = useMemo(() => {
    const t = team || own || "";
    return { team: t, role: "팀원", task: t ? defaultTask(t) : "", langs: "", org: "", deptId: null, note: "", name: "", tel: "" };
  }, [team, own]);
  const custom = useMemo(
    () => ({
      team: (v: Record<string, any>, set: (k: string, val: any) => void) => <TeamSelect v={v} set={set} own={own} />,
    }),
    [own],
  );
  return (
    <EditDialog
      table="volunteers"
      open={open}
      onOpenChange={onOpenChange}
      row={row}
      defaults={defaults}
      custom={custom}
      title={row ? tr("org.dlg.edit") : tr("org.dlg.add")}
      description={own ? tr("org.dlg.descOwn", { team: own }) : tr("org.dlg.desc")}
      deleteLabel={row ? tr("org.dlg.deleteLabel", { name: row.name }) : undefined}
    />
  );
}
