// 메시지 보내기 — 대상 검색·추가(칩), 받을 인원 미리 계산(dryRun), 제목·내용·관련 링크
import { useEffect, useMemo, useState } from "react";
import { Send, X } from "lucide-react";
import { type MessageTarget } from "@wyd/shared";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, SearchInput, Textarea } from "@/components/ui/input";
import { previewRecipients, useSendMessage } from "@/lib/messages";
import { useT } from "@/lib/i18n";
import { matchQuery } from "@/lib/utils";
import { targetKey, useTargets } from "./targets";

const SHOW = 40;

export function ComposeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useT();
  const { candidates, nameOf } = useTargets(open);
  const send = useSendMessage();
  const [to, setTo] = useState<MessageTarget[]>([]);
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [count, setCount] = useState<number | null>(null);

  // 받을 인원 — 대상이 바뀔 때마다 서버에 계산 요청(권한 밖 대상은 여기서 미리 드러남)
  useEffect(() => {
    if (!to.length) return setCount(null);
    let stale = false;
    const h = setTimeout(() => {
      previewRecipients(to).then(
        (r) => !stale && setCount(r.recipients),
        () => !stale && setCount(null),
      );
    }, 250);
    return () => {
      stale = true;
      clearTimeout(h);
    };
  }, [to]);

  const chosen = useMemo(() => new Set(to.map(targetKey)), [to]);
  const list = useMemo(() => {
    const pool = candidates.filter((c) => !chosen.has(c.key));
    return (q.trim() ? pool.filter((c) => matchQuery(q, c.label, c.sub)) : pool.filter((c) => c.quick)).slice(0, SHOW);
  }, [candidates, chosen, q]);

  const reset = () => {
    setTo([]);
    setQ("");
    setTitle("");
    setBody("");
    setLink("");
  };
  const submit = async () => {
    try {
      await send.mutateAsync({ title: title.trim(), body: body.trim(), link: link.trim(), to });
      reset();
      onOpenChange(false);
    } catch {
      /* useSendMessage가 오류 알림 — 입력 내용은 그대로 둠 */
    }
  };
  const ready = to.length > 0 && !!title.trim() && !!body.trim() && count !== 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("inbox.compose")}
      description={t("inbox.composeDesc")}
      size="lg"
      footer={
        <>
          <span className="mr-auto text-[13px] text-ink-3">
            {count === 0 ? t("inbox.previewNone") : count != null ? t("inbox.preview", { n: count }) : ""}
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" loading={send.isPending} disabled={!ready} onClick={() => void submit()}>
            <Send />
            {t("inbox.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-ink-2">
            {t("inbox.to")}
            <span className="text-bad"> *</span>
          </div>
          <div className="mb-2 flex min-h-9 flex-wrap gap-1.5 rounded-lg border border-line bg-surface-2 p-1.5">
            {to.length ? (
              to.map((x) => {
                const name = nameOf(x);
                return (
                  <span
                    key={targetKey(x)}
                    className="inline-flex items-center gap-1 rounded-md bg-primary-soft py-0.5 pr-1 pl-2 text-[12.5px] text-primary-soft-ink"
                  >
                    {name}
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-surface"
                      aria-label={t("shell.form.removeItem", { x: name })}
                      onClick={() => setTo((a) => a.filter((y) => targetKey(y) !== targetKey(x)))}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                );
              })
            ) : (
              <span className="px-1.5 py-1 text-[13px] text-ink-3">{t("inbox.toEmpty")}</span>
            )}
          </div>
          <SearchInput value={q} onChange={setQ} placeholder={t("inbox.toSearch")} />
          {!q.trim() && list.length > 0 && <div className="mt-2 text-[12px] text-ink-3">{t("inbox.quick")}</div>}
          <ul className="mt-1.5 flex max-h-52 flex-col gap-0.5 overflow-y-auto">
            {list.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13.5px] hover:bg-surface-2"
                  onClick={() => {
                    setTo((a) => [...a, c.target]);
                    setQ("");
                  }}
                >
                  <Badge tone="outline">{t(c.kind)}</Badge>
                  <span className="min-w-0 flex-1 truncate text-ink">{c.label}</span>
                  {c.sub && <span className="hidden truncate text-[12px] text-ink-3 sm:block">{c.sub}</span>}
                </button>
              </li>
            ))}
            {q.trim() && !list.length && <li className="px-2 py-1.5 text-[13px] text-ink-3">{t("inbox.noMatch")}</li>}
          </ul>
          <p className="mt-2 text-[12px] text-ink-3">{t("inbox.reachHint")}</p>
        </div>
        <Field label={t("inbox.titleLabel")} required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
        </Field>
        <Field label={t("inbox.bodyLabel")} hint={t("inbox.privacyHint")} required>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} className="min-h-28" />
        </Field>
        <Field label={t("inbox.linkLabel")} hint={t("inbox.linkHint")}>
          <Input value={link} onChange={(e) => setLink(e.target.value)} maxLength={300} placeholder="/schedule" />
        </Field>
      </div>
    </Dialog>
  );
}
