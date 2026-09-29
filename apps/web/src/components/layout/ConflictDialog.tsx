import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { conflictBus, errorMessage, type ConflictInfo } from "@/lib/data";

const SKIP = new Set(["id", "version", "updatedAt", "slots"]);
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** 다른 사용자가 먼저 수정한 행을 저장하려 할 때: 최신 값과 내 변경을 비교해 선택 */
export function ConflictDialog() {
  const [c, setC] = useState<ConflictInfo | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => conflictBus.on(setC), []);
  if (!c) return null;
  const keys = Object.keys(c.mine).filter((k) => !SKIP.has(k) && show(c.mine[k]) !== show(c.current[k]));
  const reapply = async () => {
    setBusy(true);
    try { const m: Record<string, unknown> = {}; keys.forEach((k) => (m[k] = c.mine[k])); await c.retry(m); toast.success("내 변경을 최신 내용 위에 다시 저장했습니다."); setC(null); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && setC(null)} size="md" title="다른 사용자가 먼저 수정했습니다"
      description="화면은 최신 내용으로 바뀌었습니다. 아래 항목에서 내 변경을 다시 적용할지 선택하세요."
      footer={<><Button variant="ghost" onClick={() => setC(null)}>최신 내용 유지</Button>{keys.length > 0 && <Button variant="primary" loading={busy} onClick={() => void reapply()}>내 변경 다시 적용 ({keys.length})</Button>}</>}>
      {keys.length ? (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-2 text-ink-3"><tr><th className="px-3 py-2 text-left">항목</th><th className="px-3 py-2 text-left">최신(서버)</th><th className="px-3 py-2 text-left">내 변경</th></tr></thead>
            <tbody>{keys.map((k) => <tr key={k} className="border-t border-line"><td className="px-3 py-2 text-ink-3">{k}</td><td className="px-3 py-2">{show(c.current[k])}</td><td className="px-3 py-2 font-medium text-primary">{show(c.mine[k])}</td></tr>)}</tbody>
          </table>
        </div>
      ) : <p className="text-[14px] text-ink-2">내 변경 내용이 최신 내용과 같습니다. 그대로 두면 됩니다.</p>}
    </Dialog>
  );
}
