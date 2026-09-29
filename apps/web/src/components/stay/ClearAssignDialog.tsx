import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Eraser } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm";
import { errorMessage, unassignStays } from "@/lib/data";
import { cn, num } from "@/lib/utils";
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
    ["orphan", "연결 끊김만"],
    ["unconfirmed", "상태가 '확정'이 아닌 방문자"],
    ["hs", "홈스테이 배정 전체"],
    ["room", "교리실 배정 전체"],
    ["all", "모든 배정"],
  ];
  const label = opts.find((o) => o[0] === scope)![1];

  const run = async () => {
    if (!cnt[scope]) {
      toast.info("해제할 대상이 없습니다.");
      return;
    }
    const ok = await confirm({
      title: "배정 일괄 해제",
      danger: true,
      confirmText: "해제 실행",
      typeToConfirm: "해제",
      body: (
        <>
          「{label}」 범위의 방문자 <b>{num(cnt[scope])}명</b>이 '미배정'이 됩니다. 되돌릴 수 없습니다.
        </>
      ),
    });
    if (!ok) return;
    setBusy(true);
    try {
      const n = await unassignStays(qc, scope);
      toast.success(`배정 해제 ${num(n)}명 완료`);
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
          배정 일괄 해제
        </span>
      }
      description="자동 배정을 다시 돌리기 전에 기존 배정을 비울 때 사용합니다. 선택한 범위의 방문자가 '미배정'이 됩니다."
      footer={
        <>
          {onBack && (
            <Button variant="ghost" className="mr-auto" onClick={onBack} disabled={busy}>
              <ChevronLeft />
              뒤로
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            취소
          </Button>
          <Button variant="danger" loading={busy} disabled={!cnt[scope]} onClick={() => void run()}>
            해제 실행
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink-2">해제 범위</legend>
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
              <span className={cn("tabular text-[13px] font-semibold", cnt[k] ? "text-ink" : "text-ink-3")}>{num(cnt[k])}명</span>
            </label>
          ))}
        </div>
      </fieldset>
    </Dialog>
  );
}
