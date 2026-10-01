import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Eraser } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm";
import { errorMessage, unassignStays } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useStayIndex } from "./useStayIndex";

type Scope = "orphan" | "unconfirmed" | "hs" | "room" | "all";

/** 배정 일괄 해제(재배정용) — 범위 선택 → '해제' 입력 확인 후 실행 */
export function ClearAssignDialog({
  open,
  onOpenChange,
  onBack,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onBack?: () => void;
}) {
  const { t } = useT();
  const qc = useQueryClient();
  const { I, visitors } = useStayIndex();
  const [scope, setScope] = useState<Scope>("orphan");
  const [busy, setBusy] = useState(false);
  const cnt = useMemo(
    () => ({
      orphan: I.orphan,
      hs: I.inHs,
      room: I.inRoom,
      all: I.inRoom + I.inHs + I.orphan,
      unconfirmed: visitors.filter((v) => (v.facilityId != null || v.homestayId != null || !!v.orphanStay) && v.status !== "확정").length,
    }),
    [I, visitors],
  );
  const opts: [Scope, string][] = [
    ["orphan", t("stay.clear.orphan")],
    ["unconfirmed", t("stay.clear.unconfirmed")],
    ["hs", t("stay.clear.hs")],
    ["room", t("stay.clear.room")],
    ["all", t("stay.clear.all")],
  ];
  const label = opts.find((o) => o[0] === scope)![1];

  const run = async () => {
    if (!cnt[scope]) {
      toast.info(t("stay.clear.nothing"));
      return;
    }
    const ok = await confirm({
      title: t("stay.clear.title"),
      danger: true,
      confirmText: t("stay.clear.run"),
      typeToConfirm: t("stay.clear.typeWord"),
      body: t("stay.clear.body", { scope: label, n: cnt[scope] }),
    });
    if (!ok) return;
    setBusy(true);
    try {
      const n = await unassignStays(qc, scope);
      toast.success(t("stay.clear.done", { n }));
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      size="sm"
      title={
        <span className="inline-flex items-center gap-2">
          <Eraser className="size-4.5" />
          {t("stay.clear.title")}
        </span>
      }
      description={t("stay.clear.desc")}
      footer={
        <>
          {onBack && (
            <Button variant="ghost" className="mr-auto" onClick={onBack} disabled={busy}>
              <ChevronLeft />
              {t("common.back")}
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" loading={busy} disabled={!cnt[scope]} onClick={() => void run()}>
            {t("stay.clear.run")}
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink-2">{t("stay.clear.scope")}</legend>
        <div className="space-y-1.5">
          {opts.map(([k, l]) => (
            <label
              key={k}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[14px] transition-colors",
                scope === k ? "border-primary bg-primary-soft/60" : "border-line hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="clear-scope"
                value={k}
                checked={scope === k}
                onChange={() => setScope(k)}
                className="accent-[var(--primary)]"
              />
              <span className="flex-1 text-ink">{l}</span>
              <span className={cn("tabular text-[13px] font-semibold", cnt[k] ? "text-ink" : "text-ink-3")}>
                {t("common.people", { n: cnt[k] })}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </Dialog>
  );
}
