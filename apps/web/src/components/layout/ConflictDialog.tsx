import { toStr } from "@wyd/shared";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { conflictBus, errorMessage, type ConflictInfo } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { fieldLabel } from "@/components/form/RecordForm";

const SKIP = new Set(["id", "version", "updatedAt", "slots"]);
const show = (v: unknown) => toStr(v) || "—";

/** 다른 사용자가 먼저 수정한 행을 저장하려 할 때: 최신 값과 내 변경을 비교해 선택 */
export function ConflictDialog() {
  const [c, setC] = useState<ConflictInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const { t, td } = useT();
  useEffect(() => conflictBus.on(setC), []);
  if (!c) return null;
  const keys = Object.keys(c.mine).filter((k) => !SKIP.has(k) && show(c.mine[k]) !== show(c.current[k]));
  const reapply = async () => {
    setBusy(true);
    try {
      const m: Record<string, unknown> = {};
      keys.forEach((k) => (m[k] = c.mine[k]));
      await c.retry(m);
      toast.success(t("shell.conflict.reapplied"));
      setC(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && setC(null)}
      size="md"
      title={t("shell.conflict.title")}
      description={t("shell.conflict.desc")}
      footer={
        <>
          <Button variant="ghost" onClick={() => setC(null)}>
            {t("shell.conflict.keepLatest")}
          </Button>
          {keys.length > 0 && (
            <Button variant="primary" loading={busy} onClick={() => void reapply()}>
              {t("shell.conflict.reapply", { n: keys.length })}
            </Button>
          )}
        </>
      }
    >
      {keys.length ? (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-2 text-ink-3">
              <tr>
                <th className="px-3 py-2 text-left">{t("shell.conflict.field")}</th>
                <th className="px-3 py-2 text-left">{t("shell.conflict.latest")}</th>
                <th className="px-3 py-2 text-left">{t("shell.conflict.mine")}</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k} className="border-t border-line">
                  <td className="px-3 py-2 text-ink-3">{fieldLabel(td, c.table, k)}</td>
                  <td className="px-3 py-2">{show(c.current[k])}</td>
                  <td className="px-3 py-2 font-medium text-primary">{show(c.mine[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[14px] text-ink-2">{t("shell.conflict.same")}</p>
      )}
    </Dialog>
  );
}
