// 고리기도 일정 — 오늘·D+N·묵주기도 봉헌, 안내·예식서, 다가오는 일정, 전체 배정표(사진)
import { useMemo, useState } from "react";
import { Flower2, Pencil, Plus } from "lucide-react";
import { GORI_START, todayKST, type Gori } from "@wyd/shared";
import { useTable } from "@/lib/data";
import { useCan } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/table";
import { EditDialog } from "@/components/form/EditDialog";
import { goriDayPlus, md, mdw, RosaryCard, sortGori, weekdayIdx } from "@/components/gori/common";
import { GoriGuide, GoriRite } from "@/components/gori/RiteSection";
import { GoriPhotoCell } from "@/components/gori/PhotoCell";

/** 다음 날짜(추가 기본값) */
function nextDate(iso?: string) {
  if (!iso) return todayKST();
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + 1));
  return d.toISOString().slice(0, 10);
}

function TodayCard({ today, todayIso }: { today?: Gori; todayIso: string }) {
  const { t } = useT();
  if (!today)
    return (
      <div className="flex items-center rounded-2xl border border-line bg-surface-2 p-4 text-[13.5px] text-ink-3">
        {t("gori.todayNone", { date: todayIso })}
      </div>
    );
  const sub = t("gori.todaySub");
  return (
    <div className="flex flex-col justify-center rounded-2xl border border-primary/40 bg-primary-soft p-4">
      <div className="text-[12.5px] font-semibold text-primary">
        🙏 {t("gori.todayTitle")}
        {sub && ` · ${sub}`}
      </div>
      <div className="mt-1 text-[20px] font-bold text-ink">{today.org}</div>
      <div className="mt-0.5 text-[14px] text-ink-2">{t("gori.rep", { name: today.rep || "—" })}</div>
      {today.note && <div className="mt-1 text-[12.5px] text-ink-3">{today.note}</div>}
    </div>
  );
}
function DPlusCard({ n }: { n: number | null }) {
  const { t } = useT();
  if (n == null)
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line bg-surface-2 p-4 text-[13.5px] text-ink-3">
        {t("gori.outOfRange")}
      </div>
    );
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-primary p-4 text-primary-ink">
      <div className="text-[11.5px] font-semibold opacity-85">{t("gori.dPlusLabel")}</div>
      <div className="mt-0.5 text-[40px] leading-none font-bold tabular">{t("common.dDayPast", { n })}</div>
      <div className="mt-1.5 text-[11px] opacity-80">{t("gori.startsOn", { date: md(GORI_START) })}</div>
    </div>
  );
}

