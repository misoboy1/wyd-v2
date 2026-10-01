import { useMemo, useState, type ReactNode } from "react";
import { UserPlus } from "lucide-react";
import { roleColor, roleRank, TEAM_NAMES, teamOf, type Volunteer } from "@wyd/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditDialog } from "@/components/form/EditDialog";
import { useTable } from "@/lib/data";
import { useCan } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Tel } from "./bits";

/**
 * 팀 명단 카드(봉사자 표에서 팀으로 자동 연동) — 환대팀·시설팀·운영팀·홈스테이팀.
 * 기존 teamRosterCard: 팀명이 같거나, 팀·임무 칸에 키워드가 들어간 봉사자.
 */
export function TeamRoster({
  icon,
  title,
  desc,
  teamName,
  keywords,
  className,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  teamName: string;
  keywords?: string[];
  className?: string;
}) {
  const { t, label } = useT();
  const { rows, enabled } = useTable("volunteers");
  const { user, canWrite } = useCan();
  const [adding, setAdding] = useState(false);
  const kwKey = (keywords ?? [teamName]).join("|");
  const list = useMemo(() => {
    const kws = kwKey.split("|");
    return rows
      .filter((v: Volunteer) => teamOf(v) === teamName || kws.some((k) => (v.team && v.team.includes(k)) || (v.task && v.task.includes(k))))
      .sort((a, b) => roleRank(a.role) - roleRank(b.role));
  }, [rows, teamName, kwKey]);
  // 홈스테이 가정 계정은 봉사자 명단을 받지 않음 → 카드 숨김
  if (!enabled || user?.role === "host") return null;
  const canAdd = TEAM_NAMES.includes(teamName) && canWrite("volunteers", { team: teamName });

  return (
    <Card className={cn("border-primary/30 bg-gradient-to-br from-primary-soft/60 to-surface p-4", className)}>
      <div className={cn("flex flex-wrap items-start justify-between gap-2", list.length ? "mb-3" : "mb-1")}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[15px] font-bold text-ink">
            <span aria-hidden>{icon}</span>
            {title}
          </div>
          <div className="mt-0.5 text-[12.5px] text-ink-3">{desc}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone={list.length ? "blue" : "amber"}>{t("common.people", { n: list.length })}</Badge>
          {canAdd && (
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
              <UserPlus />
              {t("stay.team.add")}
            </Button>
          )}
        </div>
      </div>
      {list.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
          {list.map((v) => (
            <div key={v.id} className="rounded-xl border border-line bg-surface px-3 py-2">
              <div className="flex items-center gap-1.5">
                <b className="truncate text-[14px] text-ink">{v.name}</b>
                <Badge tone={roleColor(v.role) === "amber" ? "amber" : "gray"}>{label("volRole", v.role || "팀원")}</Badge>
              </div>
              <div className="mt-0.5 text-[12.5px]">
                {v.tel ? <Tel tel={v.tel} /> : <span className="text-ink-3">{t("stay.team.noTel")}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-1 text-[12.5px] text-ink-3">
          {t("stay.team.none", { team: teamName })}
          {canAdd && t("stay.team.noneHint", { team: teamName })}
        </p>
      )}
      {canAdd && (
        <EditDialog
          table="volunteers"
          open={adding}
          onOpenChange={setAdding}
          defaults={(ADD_DEFAULTS[teamName] ??= { team: teamName })}
          title={t("stay.team.addTitle", { team: teamName })}
        />
      )}
    </Card>
  );
}
// defaults 객체가 매번 새로 만들어지면 창의 입력값이 초기화되므로 팀별로 고정
const ADD_DEFAULTS: Record<string, { team: string }> = {};
