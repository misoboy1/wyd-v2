// 일정표 — 교구대회·본대회 날짜 카드, 선택한 날의 준비사항과 시간대별 항목(관리자 편집)
import { useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { todayKST, type ScheduleDay } from "@wyd/shared";
import { useTable } from "@/lib/data";
import { useCan } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Empty, PageHeader, Skeleton } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditDialog } from "@/components/form/EditDialog";
import { SlotDialog, deleteSlot, orderedSlots, useSaveSlots } from "@/components/schedule/SlotDialog";

const isDiocese = (s: ScheduleDay) => String(s.event || "").includes("교구대회");
const stripTag = (e: string) => String(e || "").replace(/^\[[^\]]*\]\s*/, "");
/** "7/29 (목)" 형식 날짜가 오늘(한국 시간)과 같은지 */
function isToday(date: string, today = todayKST()) {
  const m = String(date).match(/^(\d{1,2})\/(\d{1,2})/);
  return !!m && +m[1] === +today.slice(5, 7) && +m[2] === +today.slice(8, 10);
}

function DayCard({ s, on, onPick }: { s: ScheduleDay; on: boolean; onPick: () => void }) {
  const today = isToday(s.date);
  const { t } = useT();
  const n = (s.slots ?? []).length;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      className={cn(
        "flex w-40 shrink-0 flex-col rounded-2xl border p-3.5 text-left transition sm:w-auto",
        on
          ? "border-primary bg-primary-soft ring-1 ring-primary"
          : "border-line bg-surface shadow-soft hover:border-line-strong hover:shadow-card",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[15px] font-bold text-primary tabular">{s.date}</span>
        {today && <Badge tone="gold">{t("dash.schedule.today")}</Badge>}
      </div>
      <div className="mt-1.5 line-clamp-2 min-h-9 text-[13px] leading-snug text-ink">{stripTag(s.event)}</div>
      <div className="mt-2 text-[11.5px] text-ink-3">
        {n ? t("dash.schedule.slotCount", { n }) : t("dash.schedule.noSlots")}
        {on && <span className="font-semibold text-primary">{t("dash.schedule.viewing")}</span>}
      </div>
    </button>
  );
}

function Section({
  title,
  sub,
  days,
  cur,
  onPick,
}: {
  title: string;
  sub: string;
  days: ScheduleDay[];
  cur?: number;
  onPick: (id: number) => void;
}) {
  if (!days.length) return null;
  return (
    <section className="mb-5" aria-label={title}>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        <span className="text-[12.5px] text-ink-3">{sub}</span>
      </div>
      {/* 모바일은 가로로 넘겨 보기, 넓은 화면은 격자 */}
      <div className="-mx-3 flex gap-2.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4 xl:grid-cols-6">
        {days.map((s) => (
          <DayCard key={s.id} s={s} on={s.id === cur} onPick={() => onPick(s.id)} />
        ))}
      </div>
    </section>
  );
}

export default function Schedule() {
  const { rows, isLoading } = useTable("schedule");
  const { canWrite } = useCan();
  const { t } = useT();
  const editable = canWrite("schedule");
  const saveSlots = useSaveSlots();
  const [picked, setPicked] = useState<number | null>(null);
  const [dayEdit, setDayEdit] = useState<{ row: ScheduleDay | null } | null>(null);
  const [slotEdit, setSlotEdit] = useState<{ index: number | null } | null>(null);

  const sched = useMemo(() => rows.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id), [rows]);
  // 선택: 누른 날 → 오늘 → 첫날
  const day = sched.find((s) => s.id === picked) ?? sched.find((s) => isToday(s.date)) ?? sched[0];
  const slots = day ? orderedSlots(day) : [];
  const maxSort = sched.reduce((m, s) => Math.max(m, s.sort ?? 0), 0);
  const defaults = useMemo(() => ({ date: "", event: "", prep: "", sort: maxSort + 1, slots: [] }), [maxSort]);
  const canDay = !!day && canWrite("schedule", day);

  return (
    <div>
      <PageHeader
        icon={<CalendarDays />}
        title={t("nav.schedule")}
        subtitle={t("dash.schedule.subtitle")}
        actions={
          editable && (
            <Button variant="primary" onClick={() => setDayEdit({ row: null })}>
              <Plus />
              {t("dash.schedule.addDay")}
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-48" />
        </div>
      ) : !sched.length ? (
        <Card>
          <Empty icon={<CalendarDays />} title={t("dash.schedule.empty")}>
            {editable && t("dash.schedule.emptyHint")}
          </Empty>
        </Card>
      ) : (
        <>
          <Section title={t("dash.schedule.diocese")} sub="7/29~8/2" days={sched.filter(isDiocese)} cur={day?.id} onPick={setPicked} />
          <Section
            title={t("dash.schedule.main")}
            sub="8/3~8/8"
            days={sched.filter((s) => !isDiocese(s))}
            cur={day?.id}
            onPick={setPicked}
          />

          {day && (
            <Card className="mt-6 overflow-hidden" aria-live="polite">
              <div className="border-l-4 border-primary px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-bold text-ink">
                      <span className="text-primary">{day.date}</span> · {day.event}
                    </h2>
                    <div className="mt-2 flex gap-2 text-[13.5px] leading-relaxed text-ink-2">
                      <ClipboardList className="mt-0.5 size-4 shrink-0 text-ink-3" />
                      <div>
                        <span className="font-medium text-ink">{t("dash.schedule.prepLabel")}</span>{" "}
                        <span className="whitespace-pre-wrap">{day.prep || "—"}</span>
                      </div>
                    </div>
                  </div>
                  {canDay && (
                    <Button size="sm" onClick={() => setDayEdit({ row: day })}>
                      <Pencil />
                      {t("dash.schedule.editDay")}
                    </Button>
                  )}
                </div>
              </div>

              <div className="border-t border-line">
                <div className="flex items-center justify-between px-5 pt-3 pb-2">
                  <h3 className="text-[14px] font-semibold text-ink">{t("dash.schedule.slotsTitle")}</h3>
                  {canDay && (
                    <Button size="sm" variant="soft" onClick={() => setSlotEdit({ index: null })}>
                      <Plus />
                      {t("dash.schedule.addSlot")}
                    </Button>
                  )}
                </div>
                {!slots.length ? (
                  <div className="px-5 pb-5 text-[13.5px] text-ink-3">{t("dash.schedule.noSlotItems")}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13.5px]">
                      <thead>
                        <tr className="text-left text-[12.5px] text-ink-3">
                          <th scope="col" className="border-b border-line bg-surface-2 px-5 py-2 font-semibold">
                            {t("dash.schedule.colTime")}
                          </th>
                          <th scope="col" className="border-b border-line bg-surface-2 px-3 py-2 font-semibold">
                            {t("dash.schedule.colText")}
                          </th>
                          <th scope="col" className="border-b border-line bg-surface-2 px-3 py-2 font-semibold">
                            {t("dash.schedule.colWho")}
                          </th>
                          {canDay && (
                            <th scope="col" className="border-b border-line bg-surface-2 px-3 py-2">
                              <span className="sr-only">{t("dash.schedule.colManage")}</span>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {slots.map((sl, i) => (
                          <tr key={sl.id ?? `n${i}`} className="hover:bg-surface-2/60">
                            <td className="border-b border-line px-5 py-2.5 align-top font-semibold whitespace-nowrap text-primary tabular">
                              {sl.time}
                            </td>
                            <td className="border-b border-line px-3 py-2.5 align-top whitespace-pre-wrap text-ink">{sl.text}</td>
                            <td className="border-b border-line px-3 py-2.5 align-top">
                              {sl.who ? <Badge tone="blue">{sl.who}</Badge> : <span className="text-ink-3">—</span>}
                            </td>
                            {canDay && (
                              <td className="border-b border-line px-3 py-2 text-right align-top whitespace-nowrap">
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={t("dash.schedule.editSlotAria", { time: sl.time })}
                                  onClick={() => setSlotEdit({ index: i })}
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  size="icon-sm"
                                  variant="danger-ghost"
                                  aria-label={t("dash.schedule.delSlotAria", { time: sl.time })}
                                  disabled={saveSlots.isPending}
                                  onClick={() => void deleteSlot(saveSlots, day, i)}
                                >
                                  <Trash2 />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      <EditDialog
        table="schedule"
        open={!!dayEdit}
        onOpenChange={(o) => !o && setDayEdit(null)}
        row={dayEdit?.row ?? null}
        defaults={defaults}
        size="md"
        title={dayEdit?.row ? t("dash.schedule.dayEditTitle", { date: dayEdit.row.date }) : t("dash.schedule.addDay")}
        description={t("dash.schedule.dayDesc")}
        deleteLabel={t("dash.schedule.dayDelete")}
        onSaved={(r) => setPicked(r.id)}
      />
      <SlotDialog day={day ?? null} index={slotEdit?.index ?? null} open={!!slotEdit} onOpenChange={(o) => !o && setSlotEdit(null)} />
    </div>
  );
}
