// "이 기기에서 알림 받기" — 기기 상태(지원·차단·아이폰 설치 필요·켜짐)에 맞는 안내와 켜기·끄기 버튼
import { useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePush } from "@/lib/push";
import { useT } from "@/lib/i18n";

export function PushCard({ owner, asPerson }: { owner: string; asPerson?: boolean }) {
  const { t } = useT();
  const { state, enable, disable } = usePush(owner, asPerson);
  const [busy, setBusy] = useState(false);
  if (state === null) return null;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      if ((await fn()) !== false) toast.success(ok);
    } catch {
      toast.error(t("inbox.push.failed"));
    } finally {
      setBusy(false);
    }
  };

  if (state === "ios-install")
    return (
      <div className="mb-4 flex gap-3 rounded-2xl border border-line bg-surface-2 p-4">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 text-[13.5px]">
          <div className="font-semibold text-ink">{t("inbox.push.iosTitle")}</div>
          <p className="mt-1 text-ink-3">
            <Share className="mr-1 inline size-3.5 align-[-2px]" />
            {t("inbox.push.iosSteps")}
          </p>
        </div>
      </div>
    );

  const note =
    state === "unsupported"
      ? t("inbox.push.unsupported")
      : state === "denied"
        ? t("inbox.push.denied")
        : state === "server-off"
          ? t("inbox.push.serverOff")
          : state === "on"
            ? t("inbox.push.enabled")
            : t("inbox.push.desc");
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft">
      {state === "on" ? <Bell className="size-5 shrink-0 text-good" /> : <BellOff className="size-5 shrink-0 text-ink-3" />}
      <div className="min-w-0 flex-1 text-[13.5px]">
        <div className="font-semibold text-ink">{t("inbox.push.title")}</div>
        <p className="mt-0.5 text-ink-3">{note}</p>
      </div>
      {state === "off" && (
        <Button variant="primary" size="sm" loading={busy} onClick={() => void run(enable, t("inbox.push.done"))}>
          <Bell />
          {t("inbox.push.on")}
        </Button>
      )}
      {state === "on" && (
        <Button size="sm" loading={busy} onClick={() => void run(disable, t("inbox.push.offDone"))}>
          <BellOff />
          {t("inbox.push.off")}
        </Button>
      )}
    </div>
  );
}
