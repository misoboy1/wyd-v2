import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { PARISH } from "@wyd/shared";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/misc";
import { printDocument } from "@/lib/print";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { groupOrder, type CountUnit, type ExportCol } from "./stay";

/**
 * 선택 인쇄(기존 PRINT_PICKERS) — 묶음 기준을 고르고 인쇄할 항목만 체크해 한 문서로 인쇄.
 * rows는 화면 정렬 순서 그대로(묶음 순서 = 처음 등장 순서)
 */
export function PrintPicker<T>({
  open,
  onOpenChange,
  label,
  unit,
  groupers,
  keyOf,
  rows,
  cols,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  label: string;
  unit: CountUnit;
  groupers: [string, string][];
  keyOf: (r: T, by: string) => string;
  rows: T[];
  cols: ExportCol<T>[];
}) {
  const { t } = useT();
  const [by, setBy] = useState(groupers[0][0]);
  const { order, count } = useMemo(() => groupOrder(rows, (r) => keyOf(r, by)), [rows, by, keyOf]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // 창을 열 때·기준을 바꿀 때만 전체 선택으로 초기화(실시간 갱신으로 선택이 풀리지 않게)
  const orderRef = useRef(order);
  orderRef.current = order;
  useEffect(() => {
    if (open) setPicked(new Set(orderRef.current));
  }, [open, by]);
  const glabel = groupers.find((g) => g[0] === by)?.[1] ?? t("stay.print.group");

  const print = () => {
    const keys = order.filter((k) => picked.has(k));
    if (!keys.length) {
      toast.warning(t("stay.print.none"));
      return;
    }
    const total = keys.reduce((s, k) => s + (count.get(k) || 0), 0);
    printDocument(
      t("stay.print.docTitle", { parish: PARISH.name, label, group: glabel }),
      keys.map((k) => ({
        heading: `${glabel} · ${k}`,
        note: t(`stay.unit.${unit}`, { n: count.get(k) || 0 }),
        columns: cols.map((c) => c[0]),
        rows: rows.filter((r) => keyOf(r, by) === k).map((r) => cols.map(([, g]) => g(r))),
      })),
      { subtitle: t("stay.print.subtitle", { group: glabel, n: keys.length, total: t(`stay.unit.${unit}`, { n: total }) }) },
    );
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t("stay.print.title", { label })}
      description={t("stay.print.desc")}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={print} disabled={!picked.size}>
            <Printer />
            {t("stay.print.printSel")}
          </Button>
        </>
      }
    >
      <div className="mb-1.5 text-[12.5px] text-ink-3">{t("stay.print.groupBy")}</div>
      <Segmented value={by} onChange={setBy} options={groupers.map(([value, l]) => ({ value, label: l }))} className="mb-3" />
      <div className="mb-2 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setPicked(new Set(order))}>
          {t("stay.print.selectAll")}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setPicked(new Set())}>
          {t("stay.print.clearAll")}
        </Button>
        <span className="ml-auto self-center text-[12.5px] text-ink-3">
          {t("stay.print.picked", { n: picked.size, total: order.length })}
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-xl border border-line">
        {order.length ? (
          order.map((k) => (
            <label
              key={k}
              className={cn("flex cursor-pointer items-center gap-2.5 border-b border-line px-3 py-2 last:border-b-0 hover:bg-surface-2")}
            >
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={picked.has(k)}
                onChange={(e) =>
                  setPicked((s) => {
                    const n = new Set(s);
                    if (e.target.checked) n.add(k);
                    else n.delete(k);
                    return n;
                  })
                }
              />
              <span className="font-semibold text-ink">{k}</span>
              <span className="text-[12.5px] text-ink-3">· {t(`stay.unit.${unit}`, { n: count.get(k) || 0 })}</span>
            </label>
          ))
        ) : (
          <div className="px-3 py-6 text-center text-[13px] text-ink-3">{t("common.empty")}</div>
        )}
      </div>
    </Dialog>
  );
}
