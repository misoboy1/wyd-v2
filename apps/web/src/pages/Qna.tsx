import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CircleHelp, MessageSquareReply, Plus, Send } from "lucide-react";
import type { Qna as QnaRow } from "@wyd/shared";
import { Empty, PageHeader, Segmented, Skeleton } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { EditDialog } from "@/components/form/EditDialog";
import { BoardCard, newestFirst } from "@/components/board/BoardCard";
import { RowActions } from "@/components/board/RowActions";
import { tableKey, useSave, useTable } from "@/lib/data";
import { useCan } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

const isAnswered = (x: QnaRow) => !!x.answered && !!String(x.a || "").trim();

/** 누구나 질문(비로그인 공개 API) — 순례자(외국인)를 위해 영어 병기 */
function AskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [author, setAuthor] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    setErr("");
    if (!author.trim() || !q.trim()) { setErr("질문자와 질문 내용을 입력하세요. / Please enter your name and question."); return; }
    setBusy(true);
    try {
      await api.post("/qna/ask", { author: author.trim(), q: q.trim() });
      await qc.invalidateQueries({ queryKey: tableKey("qna") });
      toast.success("질문이 등록되었습니다. 본당에서 곧 답변드리겠습니다.", { description: "Your question has been posted. The parish will reply soon." });
      setAuthor(""); setQ(""); onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === "RATE_LIMIT") setErr("질문이 너무 많습니다. 잠시 후(약 10분) 다시 등록하세요. / Too many questions — please try again in a few minutes.");
      else if (e instanceof ApiError && e.code === "VALIDATION") setErr(`${e.message} / Name up to 40 characters, question up to 1,000 characters.`);
      else setErr(e instanceof ApiError ? e.message : "등록하지 못했습니다. / Could not post your question.");
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)} size="md" title="질문하기 / Ask a question"
      description="질문은 누구나 남길 수 있고, 답변은 본당 관리자가 등록합니다. · Anyone can ask; the parish will reply here."
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>취소 / Cancel</Button>
        <Button variant="primary" loading={busy} onClick={() => void submit()}><Send />등록 / Submit</Button></>}>
      <div className="space-y-3.5">
        <Field label="질문자 (이름/그룹) · Name / Group" hint="예: Maria (G3, Philippines)">
          <Input data-autofocus value={author} maxLength={40} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name or group" />
        </Field>
        <Field label="질문 내용 · Question" hint={`${q.length} / 1000`}>
          <Textarea value={q} maxLength={1000} rows={5} onChange={(e) => setQ(e.target.value)} placeholder="한국어 또는 영어로 편하게 적어 주세요. · Write in Korean or English." />
        </Field>
        {err && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">{err}</p>}
        <p className="text-[12px] text-ink-3">연락처 등 개인정보는 적지 마세요. 질문은 모두에게 공개됩니다. · Please don't include personal contact details; questions are public.</p>
      </div>
    </Dialog>
  );
}

/** 관리자 인라인 답변 */
function AnswerBox({ item, onDone }: { item: QnaRow; onDone: () => void }) {
  const save = useSave("qna");
  const [a, setA] = useState(item.a || "");
  const submit = async () => {
    try {
      await save.mutateAsync({ id: item.id, version: item.version, a, answered: !!a.trim() });
      toast.success(a.trim() ? "답변을 저장했습니다." : "답변을 비웠습니다(답변대기).");
      onDone();
    } catch { /* 오류 토스트·충돌 창은 useSave가 처리 */ }
  };
  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary-soft/40 p-3">
      <label className="mb-1.5 block text-[12.5px] font-semibold text-primary-soft-ink" htmlFor={`qa-${item.id}`}>본당 답변 · Parish reply</label>
      <Textarea id={`qa-${item.id}`} autoFocus value={a} rows={4} onChange={(e) => setA(e.target.value)} placeholder="답변을 입력하세요. 비우고 저장하면 '답변대기'로 돌아갑니다." />
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone} disabled={save.isPending}>취소</Button>
        <Button size="sm" variant="primary" loading={save.isPending} onClick={() => void submit()}>저장</Button>
      </div>
    </div>
  );
}

type Tab = "all" | "wait" | "done";

export default function Qna() {
  const { rows, isLoading } = useTable("qna");
  const { isAdmin } = useCan();
  const [tab, setTab] = useState<Tab>("all");
  const [ask, setAsk] = useState(false);
  const [answering, setAnswering] = useState<number | null>(null);
  const [edit, setEdit] = useState<QnaRow | null>(null);
  const sorted = useMemo(() => rows.slice().sort(newestFirst), [rows]);
  const done = sorted.filter(isAnswered).length;
  const list = sorted.filter((x) => tab === "all" || (tab === "done") === isAnswered(x));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader icon={<CircleHelp />} title="방문자 Q&A (Pilgrim Q&A)" subtitle="순례자 질문 → 본당 답변 · 질문은 누구나, 답변은 관리자 · Ask a question anytime"
        actions={<Button variant="primary" onClick={() => setAsk(true)}><Plus />질문하기 / Ask</Button>} />
      <Segmented className="mb-4" value={tab} onChange={setTab} options={[
        { value: "all", label: "전체 · All", count: sorted.length },
        { value: "wait", label: "답변대기 · Waiting", count: sorted.length - done },
        { value: "done", label: "답변완료 · Answered", count: done },
      ]} />
      {isLoading ? <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        : list.length ? (
          <div className="flex flex-col gap-3">
            {list.map((item) => {
              const answered = isAnswered(item);
              return (
                <BoardCard key={item.id} title={item.author || "익명 · Anonymous"} date={item.date} body={item.q}
                  badges={<Badge tone="amber">질문 · Q</Badge>}
                  actions={<>
                    <Badge tone={answered ? "green" : "gray"}>{answered ? "답변완료 · Answered" : "답변대기 · Waiting"}</Badge>
                    {isAdmin && <RowActions table="qna" row={item} label={`${item.author} 질문`} onEdit={() => setEdit(item)} />}
                  </>}>
                  {answered && answering !== item.id && (
                    <div className="mt-3 rounded-xl bg-primary-soft px-3.5 py-3">
                      <div className="mb-1 text-[12px] font-semibold text-primary-soft-ink">본당 답변 · Parish reply</div>
                      <div className="text-[14px] leading-relaxed break-words whitespace-pre-wrap text-ink">{item.a}</div>
                    </div>
                  )}
                  {isAdmin && (answering === item.id
                    ? <AnswerBox item={item} onDone={() => setAnswering(null)} />
                    : <div className="mt-3"><Button size="sm" variant={answered ? "ghost" : "soft"} onClick={() => setAnswering(item.id)}><MessageSquareReply />{answered ? "답변 수정" : "답변"}</Button></div>)}
                </BoardCard>
              );
            })}
          </div>
        ) : <Empty icon={<CircleHelp />} title={tab === "all" ? "등록된 질문이 없습니다. / No questions yet." : "해당하는 질문이 없습니다. / Nothing here."}>
          {tab === "all" && <Button className="mt-2" variant="primary" onClick={() => setAsk(true)}><Plus />질문하기 / Ask</Button>}
        </Empty>}
      <AskDialog open={ask} onOpenChange={setAsk} />
      <EditDialog table="qna" open={!!edit} onOpenChange={(o) => !o && setEdit(null)} row={edit} size="md" title="질문 수정" />
    </div>
  );
}
