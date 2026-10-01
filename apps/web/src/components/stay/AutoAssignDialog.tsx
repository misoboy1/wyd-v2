import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Zap } from "lucide-react";
import { AA_DEFAULT, planAutoAssign, type AutoAssignOptions } from "@wyd/shared";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/input";
import { Segmented, Stat, Progress } from "@/components/ui/misc";
import { confirm } from "@/components/ui/confirm";
import { assignStays, errorMessage, toastBulk } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { useStayIndex } from "./useStayIndex";
import { ClearAssignDialog } from "./ClearAssignDialog";

// 창을 닫았다 열어도 마지막 옵션 유지
let savedOpt: AutoAssignOptions = { ...AA_DEFAULT };

/**
 * ⚡ 숙소 자동 배정 — 미리보기(공용 planAutoAssign) 확인 후 적용해야 저장.
 * 서버가 행마다 정원·성별 규칙을 다시 검사(assignStays).
 */
export function AutoAssignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t, label, num } = useT();
  const qc = useQueryClient();
  const { visitors, facilities, homestays } = useStayIndex();
  const [opt, setOptState] = useState<AutoAssignOptions>(savedOpt);
  const [busy, setBusy] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const setOpt = <K extends keyof AutoAssignOptions>(k: K, v: AutoAssignOptions[K]) => setOptState((o) => (savedOpt = { ...o, [k]: v }));

  const P = useMemo(
    () => (open ? planAutoAssign(visitors, facilities, homestays, opt) : null),
    [open, visitors, facilities, homestays, opt],
  );
  const nRoom = P ? P.plan.filter((x) => x.kind === "room").length : 0;
  const nHs = P ? P.plan.length - nRoom : 0;
  const singles = P ? P.slots.filter((s) => s.kind === "hs" && s.n0 + s.add.length === 1).length : 0;
  const skipTxt = P
    ? [
        P.skip.moved ? t("stay.aa.skipMoved", { n: P.skip.moved }) : "",
        P.skip.orphanIncluded ? t("stay.aa.skipOrphan", { n: P.skip.orphanIncluded }) : "",
        P.skip.noSex ? t("stay.aa.skipNoSex", { n: P.skip.noSex }) : "",
        P.skip.waiting ? t("stay.aa.skipWaiting", { n: P.skip.waiting }) : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const apply = async () => {
    if (!P || !P.plan.length) return;
    if (
      !(await confirm({
        title: t("stay.aa.confirmTitle"),
        body: t("stay.aa.confirmBody", { n: P.plan.length }),
        confirmText: t("stay.aa.apply"),
      }))
    )
      return;
    const byId = new Map(visitors.map((v) => [v.id, v]));
    const changes = P.plan.flatMap((x) => {
      const v = byId.get(x.visitorId);
      return v
        ? [
            {
              id: v.id,
              version: v.version,
              facilityId: x.kind === "room" ? x.targetId : null,
              homestayId: x.kind === "hs" ? x.targetId : null,
            },
          ]
        : [];
    });
    setBusy(`0 / ${changes.length}`);
    try {
      const res = await assignStays(qc, changes, (d, n) => setBusy(`${d} / ${n}`));
      toastBulk(t("stay.aa.toast"), res);
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const unplacedSex = P ? [...new Set(P.unplaced.map((v) => label("sex", v.sex) || "?"))].join("·") : "";
  const progress = busy ? busy.split(" / ").map(Number) : null;

  return (
    <>
      <Dialog
        open={open && !clearOpen}
        onOpenChange={(o) => !busy && onOpenChange(o)}
        size="lg"
        title={
          <span className="inline-flex items-center gap-2">
            <Zap className="size-4.5 text-gold" />
            {t("stay.aa.title")}
          </span>
        }
        description={
          <>
            {t("stay.aa.descA")}
            <b className="text-ink-2">{t("stay.aa.apply")}</b>
            {t("stay.aa.descB")}
          </>
        }
        footer={
          <>
            <Button variant="danger-ghost" className="mr-auto" disabled={!!busy} onClick={() => setClearOpen(true)}>
              {t("stay.aa.clear")}
            </Button>
            {busy && <span className="text-[13px] text-ink-3 tabular">{t("stay.aa.saving", { progress: busy })}</span>}
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={!!busy}>
              {t("common.close")}
            </Button>
            <Button variant="primary" loading={!!busy} disabled={!P?.plan.length} onClick={() => void apply()}>
              {t("stay.aa.applyN", { n: P?.plan.length ?? 0 })}
            </Button>
          </>
        }
      >
        {P && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-ink-3">{t("stay.aa.prefer")}</span>
              <Segmented
                value={opt.prefer}
                onChange={(v) => setOpt("prefer", v)}
                options={[
                  { value: "hs", label: t("stay.aa.preferHs") },
                  { value: "room", label: t("stay.aa.preferRoom") },
                ]}
              />
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              <Checkbox checked={opt.rOnly} onChange={(v) => setOpt("rOnly", v)} label={t("stay.aa.optROnly")} />
              <Checkbox checked={opt.lang} onChange={(v) => setOpt("lang", v)} label={t("stay.aa.optLang")} />
              <Checkbox checked={opt.confirmedOnly} onChange={(v) => setOpt("confirmedOnly", v)} label={t("stay.aa.optConfirmed")} />
              <Checkbox checked={opt.includeWaiting} onChange={(v) => setOpt("includeWaiting", v)} label={t("stay.aa.optWaiting")} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={t("stay.aa.statTargets")} value={num(P.targets)} />
              <Stat label={t("stay.aa.statRoom")} value={num(nRoom)} tone="primary" />
              <Stat label={t("stay.aa.statHs")} value={num(nHs)} tone="warn" />
              <Stat label={t("stay.aa.statShort")} value={num(P.unplaced.length)} tone={P.unplaced.length ? "bad" : undefined} />
            </div>
            {progress && <Progress value={progress[0]} max={progress[1] || 1} />}
            <div className="space-y-1.5 text-[12.5px]">
              {skipTxt && <Note tone="warn">{t("stay.aa.skipNote", { list: skipTxt })}</Note>}
              {singles > 0 && <Note tone="warn">{t("stay.aa.singles", { n: singles })}</Note>}
              {P.unplaced.length > 0 && <Note tone="bad">{t("stay.aa.unplaced", { n: P.unplaced.length, sex: unplacedSex })}</Note>}
            </div>
            <div>
              <div className="mb-1.5 text-[13px] font-semibold text-ink">
                {t("stay.aa.preview", { n: P.slots.length })}
                {P.slots.length > 300 && t("stay.aa.previewCap")}
              </div>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-line">
                {P.slots.length ? (
                  P.slots.slice(0, 300).map((s) => {
                    const gs = [...new Set(s.add.map((v) => v.gno || t("stay.aa.individual")))].join(", ");
                    const sx = s.add[0]?.sex || "";
                    return (
                      <div
                        key={s.kind + s.id}
                        className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-[13px] last:border-b-0"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Badge tone={s.kind === "room" ? "blue" : "amber"}>
                            {s.kind === "room" ? t("stay.aa.roomBadge") : t("stay.aa.hsBadge")}
                          </Badge>
                          <b className="truncate text-ink">{s.label}</b>
                          <span className="truncate text-[12px] text-ink-3">{gs}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap tabular">
                          {s.n0 > 0 && <span className="text-[12px] text-ink-3">{t("stay.aa.existing", { n: s.n0 })}</span>}
                          {t("stay.aa.plus", { n: s.add.length })}
                          {sx && <Badge tone={sx === "남" ? "blue" : "amber"}>{label("sex", sx)}</Badge>}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-6 text-center text-[13px] text-ink-3">{t("stay.aa.noTargets")}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </Dialog>
      <ClearAssignDialog
        open={open && clearOpen}
        onOpenChange={(o) => {
          if (!o) {
            setClearOpen(false);
            onOpenChange(false);
          }
        }}
        onBack={() => setClearOpen(false)}
      />
    </>
  );
}

function Note({ tone, children }: { tone: "warn" | "bad"; children: ReactNode }) {
  return (
    <div
      className={
        tone === "bad"
          ? "flex gap-1.5 rounded-lg bg-bad-soft px-3 py-2 text-bad"
          : "flex gap-1.5 rounded-lg bg-warn-soft px-3 py-2 text-warn"
      }
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
