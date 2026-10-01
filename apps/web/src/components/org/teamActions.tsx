// 관리자용 팀 일괄 작업 — 팀명 표준화, 가상 팀원 채우기/지우기(기존 normalizeTeams·fillVirtualTeams·removeVirtualTeams)
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Trash2, Wand2 } from "lucide-react";
import { VG_TEAMS, VIRTUAL, isTeamLead, teamInfo, teamOf } from "@wyd/shared";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm";
import { api } from "@/lib/api";
import { bulkSave, tableKey, toastBulk } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { isVirtualVol, type Vol } from "./vol";

/** 봉사자: ① 모든 팀 최소 인원(빈 팀 없게) → ② 전체가 목표 인원 미만이면 최대 인원 이하인 팀에 차례로 배분 */
export function vgVolunteerPlan(vols: Vol[]) {
  const T = VG_TEAMS as [string, number, number, string][];
  const cnt: Record<string, number> = {},
    lead: Record<string, boolean> = {},
    youth: Record<string, boolean> = {};
  T.forEach((t) => {
    cnt[t[0]] = 0;
    lead[t[0]] = false;
    youth[t[0]] = false;
  });
  vols.forEach((v) => {
    const t = teamOf(v);
    if (cnt[t] === undefined) return;
    cnt[t]++;
    if (t === T[0][0] ? v.role === "봉사단장" : isTeamLead(v.role)) lead[t] = true;
    if (v.role === "청년대표") youth[t] = true;
  });
  let total = vols.length;
  const add: Record<string, any>[] = [];
  const push = (t: (typeof T)[number]) => {
    const head = t[0] === T[0][0];
    let role = "팀원";
    if (!lead[t[0]]) {
      role = head ? "봉사단장" : "팀장";
      lead[t[0]] = true;
    } else if (head && !youth[t[0]]) {
      role = "청년대표";
      youth[t[0]] = true;
    }
    add.push({
      name: VIRTUAL.name,
      tel: VIRTUAL.tel,
      team: t[0],
      role,
      task: t[3],
      langs: "한국어",
      org: "",
      deptId: null,
      note: VIRTUAL.volMark,
    });
    cnt[t[0]]++;
    total++;
  };
  T.forEach((t) => {
    while (cnt[t[0]] < t[1]) push(t);
  }); // ① 팀별 최소 인원은 전체 인원과 관계없이 항상 채움
  let grew = true;
  while (total < VIRTUAL.target.volunteers && grew) {
    grew = false;
    T.forEach((t) => {
      if (total < VIRTUAL.target.volunteers && cnt[t[0]] < t[2]) {
        push(t);
        grew = true;
      }
    });
  }
  return add;
}

export function useTeamActions(vols: Vol[]) {
  const { t } = useT();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const mapped = useMemo(() => vols.filter((v) => teamInfo(v).mapped), [vols]);
  const plan = useMemo(() => vgVolunteerPlan(vols), [vols]);
  const virtual = useMemo(() => vols.filter(isVirtualVol), [vols]);

  /** 구 팀명을 조직도 팀명으로 확정 저장. 원래 팀명은 비고에 남김 */
  const normalize = async () => {
    if (!mapped.length) return toast.info(t("org.act.noMapped"));
    const sum = new Map<string, number>();
    mapped.forEach((v) => {
      const k = `${v.team} → ${teamOf(v)}`;
      sum.set(k, (sum.get(k) ?? 0) + 1);
    });
    const ok = await confirm({
      title: t("org.act.normTitle", { n: mapped.length }),
      body: (
        <div className="space-y-2">
          <ul className="list-disc pl-5">
            {[...sum].map(([k, n]) => (
              <li key={k}>{t("org.act.normItem", { label: k, n })}</li>
            ))}
          </ul>
          <p>{t("org.act.normBody")}</p>
        </div>
      ),
      confirmText: t("org.act.normConfirm"),
    });
    if (!ok) return;
    setBusy("norm");
    const res = await bulkSave(
      qc,
      "volunteers",
      mapped.map((v) => ({ id: v.id, version: v.version, team: teamOf(v), note: (v.note ? v.note + " / " : "") + "구 팀명:" + v.team })),
    );
    setBusy(null);
    toastBulk(t("org.act.normToast"), res);
  };

  const fill = async () => {
    if (!plan.length) return toast.info(t("org.act.fillNone", { target: VIRTUAL.target.volunteers }));
    const ok = await confirm({
      title: t("org.act.fillTitle", { n: plan.length }),
      body: t("org.act.fillBody", { name: VIRTUAL.name, mark: VIRTUAL.volMark, target: VIRTUAL.target.volunteers }),
    });
    if (!ok) return;
    setBusy("fill");
    const res = await bulkSave(qc, "volunteers", plan);
    setBusy(null);
    toastBulk(t("org.act.fillToast"), res);
  };

  const clear = async () => {
    if (!virtual.length) return toast.info(t("org.act.clearNone"));
    if (
      !(await confirm({
        title: t("org.act.clearTitle"),
        body: t("org.act.clearBody", { mark: VIRTUAL.volMark, n: virtual.length }),
        danger: true,
        confirmText: t("common.delete"),
      }))
    )
      return;
    setBusy("clear");
    let ng = 0;
    // 10건씩 병렬 삭제
    for (let i = 0; i < virtual.length; i += 10) {
      const r = await Promise.allSettled(virtual.slice(i, i + 10).map((v) => api.del(`/t/volunteers/${v.id}?version=${v.version}`)));
      ng += r.filter((x) => x.status === "rejected").length;
    }
    await qc.invalidateQueries({ queryKey: tableKey("volunteers") });
    setBusy(null);
    if (ng) toast.warning(t("org.act.clearPartial", { ok: virtual.length - ng, ng }));
    else toast.success(t("org.act.clearDone", { n: virtual.length }));
  };

  return { mapped, plan, virtual, busy, normalize, fill, clear };
}

/** 관리자 버튼 묶음 */
export function TeamAdminButtons({
  actions,
  showNormalize = true,
}: {
  actions: ReturnType<typeof useTeamActions>;
  showNormalize?: boolean;
}) {
  const { t } = useT();
  const a = actions;
  return (
    <>
      {showNormalize && a.mapped.length > 0 && (
        <Button
          size="sm"
          variant="secondary"
          className="border-warn text-warn"
          loading={a.busy === "norm"}
          onClick={() => void a.normalize()}
        >
          <Wand2 />
          {t("org.act.normBtn", { n: a.mapped.length })}
        </Button>
      )}
      {a.plan.length > 0 && (
        <Button size="sm" variant="secondary" loading={a.busy === "fill"} onClick={() => void a.fill()}>
          <Sparkles />
          {t("org.act.fillBtn", { n: a.plan.length, target: VIRTUAL.target.volunteers })}
        </Button>
      )}
      {a.virtual.length > 0 && (
        <Button size="sm" variant="danger-ghost" loading={a.busy === "clear"} onClick={() => void a.clear()}>
          <Trash2 />
          {t("org.act.clearBtn", { n: a.virtual.length })}
        </Button>
      )}
    </>
  );
}
