// 받은 메시지 목록 — 누르면 펼쳐 읽음 처리. 로그인 수신함(/inbox)과 개인 링크(/me) 공용
import { useState } from "react";
import { Link } from "react-router";
import { CheckCheck, ExternalLink, Inbox as InboxIcon, UserRound } from "lucide-react";
import type { InboxMessage } from "@wyd/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/misc";
import { useMarkRead } from "@/lib/messages";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function MessageList({ rows, isLoading, asPerson }: { rows: InboxMessage[]; isLoading: boolean; asPerson?: boolean }) {
  const { t, date } = useT();
  const read = useMarkRead(asPerson);
  const [open, setOpen] = useState<number | null>(null);
  const unread = rows.filter((m) => !m.readAt).length;

  const toggle = (m: InboxMessage) => {
    setOpen((o) => (o === m.id ? null : m.id));
    if (!m.readAt) read.mutate([m.id]);
  };

  if (isLoading)
    return (
      <div className="space-y-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  if (!rows.length) return <Empty icon={<InboxIcon />} title={t("inbox.empty")} />;
  return (
    <div>
      {unread > 0 && (
        <div className="mb-2 flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => read.mutate(undefined)}>
            <CheckCheck />
            {t("inbox.markAllRead")}
          </Button>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {rows.map((m) => {
          const shown = open === m.id;
          return (
            <li key={m.id} className={cn("rounded-xl border bg-surface shadow-soft", m.readAt ? "border-line" : "border-primary/40")}>
              <button
                type="button"
                className="flex w-full items-start gap-3 px-4 py-3 text-left"
                aria-expanded={shown}
                onClick={() => toggle(m)}
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", m.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={cn("truncate text-[14.5px]", m.readAt ? "font-medium text-ink-2" : "font-semibold text-ink")}>
                      {m.title}
                    </span>
                    {!m.readAt && <Badge tone="blue">{t("inbox.unread")}</Badge>}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-ink-3">
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3.5" />
                      {t("inbox.from", { name: m.sender })}
                    </span>
                    <span>{date(m.createdAt, { dateStyle: "medium", timeStyle: "short" })}</span>
                  </span>
                  {!shown && <span className="mt-1 line-clamp-1 block text-[13px] text-ink-3">{m.body}</span>}
                </span>
              </button>
              {shown && (
                <div className="border-t border-line px-4 py-3 pl-9">
                  <p className="text-[14px] leading-relaxed break-words whitespace-pre-wrap text-ink-2">{m.body}</p>
                  {m.link &&
                    (m.link.startsWith("/") ? (
                      <Link
                        to={m.link}
                        className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="size-3.5" />
                        {t("inbox.openLink")}
                      </Link>
                    ) : (
                      <a
                        href={m.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="size-3.5" />
                        {t("inbox.openLink")}
                      </a>
                    ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
