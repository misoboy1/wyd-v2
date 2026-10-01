// D-DAY 준비 — 개막·교구대회 카운트다운, 진행률, 기간별 준비 단계(완료 표시·추가·편집·순서 변경)
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Check, Hourglass, Pencil, Plus } from "lucide-react";
import { WYD_DIOCESE, WYD_OPEN, todayKST, type PrepStep } from "@wyd/shared";
import { currentPhaseId, sortPrep } from "@/components/dash/prepUtil";
import { useSave, useTable } from "@/lib/data";
import { useCan } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Empty, PageHeader, Progress, Skeleton, Stat } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditDialog } from "@/components/form/EditDialog";
import { ddText } from "@/components/gori/common";

function StepCard({
  p,
  current,
  canEdit,
  first,
  last,
  onToggle,
  onEdit,
  onMove,
  busy,
}: {
  p: PrepStep;
  current: boolean;
  canEdit: boolean;
  first: boolean;
  last: boolean;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  const done = !!p.done;
  const { t } = useT();
  return (
    <li className="relative pl-9">
      {/* 타임라인 점 */}
      <span
        aria-hidden
        className={cn(
          "absolute top-4 left-[9px] size-3.5 rounded-full border-2",
          done ? "border-good bg-good" : current ? "border-primary bg-primary ring-4 ring-primary-soft" : "border-line-strong bg-surface",
        )}
      />
      <div
        className={cn(
          "rounded-2xl border bg-surface p-4 shadow-soft transition",
          current ? "border-primary ring-1 ring-primary" : "border-line",
          done && !current && "opacity-65",
        )}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            disabled={!canEdit}
            onClick={onToggle}
            aria-label={t(done ? "dash.prep.unmarkDone" : "dash.prep.markDone", { title: p.title })}
            className={cn(
              "mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-md border-2 transition",
              done ? "border-good bg-good text-white" : "border-line-strong bg-surface",
              canEdit ? "cursor-pointer hover:border-good" : "cursor-default",
            )}
          >
            {done && <Check className="size-3.5" strokeWidth={3} />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={current ? "blue" : "gray"}>{p.phase}</Badge>
              {current && <Badge tone="gold">{t("dash.prep.current")}</Badge>}
              {done && <Badge tone="green">{t("dash.prep.done")}</Badge>}
            </div>
            <h3 className={cn("mt-1.5 text-[15px] font-semibold text-ink", done && "line-through decoration-ink-3/50")}>{p.title}</h3>
            {p.detail && <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">{p.detail}</p>}
            {p.ref && (
              <div className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-primary">
                <BookOpen className="size-3.5" />
                {p.ref}
              </div>
            )}
          </div>
          {canEdit && (
            <div className="-mt-1 -mr-1 flex shrink-0 flex-col items-center sm:flex-row">
              <Button size="icon-sm" variant="ghost" aria-label={t("dash.prep.up")} disabled={first || busy} onClick={() => onMove(-1)}>
                <ArrowUp />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label={t("dash.prep.down")} disabled={last || busy} onClick={() => onMove(1)}>
                <ArrowDown />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label={t("dash.prep.editAria", { title: p.title })} onClick={onEdit}>
                <Pencil />
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export default function Prep() {
  const { rows, isLoading } = useTable("prep");
  const save = useSave("prep");
  const { canWrite } = useCan();
  const { t } = useT();
  const editable = canWrite("prep");
  const [edit, setEdit] = useState<{ row: PrepStep | null } | null>(null);
  const [moving, setMoving] = useState(false);

  const list = useMemo(() => sortPrep(rows), [rows]);
  const today = todayKST();
  const curId = currentPhaseId(list, today);
  const doneN = list.filter((p) => p.done).length;
  const pct = list.length ? Math.round((doneN / list.length) * 100) : 0;
  const maxSort = list.reduce((m, p) => Math.max(m, p.sort ?? 0), 0);
  const defaults = useMemo(() => ({ phase: "", title: "", detail: "", ref: "", done: false, sort: maxSort + 1 }), [maxSort]);

  const toggle = (p: PrepStep) => save.mutate({ id: p.id, version: p.version, done: !p.done });
  /** 순서 변경 — 새 순서대로 sort를 0,1,2…로 다시 매기고 바뀐 행만 저장 */
  const move = async (i: number, d: -1 | 1) => {
    const next = list.slice();
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setMoving(true);
    try {
      for (const [k, p] of next.entries()) if ((p.sort ?? 0) !== k) await save.mutateAsync({ id: p.id, version: p.version, sort: k });
    } catch {
      /* 오류 안내는 useSave가 처리 */
    } finally {
      setMoving(false);
    }
  };

  return (
    <div>
      <PageHeader
        icon={<Hourglass />}
        title={t("dash.prepLink")}
        subtitle={t("dash.prep.subtitle")}
        actions={
          editable && (
            <Button variant="primary" onClick={() => setEdit({ row: null })}>
              <Plus />
              {t("common.add")}
            </Button>
          )
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t("dash.prep.toOpen")}
          value={ddText(WYD_OPEN, today)}
          tone="primary"
          hint={t("dash.prep.openHint", { date: WYD_OPEN })}
        />
        <Stat
          label={t("dash.prep.toDiocese")}
          value={ddText(WYD_DIOCESE, today)}
          hint={t("dash.prep.dioceseHint", { date: WYD_DIOCESE })}
        />
        <Stat label={t("dash.prep.progress")} value={`${pct}%`} tone={pct === 100 ? "good" : "warn"} />
        <Stat label={t("dash.prep.doneOfTotal")} value={`${doneN} / ${list.length}`} />
      </div>
      <Progress value={pct} tone="good" className="mb-6" />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : !list.length ? (
        <Empty icon={<Hourglass />} title={t("dash.prep.empty")}>
          {editable && t("dash.prep.emptyHint")}
        </Empty>
      ) : (
        <ol
          className="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-line"
          aria-label={t("dash.prep.listAria")}
        >
          {list.map((p, i) => (
            <StepCard
              key={p.id}
              p={p}
              current={p.id === curId}
              canEdit={canWrite("prep", p)}
              first={i === 0}
              last={i === list.length - 1}
              busy={moving}
              onToggle={() => toggle(p)}
              onEdit={() => setEdit({ row: p })}
              onMove={(d) => void move(i, d)}
            />
          ))}
        </ol>
      )}
      <p className="mt-4 text-[12.5px] text-ink-3">{t("dash.prep.footnote")}</p>

      <EditDialog
        table="prep"
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        row={edit?.row ?? null}
        defaults={defaults}
        title={edit?.row ? t("dash.prep.editTitle") : t("dash.prep.addTitle")}
        deleteLabel={t("dash.prep.deleteLabel")}
      />
    </div>
  );
}
