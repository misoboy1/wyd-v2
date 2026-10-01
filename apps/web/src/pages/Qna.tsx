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
import { useT } from "@/lib/i18n";

const isAnswered = (x: QnaRow) => !!x.answered && !!String(x.a || "").trim();

/** 누구나 질문(비로그인 공개 API) */
function AskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [author, setAuthor] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    setErr("");
    if (!author.trim() || !q.trim()) {
      setErr(t("board.qna.needInput"));
      return;
    }
    setBusy(true);
    try {
      await api.post("/qna/ask", { author: author.trim(), q: q.trim() });
      await qc.invalidateQueries({ queryKey: tableKey("qna") });
      toast.success(t("board.qna.posted"));
      setAuthor("");
      setQ("");
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === "RATE_LIMIT") setErr(t("board.qna.rateLimit"));
      else if (e instanceof ApiError && e.code === "VALIDATION") setErr(`${e.message} ${t("board.qna.limitHint")}`);
      else setErr(e instanceof ApiError ? e.message : t("board.qna.postFailed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      size="md"
      title={t("board.qna.askTitle")}
      description={t("board.qna.askDesc")}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            <Send />
            {t("board.qna.submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label={t("board.qna.authorLabel")} hint={t("board.qna.authorHint")}>
          <Input
            data-autofocus
            value={author}
            maxLength={40}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder={t("board.qna.authorPlaceholder")}
          />
        </Field>
        <Field label={t("board.qna.questionLabel")} hint={`${q.length} / 1000`}>
          <Textarea
            value={q}
            maxLength={1000}
            rows={5}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("board.qna.questionPlaceholder")}
          />
        </Field>
        {err && (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">
            {err}
          </p>
        )}
        <p className="text-[12px] text-ink-3">{t("board.qna.privacy")}</p>
      </div>
    </Dialog>
  );
}

/** 관리자 인라인 답변 */
function AnswerBox({ item, onDone }: { item: QnaRow; onDone: () => void }) {
  const { t } = useT();
  const save = useSave("qna");
  const [a, setA] = useState(item.a || "");
  const submit = async () => {
    try {
      await save.mutateAsync({ id: item.id, version: item.version, a, answered: !!a.trim() });
      toast.success(a.trim() ? t("board.qna.replySaved") : t("board.qna.replyCleared"));
      onDone();
    } catch {
      /* 오류 토스트·충돌 창은 useSave가 처리 */
    }
  };
  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary-soft/40 p-3">
      <label className="mb-1.5 block text-[12.5px] font-semibold text-primary-soft-ink" htmlFor={`qa-${item.id}`}>
        {t("board.qna.replyLabel")}
      </label>
      <Textarea
        id={`qa-${item.id}`}
        autoFocus
        value={a}
        rows={4}
        onChange={(e) => setA(e.target.value)}
        placeholder={t("board.qna.replyPlaceholder")}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button size="sm" variant="primary" loading={save.isPending} onClick={() => void submit()}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}

type Tab = "all" | "wait" | "done";

export default function Qna() {
  const { t } = useT();
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
      <PageHeader
        icon={<CircleHelp />}
        title={t("board.qna.title")}
        subtitle={t("board.qna.subtitle")}
        actions={
          <Button variant="primary" onClick={() => setAsk(true)}>
            <Plus />
            {t("board.qna.ask")}
          </Button>
        }
      />
      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "all", label: t("common.all"), count: sorted.length },
          { value: "wait", label: t("board.qna.waiting"), count: sorted.length - done },
          { value: "done", label: t("board.qna.answered"), count: done },
        ]}
      />
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : list.length ? (
        <div className="flex flex-col gap-3">
          {list.map((item) => {
            const answered = isAnswered(item);
            return (
              <BoardCard
                key={item.id}
                title={item.author || t("board.qna.anonymous")}
                date={item.date}
                body={item.q}
                badges={<Badge tone="amber">{t("board.qna.q")}</Badge>}
                actions={
                  <>
                    <Badge tone={answered ? "green" : "gray"}>{answered ? t("board.qna.answered") : t("board.qna.waiting")}</Badge>
                    {isAdmin && (
                      <RowActions
                        table="qna"
                        row={item}
                        label={t("board.qna.rowLabel", { author: item.author })}
                        onEdit={() => setEdit(item)}
                      />
                    )}
                  </>
                }
              >
                {answered && answering !== item.id && (
                  <div className="mt-3 rounded-xl bg-primary-soft px-3.5 py-3">
                    <div className="mb-1 text-[12px] font-semibold text-primary-soft-ink">{t("board.qna.replyLabel")}</div>
                    <div className="text-[14px] leading-relaxed break-words whitespace-pre-wrap text-ink">{item.a}</div>
                  </div>
                )}
                {isAdmin &&
                  (answering === item.id ? (
                    <AnswerBox item={item} onDone={() => setAnswering(null)} />
                  ) : (
                    <div className="mt-3">
                      <Button size="sm" variant={answered ? "ghost" : "soft"} onClick={() => setAnswering(item.id)}>
                        <MessageSquareReply />
                        {answered ? t("board.qna.editReply") : t("board.qna.reply")}
                      </Button>
                    </div>
                  ))}
              </BoardCard>
            );
          })}
        </div>
      ) : (
        <Empty icon={<CircleHelp />} title={tab === "all" ? t("board.qna.empty") : t("board.qna.emptyTab")}>
          {tab === "all" && (
            <Button className="mt-2" variant="primary" onClick={() => setAsk(true)}>
              <Plus />
              {t("board.qna.ask")}
            </Button>
          )}
        </Empty>
      )}
      <AskDialog open={ask} onOpenChange={setAsk} />
      <EditDialog
        table="qna"
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        row={edit}
        size="md"
        title={t("board.qna.editTitle")}
      />
    </div>
  );
}