export default function GoriPage() {
  const { rows, isLoading } = useTable("gori");
  const { canWrite } = useCan();
  const { t, weekday: wdName } = useT();
  const editable = canWrite("gori");
  const [edit, setEdit] = useState<{ row: Gori | null } | null>(null);
  const todayIso = todayKST();
  const list = useMemo(() => sortGori(rows), [rows]);
  const today = list.find((g) => g.date === todayIso);
  const upcoming = list.filter((g) => g.date >= todayIso).slice(0, 7);
  const dp = goriDayPlus(list, todayIso);
  const lastDate = list[list.length - 1]?.date;
  // defaults는 매 렌더 새 객체면 편집 창 입력값이 초기화됨 → 고정
  const defaults = useMemo(() => ({ date: nextDate(lastDate), org: "", rep: "", note: "", photo: "" }), [lastDate]);

  const titleSub = t("gori.titleSub"),
    upSub = t("gori.upcomingSub"),
    fullSub = t("gori.fullSub");

  const columns: Column<Gori>[] = [
    {
      key: "date",
      header: t("gori.col.date"),
      sortValue: (g) => g.date,
      className: "whitespace-nowrap font-medium tabular",
      cell: (g) => (
        <span className="inline-flex items-center gap-1.5">
          {md(g.date)}
          {g.date === todayIso && <Badge tone="blue">{t("gori.today")}</Badge>}
        </span>
      ),
    },
    {
      key: "wd",
      header: t("gori.col.wd"),
      cell: (g) => {
        const w = weekdayIdx(g.date); // 0=일요일, 6=토요일
        return <span className={cn(w === 0 && "text-bad", w === 6 && "text-primary")}>{w < 0 ? "" : wdName(w)}</span>;
      },
    },
    { key: "org", header: t("gori.col.org"), sortValue: (g) => g.org, className: "font-semibold", cell: (g) => g.org },
    { key: "rep", header: t("gori.col.rep"), sortValue: (g) => g.rep, cell: (g) => g.rep || <span className="text-ink-3">—</span> },
    { key: "note", header: t("common.note"), hideOnMobile: true, className: "text-ink-3", cell: (g) => g.note || "—" },
    { key: "photo", header: t("gori.col.photo"), cell: (g) => <GoriPhotoCell row={g} canEdit={canWrite("gori", g)} /> },
  ];
  if (editable)
    columns.push({
      key: "act",
      header: <span className="sr-only">{t("gori.col.manage")}</span>,
      className: "w-0",
      cell: (g) => (
        <Button size="icon-sm" variant="ghost" aria-label={t("gori.editAria", { date: mdw(g.date) })} onClick={() => setEdit({ row: g })}>
          <Pencil />
        </Button>
      ),
    });

  return (
    <div>
      <PageHeader
        icon={<Flower2 />}
        title={
          <>
            {t("gori.title")} {titleSub && <span className="text-[15px] font-normal text-ink-3">{titleSub}</span>}
          </>
        }
        subtitle={t("gori.subtitle", { n: list.length })}
        actions={
          editable && (
            <Button variant="primary" onClick={() => setEdit({ row: null })}>
              <Plus />
              {t("gori.add")}
            </Button>
          )
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-[1.2fr_0.7fr_1.4fr]">
        {isLoading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <TodayCard today={today} todayIso={todayIso} />
            <DPlusCard n={dp?.n ?? null} />
          </>
        )}
        {!isLoading && <RosaryCard compact />}
      </div>

      <div className="mb-5 space-y-3">
        <GoriGuide />
        <GoriRite />
      </div>

      {upcoming.length > 0 && (
        <section className="mb-5" aria-labelledby="gori-up">
          <h2 id="gori-up" className="mb-2 text-[15px] font-semibold text-ink">
            {t("gori.upcoming")} {upSub && <span className="text-[13px] font-normal text-ink-3">· {upSub}</span>}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {upcoming.map((g) => (
              <div
                key={g.id}
                className={cn(
                  "rounded-xl border bg-surface px-3 py-2.5",
                  g.date === todayIso ? "border-primary ring-1 ring-primary" : "border-line",
                )}
              >
                <div className="text-[12px] text-ink-3">
                  {mdw(g.date)}
                  {g.note && " · " + g.note}
                </div>
                <div className="mt-0.5 text-[14px] font-semibold text-ink">{g.org}</div>
                <div className="text-[12.5px] text-ink-3">{g.rep}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Card>
        <CardHeader
          title={
            <>
              {t("gori.full")} {fullSub && <span className="font-normal text-ink-3">· {fullSub}</span>}
            </>
          }
          description={t("common.days", { n: list.length })}
        />
        {isLoading ? (
          <div className="space-y-2 px-5 pb-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <DataTable
            rows={list}
            columns={columns}
            rowKey={(g) => g.id}
            dense
            rowClassName={(g) => (g.date === todayIso ? "[&>td]:bg-primary-soft" : undefined)}
            empty={<div className="py-12 text-center text-[13.5px] text-ink-3">{t("gori.empty")}</div>}
          />
        )}
      </Card>

      <EditDialog
        table="gori"
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        row={edit?.row ?? null}
        size="md"
        title={edit?.row ? t("gori.editTitle", { date: mdw(edit.row.date) }) : t("gori.addTitle")}
        defaults={defaults}
        deleteLabel={t("gori.deleteLabel")}
      />
    </div>
  );
}
