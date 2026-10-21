import { useMemo, useState } from "react";
import { teamInfo } from "@wyd/shared";
import { Mail, Send, Trash2, UserRound } from "lucide-react";
import { Empty, PageHeader, Segmented, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { confirm } from "@/components/ui/confirm";
import { MessageList } from "@/components/inbox/MessageList";
import { PushCard } from "@/components/inbox/PushCard";
import { ComposeDialog } from "@/components/inbox/ComposeDialog";
import { TeamChatBar } from "@/components/org/TeamChatButton";
import { useTargets } from "@/components/inbox/targets";
import { useDeleteMessage, useInbox, useSent } from "@/lib/messages";
import { useCan } from "@/lib/auth";
import { useTable } from "@/lib/data";
import { useT } from "@/lib/i18n";

/** 메시지 — 받은 메시지(로그인 계정)·보낸 메시지·보내기. 계정 없는 순례자·봉사자는 /me */
export default function Inbox() {
  const { t, date } = useT();
  const { user, isAdmin } = useCan();
  const inbox = useInbox();
  const [tab, setTab] = useState<"in" | "sent">("in");
  const [compose, setCompose] = useState(false);
  const sent = useSent(tab === "sent");
  const { nameOf } = useTargets(tab === "sent");
  const del = useDeleteMessage();
  // 내 팀 오픈채팅방(관리자는 모든 팀을 받지만 여기서는 자기 팀 것만)
  const { rows: chatRows } = useTable("teamChats");
  const myChat = useMemo(() => {
    if (!user?.team) return null;
    const mine = teamInfo({ team: user.team }).team;
    return chatRows.find((c) => c.team === mine) ?? null;
  }, [chatRows, user?.team]);

  const remove = async (id: number, title: string) => {
    if (
      await confirm({ title: t("inbox.deleteAria", { title }), body: t("inbox.deleteBody"), danger: true, confirmText: t("common.delete") })
    )
      del.mutate(id);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={<Mail />}
        title={t("inbox.title")}
        subtitle={t("inbox.subtitle")}
        actions={
          <Button variant="primary" onClick={() => setCompose(true)}>
            <Send />
            {t("inbox.compose")}
          </Button>
        }
      />
      {myChat && <TeamChatBar team={myChat.team} chat={myChat} />}
      <PushCard owner={user ? `user:${user.id}` : ""} />
      <Segmented
        className="mb-3"
        value={tab}
        onChange={setTab}
        options={[
          { value: "in", label: t("inbox.received"), count: inbox.unread || undefined },
          { value: "sent", label: t("inbox.sent") },
        ]}
      />
      {tab === "in" ? (
        <MessageList rows={inbox.rows} isLoading={inbox.isLoading} />
      ) : sent.isLoading ? (
        <Skeleton className="h-24" />
      ) : sent.rows.length ? (
        <ul className="flex flex-col gap-2">
          {sent.rows.map((m) => (
            <li key={m.id} className="rounded-xl border border-line bg-surface px-4 py-3 shadow-soft">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-semibold text-ink">{m.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-ink-3">
                    <span>{date(m.createdAt, { dateStyle: "medium", timeStyle: "short" })}</span>
                    {isAdmin && m.senderId !== user?.id && (
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="size-3.5" />
                        {m.sender}
                      </span>
                    )}
                    <Badge tone={m.read === m.total ? "green" : "gray"}>{t("inbox.readStat", { read: m.read, total: m.total })}</Badge>
                  </div>
                </div>
                <Button
                  variant="danger-ghost"
                  size="icon-sm"
                  aria-label={t("inbox.deleteAria", { title: m.title })}
                  onClick={() => void remove(m.id, m.title)}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {m.targets.map((x, i) => (
                  <Badge key={i} tone="outline">
                    {nameOf(x)}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 line-clamp-3 text-[13.5px] break-words whitespace-pre-wrap text-ink-2">{m.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <Empty icon={<Send />} title={t("inbox.sentEmpty")} />
      )}
      <ComposeDialog open={compose} onOpenChange={setCompose} />
    </div>
  );
}
