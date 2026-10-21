import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Inbox as InboxIcon, Link2, LogOut } from "lucide-react";
import type { PersonMe } from "@wyd/shared";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { confirm } from "@/components/ui/confirm";
import { MessageList } from "@/components/inbox/MessageList";
import { PushCard } from "@/components/inbox/PushCard";
import { TeamChatBar } from "@/components/org/TeamChatButton";
import { api, type ApiError } from "@/lib/api";
import { personKey, useInbox, usePerson, usePersonChat, type PersonState } from "@/lib/messages";
import { dropDevicePush } from "@/lib/push";
import { useT } from "@/lib/i18n";

/** 링크 주소 전체나 # 뒤 토큰만 붙여넣어도 인식 */
const tokenOf = (s: string) => s.trim().split("#").pop()?.trim() ?? "";

/**
 * 이 화면에서는 시작 주소가 없는 manifest로 바꿈 → "홈 화면에 추가"한 앱이 지금 주소(/me#토큰)로 열림.
 * 아이폰 홈 화면 앱은 Safari와 쿠키를 공유하지 않을 수 있어 토큰을 주소에 남겨 둔다
 */
function useMeManifest() {
  useEffect(() => {
    const el = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!el) return;
    const prev = el.getAttribute("href");
    el.setAttribute("href", "/manifest-me.webmanifest");
    return () => {
      if (prev) el.setAttribute("href", prev);
    };
  }, []);
}

/** 개인 링크(QR) 화면 — 계정 없는 순례자·봉사자의 메시지함과 알림 켜기 */
export default function Me() {
  const { t } = useT();
  const qc = useQueryClient();
  const { person, limited, isLoading } = usePerson();
  const inbox = useInbox(true);
  const [error, setError] = useState("");
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  useMeManifest();
  const chat = usePersonChat(person);

  const connect = async (token: string) => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const me = await api.post<PersonMe>("/p/link", { token });
      qc.setQueryData<PersonState>(personKey, { person: me });
      if (location.hash.slice(1) !== token) history.replaceState(null, "", "/me#" + token);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  // QR로 열면 주소의 # 뒤 토큰으로 연결(이미 연결된 기기여도 다시 확인 — 폐기된 링크 안내)
  useEffect(() => {
    const token = location.hash.slice(1);
    if (token) void connect(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 첫 진입 때 한 번만
  }, []);

  const unlink = async () => {
    if (!(await confirm({ title: t("inbox.me.unlinkQ"), body: t("inbox.me.unlinkBody"), danger: true, confirmText: t("inbox.me.unlink") })))
      return;
    await dropDevicePush(true);
    await api.post("/p/unlink").catch(() => {});
    history.replaceState(null, "", "/me");
    qc.setQueryData<PersonState>(personKey, { person: null });
    toast.success(t("inbox.me.unlinked"));
  };

  if (isLoading || (busy && !person))
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-24" />
      </div>
    );

  if (!person)
    return (
      <div className="mx-auto max-w-md">
        <PageHeader icon={<InboxIcon />} title={t("inbox.me.title")} />
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
          {/* 제한에 걸려 확인하지 못한 경우: 안내만 덧붙이고 붙여넣기 폼·오류는 그대로(새 링크를 받은 사람도 연결할 수 있게) */}
          {limited && <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn">{t("inbox.me.limited")}</p>}
          {/* 제한 중(링크는 살아 있을 수 있음)에는 "QR 다시 스캔" 기본 안내를 겹쳐 보이지 않음 — 연결 시도 오류는 그대로 표시 */}
          {(error || !limited) && <p className="text-[14px] leading-relaxed text-ink-2">{error || t("inbox.me.noLink")}</p>}
          <form
            className="mt-4 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void connect(tokenOf(paste));
            }}
          >
            <Field label={t("inbox.me.pasteLabel")} className="flex-1">
              <Input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="https://…/me#…" autoComplete="off" />
            </Field>
            <Button type="submit" variant="primary" loading={busy} disabled={!tokenOf(paste)}>
              <Link2 />
              {t("inbox.me.connect")}
            </Button>
          </form>
          <Link to="/" className="mt-4 inline-block text-[13px] text-primary hover:underline">
            {t("inbox.me.home")}
          </Link>
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        icon={<InboxIcon />}
        title={t("inbox.me.title")}
        subtitle={t("inbox.me.hello", { name: person.name })}
        actions={
          <Button variant="ghost" size="sm" onClick={() => void unlink()}>
            <LogOut />
            {t("inbox.me.unlink")}
          </Button>
        }
      />
      {error && <p className="mb-3 rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p>}
      {chat && <TeamChatBar team={chat.team} chat={chat} />}
      <PushCard owner={`${person.kind}:${person.id}`} asPerson />
      <MessageList rows={inbox.rows} isLoading={inbox.isLoading} asPerson />
    </div>
  );
}
