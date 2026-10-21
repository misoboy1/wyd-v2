// 팀 카카오톡 오픈채팅방 열기 — open.kakao.com 링크는 휴대폰에서 카카오톡 앱으로, PC에서는 카카오 페이지(PC 카카오톡·QR)로 열림
import { toast } from "sonner";
import { Copy, MessageCircle } from "lucide-react";
import { KAKAO_OPEN_RE, type TeamChat } from "@wyd/shared";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Chat = Pick<TeamChat, "url" | "code">;

/** 채팅하기 버튼 + 참여코드(있으면 복사) */
export function TeamChatButton({ chat, size = "sm", className }: { chat: Chat; size?: "sm" | "md"; className?: string }) {
  const { t } = useT();
  // 저장 시 서버가 검증하지만, 화면에서도 오픈채팅 주소가 아니면 링크로 만들지 않음
  if (!KAKAO_OPEN_RE.test(chat.url)) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(chat.code);
      toast.success(t("org.chat.copied"));
    } catch {
      toast(`${t("org.chat.code")}: ${chat.code}`, { duration: 15000 });
    }
  };
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <a
        href={chat.url}
        target="_blank"
        rel="noopener noreferrer"
        title={t("org.chat.hint")}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-lg bg-kakao font-semibold whitespace-nowrap text-kakao-ink shadow-soft transition-[filter] hover:brightness-95 [&_svg]:size-4",
          size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9.5 px-3.5 text-sm",
        )}
      >
        <MessageCircle />
        {t("org.chat.open")}
      </a>
      {chat.code && (
        <Button size="sm" variant="ghost" onClick={() => void copy()} title={t("org.chat.copy")}>
          <Copy />
          {t("org.chat.code")} <b className="font-mono">{chat.code}</b>
        </Button>
      )}
    </div>
  );
}

/** "우리 팀 채팅" 줄 — 받은 메시지·개인 링크 화면 상단 */
export function TeamChatBar({ team, chat }: { team: string; chat: Chat }) {
  const { t } = useT();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <MessageCircle className="size-5 shrink-0 text-ink-3" />
      <div className="min-w-0 flex-1 text-[13.5px]">
        <div className="font-semibold text-ink">{t("org.chat.mine")}</div>
        <p className="mt-0.5 text-ink-3">
          {team} · {t("org.chat.hint")}
        </p>
      </div>
      <TeamChatButton chat={chat} size="md" />
    </div>
  );
}
