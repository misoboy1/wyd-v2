// "이 기기에서 알림 받기" — 기기·브라우저 상태(앱 안 브라우저·아이폰 설치 필요·차단·켜짐 등)마다 맞는 안내와 바로 누를 버튼
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Bell, BellOff, BellRing, Copy, ExternalLink, RefreshCw, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canOpenExternal, detectEnv, openExternal, usePush } from "@/lib/push";
import { useT } from "@/lib/i18n";

export function PushCard({ owner, asPerson }: { owner: string; asPerson?: boolean }) {
  const { t } = useT();
  const { state, enable, disable, recheck, test } = usePush(owner, asPerson);
  const [busy, setBusy] = useState(false);
  if (state === null) return null;
  const env = detectEnv();

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      if ((await fn()) !== false && ok) toast.success(ok);
    } catch {
      toast.error(t("inbox.push.failed"));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast.success(t("inbox.push.copied"));
    } catch {
      // 클립보드를 못 쓰는 웹뷰 — 주소를 보여 줘서 직접 복사하게
      toast(location.href, { duration: 15000 });
    }
  };
  const copyBtn = (
    <Button size="sm" onClick={() => void copy()}>
      <Copy />
      {t("inbox.push.copyLink")}
    </Button>
  );

  if (state === "in-app") {
    // 앱 안 브라우저에서 나가면 개인 링크 쿠키가 없으므로 /me는 QR 다시 스캔 안내를 덧붙임
    const canOpen = canOpenExternal();
    return (
      <Card icon={<ExternalLink className="size-5 text-warn" />} title={t("inbox.push.title")}>
        <p>{t("inbox.push.inApp")}</p>
        {env.os === "ios" && !canOpen && <p className="mt-1">{t("inbox.push.inAppIos")}</p>}
        {asPerson && <p className="mt-1">{t("inbox.push.meReopen")}</p>}
        <Actions>
          {canOpen && (
            <Button variant="primary" size="sm" onClick={() => !openExternal() && void copy()}>
              <ExternalLink />
              {t("inbox.push.openBrowser")}
            </Button>
          )}
          {copyBtn}
        </Actions>
      </Card>
    );
  }

  if (state === "ios-install")
    return (
      <Card icon={<Smartphone className="size-5 text-primary" />} title={t("inbox.push.iosTitle")} muted>
        <p>
          <Share className="mr-1 inline size-3.5 align-[-2px]" />
          {t("inbox.push.iosSteps")}
        </p>
        {env.browser !== "safari" && <Actions>{copyBtn}</Actions>}
      </Card>
    );

  if (state === "ios-old")
    return (
      <Card icon={<Smartphone className="size-5 text-ink-3" />} title={t("inbox.push.title")} muted>
        <p>{t("inbox.push.iosOld")}</p>
      </Card>
    );

  if (state === "denied") {
    const how =
      env.os === "ios"
        ? t("inbox.push.deniedIos")
        : env.browser === "samsung"
          ? t("inbox.push.deniedSamsung")
          : env.os === "android"
            ? t("inbox.push.deniedAndroid")
            : t("inbox.push.deniedDesktop");
    return (
      <Card icon={<BellOff className="size-5 text-bad" />} title={t("inbox.push.title")}>
        <p>{t("inbox.push.denied")}</p>
        <p className="mt-1 font-medium text-ink-2">{how}</p>
        <Actions>
          <Button size="sm" onClick={() => void recheck()}>
            <RefreshCw />
            {t("inbox.push.recheck")}
          </Button>
        </Actions>
      </Card>
    );
  }

  if (state === "unsupported" || state === "server-off")
    return (
      <Card icon={<BellOff className="size-5 text-ink-3" />} title={t("inbox.push.title")} muted>
        <p>{state === "unsupported" ? t("inbox.push.unsupported") : t("inbox.push.serverOff")}</p>
        {state === "unsupported" && <Actions>{copyBtn}</Actions>}
      </Card>
    );

  if (state === "on")
    return (
      <Card icon={<Bell className="size-5 text-good" />} title={t("inbox.push.title")}>
        <p>{t("inbox.push.enabled")}</p>
        <Actions>
          <Button size="sm" loading={busy} onClick={() => void run(() => test(t("inbox.push.testTitle"), t("inbox.push.testBody")))}>
            <BellRing />
            {t("inbox.push.test")}
          </Button>
          <Button variant="ghost" size="sm" loading={busy} onClick={() => void run(disable, t("inbox.push.offDone"))}>
            <BellOff />
            {t("inbox.push.off")}
          </Button>
        </Actions>
      </Card>
    );

  // off — 가장 눈에 띄는 큰 버튼 하나(권한 요청은 반드시 이 클릭 안에서)
  return (
    <Card icon={<BellOff className="size-5 text-ink-3" />} title={t("inbox.push.title")}>
      <p>{t("inbox.push.desc")}</p>
      <Actions>
        <Button
          variant="primary"
          size="lg"
          className="w-full sm:w-auto"
          loading={busy}
          onClick={() => void run(enable, t("inbox.push.done"))}
        >
          <Bell />
          {t("inbox.push.on")}
        </Button>
      </Actions>
    </Card>
  );
}

function Card({ icon, title, muted, children }: { icon: ReactNode; title: string; muted?: boolean; children: ReactNode }) {
  return (
    <div
      className={
        muted
          ? "mb-4 flex gap-3 rounded-2xl border border-line bg-surface-2 p-4"
          : "mb-4 flex gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft"
      }
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1 text-[13.5px] text-ink-3">
        <div className="font-semibold text-ink">{title}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

const Actions = ({ children }: { children: ReactNode }) => <div className="mt-3 flex flex-wrap gap-2">{children}</div>;
