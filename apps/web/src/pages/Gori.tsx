// 고리기도 일정 — 오늘·D+N·묵주기도 봉헌, 안내·예식서, 다가오는 일정, 전체 배정표(사진)
import { useMemo, useState } from "react";
import { Flower2, Pencil, Plus } from "lucide-react";
import { GORI_START, todayKST, type Gori } from "@wyd/shared";
import { useTable } from "@/lib/data";
import { useCan } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/table";
import { EditDialog } from "@/components/form/EditDialog";
import { goriDayPlus, md, mdw, RosaryCard, sortGori, weekday } from "@/components/gori/common";
import { GoriGuide, GoriRite } from "@/components/gori/RiteSection";
import { GoriPhotoCell } from "@/components/gori/PhotoCell";

/** 다음 날짜(추가 기본값) */
function nextDate(iso?: string) {
  if (!iso) return todayKST();
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + 1));
  return d.toISOString().slice(0, 10);
}

function TodayCard({ today, todayIso }: { today?: Gori; todayIso: string }) {
  if (!today) return (
    <div className="flex items-center rounded-2xl border border-line bg-surface-2 p-4 text-[13.5px] text-ink-3">오늘({todayIso}) 배정된 고리기도가 없습니다.</div>
  );
  return (
    <div className="flex flex-col justify-center rounded-2xl border border-primary/40 bg-primary-soft p-4">
      <div className="text-[12.5px] font-semibold text-primary">🙏 오늘의 고리기도 · Today</div>
      <div className="mt-1 text-[20px] font-bold text-ink">{today.org}</div>
      <div className="mt-0.5 text-[14px] text-ink-2">대표: {today.rep || "—"}</div>
      {today.note && <div className="mt-1 text-[12.5px] text-ink-3">{today.note}</div>}
    </div>
  );
}
function DPlusCard({ n }: { n: number | null }) {
  if (n == null) return <div className="flex items-center justify-center rounded-2xl border border-line bg-surface-2 p-4 text-[13.5px] text-ink-3">기간 외</div>;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-primary p-4 text-primary-ink">
      <div className="text-[11.5px] font-semibold opacity-85">고리기도</div>
      <div className="mt-0.5 text-[40px] leading-none font-bold tabular">D+{n}</div>
      <div className="mt-1.5 text-[11px] opacity-80">{md(GORI_START)} 시작</div>
    </div>
  );
}

export default function GoriPage() {
  const { rows, isLoading } = useTable("gori");
  const { canWrite } = useCan();
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

  const columns: Column<Gori>[] = [
    { key: "date", header: "날짜", sortValue: (g) => g.date, className: "whitespace-nowrap font-medium tabular", cell: (g) => (
      <span className="inline-flex items-center gap-1.5">{md(g.date)}{g.date === todayIso && <Badge tone="blue">오늘</Badge>}</span>) },
    { key: "wd", header: "요일", cell: (g) => { const w = weekday(g.date); return <span className={cn(w === "일" && "text-bad", w === "토" && "text-primary")}>{w}</span>; } },
    { key: "org", header: "담당 단체", sortValue: (g) => g.org, className: "font-semibold", cell: (g) => g.org },
    { key: "rep", header: "대표자", sortValue: (g) => g.rep, cell: (g) => g.rep || <span className="text-ink-3">—</span> },
    { key: "note", header: "비고", hideOnMobile: true, className: "text-ink-3", cell: (g) => g.note || "—" },
    { key: "photo", header: "사진", cell: (g) => <GoriPhotoCell row={g} canEdit={canWrite("gori", g)} /> },
  ];
  if (editable) columns.push({ key: "act", header: <span className="sr-only">관리</span>, className: "w-0", cell: (g) => (
    <Button size="icon-sm" variant="ghost" aria-label={`${mdw(g.date)} 일정 편집`} onClick={() => setEdit({ row: g })}><Pencil /></Button>) });

  return (
    <div>
      <PageHeader icon={<Flower2 />} title={<>고리기도 일정 <span className="text-[15px] font-normal text-ink-3">Prayer Chain</span></>}
        subtitle={`WYD 준비 · 단체별 고리기도 배정표 (${list.length}일) · 매일 한 단체가 순례 성공을 위해 기도`}
        actions={editable && <Button variant="primary" onClick={() => setEdit({ row: null })}><Plus />일정 추가</Button>} />

      <div className="mb-4 grid gap-3 md:grid-cols-[1.2fr_0.7fr_1.4fr]">
        {isLoading ? <><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></> : <>
          <TodayCard today={today} todayIso={todayIso} />
          <DPlusCard n={dp?.n ?? null} />
        </>}
        {!isLoading && <RosaryCard compact />}
      </div>

      <div className="mb-5 space-y-3">
        <GoriGuide />
        <GoriRite />
      </div>

      {upcoming.length > 0 && (
        <section className="mb-5" aria-labelledby="gori-up">
          <h2 id="gori-up" className="mb-2 text-[15px] font-semibold text-ink">다가오는 일정 <span className="text-[13px] font-normal text-ink-3">· Upcoming</span></h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {upcoming.map((g) => (
              <div key={g.id} className={cn("rounded-xl border bg-surface px-3 py-2.5", g.date === todayIso ? "border-primary ring-1 ring-primary" : "border-line")}>
                <div className="text-[12px] text-ink-3">{mdw(g.date)}{g.note && " · " + g.note}</div>
                <div className="mt-0.5 text-[14px] font-semibold text-ink">{g.org}</div>
                <div className="text-[12.5px] text-ink-3">{g.rep}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Card>
        <CardHeader title={<>전체 배정표 <span className="font-normal text-ink-3">· Full Schedule</span></>} description={`${list.length}일`} />
        {isLoading ? <div className="space-y-2 px-5 pb-5"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          : <DataTable rows={list} columns={columns} rowKey={(g) => g.id} dense
              rowClassName={(g) => (g.date === todayIso ? "[&>td]:bg-primary-soft" : undefined)}
              empty={<div className="py-12 text-center text-[13.5px] text-ink-3">등록된 고리기도 일정이 없습니다.</div>} />}
      </Card>

      <EditDialog table="gori" open={!!edit} onOpenChange={(o) => !o && setEdit(null)} row={edit?.row ?? null} size="md"
        title={edit?.row ? `고리기도 일정 편집 · ${mdw(edit.row.date)}` : "고리기도 일정 추가"}
        defaults={defaults}
        deleteLabel="이 날짜의 고리기도 배정을 삭제합니다. 올린 사진 연결도 함께 사라집니다." />
    </div>
  );
}
