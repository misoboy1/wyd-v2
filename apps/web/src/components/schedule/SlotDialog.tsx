// 일정표 시간대 항목 편집 — 하루(schedule 행) 전체를 slots 배열째 저장(PATCH + version)
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ScheduleDay, ScheduleSlot } from "@wyd/shared";
import { useSave } from "@/lib/data";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { confirm } from "@/components/ui/confirm";

type SlotIn = Omit<ScheduleSlot, "id"> & { id?: number };

/** 표시 순서(sort → 원래 순서) */
export const orderedSlots = (day: ScheduleDay): SlotIn[] =>
  (day.slots ?? [])
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.sort ?? 0) - (b.s.sort ?? 0) || a.i - b.i)
    .map((x) => x.s);

/** 하루의 slots를 새 배열로 저장(sort는 순서대로 다시 매김) */
export function useSaveSlots() {
  const save = useSave("schedule");
  return {
    isPending: save.isPending,
    run: (day: ScheduleDay, slots: SlotIn[]) =>
      save.mutateAsync({ id: day.id, version: day.version, slots: slots.map((s, k) => ({ ...s, sort: k })) as ScheduleSlot[] }),
  };
}

export async function deleteSlot(saveSlots: ReturnType<typeof useSaveSlots>, day: ScheduleDay, index: number) {
  if (!(await confirm({ title: "이 시간대 항목을 삭제할까요?", confirmText: "삭제", danger: true }))) return false;
  const list = orderedSlots(day);
  list.splice(index, 1);
  try {
    await saveSlots.run(day, list);
    return true;
  } catch {
    return false;
  }
}

/** index: 수정할 항목(orderedSlots 기준 위치), null이면 추가 */
export function SlotDialog({
  day,
  index,
  open,
  onOpenChange,
}: {
  day: ScheduleDay | null;
  index: number | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const saveSlots = useSaveSlots();
  const [v, setV] = useState({ time: "", text: "", who: "" });
  const [orig, setOrig] = useState<SlotIn | null>(null);
  useEffect(() => {
    if (!open || !day) return;
    const cur = index != null ? (orderedSlots(day)[index] ?? null) : null;
    setOrig(cur);
    setV({ time: cur?.time ?? "", text: cur?.text ?? "", who: cur?.who ?? "" });
    // 창을 여는 순간의 값만 채움(편집 중 실시간 갱신으로 입력이 지워지지 않도록)
  }, [open, index, day?.id]);
  if (!day) return null;

  const submit = async () => {
    const list = orderedSlots(day);
    // 편집 중 다른 사용자가 항목을 추가·삭제했을 수 있으니 id(없으면 원래 값)로 대상을 다시 찾음
    const at = orig
      ? list.findIndex((s) => (orig.id != null ? s.id === orig.id : s.time === orig.time && s.text === orig.text && s.who === orig.who))
      : -1;
    if (orig && at < 0) {
      toast.error("편집하던 항목이 이미 삭제되었습니다.");
      onOpenChange(false);
      return;
    }
    if (at >= 0) list[at] = { ...list[at], ...v };
    else list.push({ ...v, sort: list.length });
    try {
      await saveSlots.run(day, list);
      onOpenChange(false);
    } catch {
      /* 오류 안내는 useSave, 창 유지 */
    }
  };
  const del = async () => {
    if (index != null && (await deleteSlot(saveSlots, day, index))) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !saveSlots.isPending && onOpenChange(o)}
      size="sm"
      title={`${index != null ? "시간대 편집" : "시간대 추가"} · ${day.date}`}
      description={day.event}
      footer={
        <>
          {index != null && (
            <Button variant="danger-ghost" className="mr-auto" onClick={() => void del()}>
              <Trash2 />
              삭제
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saveSlots.isPending}>
            취소
          </Button>
          <Button variant="primary" loading={saveSlots.isPending} onClick={() => void submit()}>
            저장
          </Button>
        </>
      }
    >
      <form
        className="space-y-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="시간">
          <Input
            data-autofocus
            value={v.time}
            maxLength={30}
            placeholder="예: 08:00 / 오전 / 상시"
            onChange={(e) => setV({ ...v, time: e.target.value })}
          />
        </Field>
        <Field label="내용">
          <Textarea value={v.text} maxLength={500} onChange={(e) => setV({ ...v, text: e.target.value })} />
        </Field>
        <Field label="담당">
          <Input
            value={v.who}
            maxLength={100}
            placeholder="예: 시설분과 / 안내(WYD)"
            onChange={(e) => setV({ ...v, who: e.target.value })}
          />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
