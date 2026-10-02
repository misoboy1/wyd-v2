// 게시글 댓글 — 목록·작성·본인 댓글 수정/삭제(한 단계, 대댓글 없음)
import { useState } from "react";
import { Send } from "lucide-react";
import type { PostComment } from "@wyd/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { RowActions } from "@/components/board/RowActions";
import { Meta } from "@/components/board/BoardCard";
import { useSave } from "@/lib/data";
import { useCan } from "@/lib/auth";
import { useT } from "@/lib/i18n";

const MAX = 1000;

/** 오래된 댓글이 위(대화 순서) */
const oldestFirst = (a: PostComment, b: PostComment) => a.id - b.id;

export function Comments({ postId, comments }: { postId: number; comments: PostComment[] }) {
  const { t, date } = useT();
  const { loggedIn, canWrite } = useCan();
  const save = useSave("postComments");
  const [text, setText] = useState("");
  const [edit, setEdit] = useState<{ id: number; body: string } | null>(null);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    try {
      await save.mutateAsync({ postId, body, author: "" });
      setText("");
    } catch {
      /* useSave가 오류 알림 표시 — 입력 내용은 그대로 둠 */
    }
  };
  const saveEdit = async (c: PostComment) => {
    const body = edit?.body.trim();
    if (!body) return;
    try {
      await save.mutateAsync({ id: c.id, version: c.version, body });
      setEdit(null);
    } catch {
      /* useSave가 오류 알림·충돌 창 표시 */
    }
  };
  const when = (c: PostComment) => (c.updatedAt ? date(c.updatedAt, { dateStyle: "medium", timeStyle: "short" }) : undefined);

  return (
    <section className="mt-3 border-t border-line pt-3">
      {comments.length ? (
        <ul className="flex flex-col gap-2.5">
          {[...comments].sort(oldestFirst).map((c) => (
            <li key={c.id} className="rounded-xl bg-surface-2 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <Meta date={when(c)} author={c.author} />
                {canWrite("postComments", c) && edit?.id !== c.id && (
                  <div className="-mr-1 flex shrink-0 items-center gap-1">
                    <RowActions
                      table="postComments"
                      row={c}
                      label={t("board.comments.rowLabel", { author: c.author })}
                      onEdit={() => setEdit({ id: c.id, body: c.body })}
                    />
                  </div>
                )}
              </div>
              {edit?.id === c.id ? (
                <div className="mt-2 flex flex-col gap-2">
                  <Textarea
                    value={edit.body}
                    onChange={(e) => setEdit({ id: c.id, body: e.target.value })}
                    maxLength={MAX}
                    aria-label={t("board.comments.editLabel")}
                    className="min-h-16"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>
                      {t("common.cancel")}
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={save.isPending}
                      disabled={!edit.body.trim()}
                      onClick={() => void saveEdit(c)}
                    >
                      {t("common.save")}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-[14px] leading-relaxed break-words whitespace-pre-wrap text-ink-2">{c.body}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-3">{t("board.comments.empty")}</p>
      )}
      {loggedIn && (
        <div className="mt-3 flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX}
            placeholder={t("board.comments.placeholder")}
            aria-label={t("board.comments.inputLabel")}
            title={t("board.comments.limitHint")}
            className="min-h-16 flex-1"
          />
          <Button variant="primary" loading={save.isPending} disabled={!text.trim()} onClick={() => void submit()}>
            <Send />
            {t("board.comments.submit")}
          </Button>
        </div>
      )}
    </section>
  );
}
