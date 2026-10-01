// 고리기도·묵주기도 봉헌 공용 — 대시보드와 고리기도 화면이 함께 씀
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, RefreshCw } from "lucide-react";
import { GORI_START, WYD_OPEN, fmtDate, fmtWeekday, todayKST, type Gori, type WydStatus } from "@wyd/shared";
import { api } from "@/lib/api";
import { useCan } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { cn, daysBetween } from "@/lib/utils";
import { getLocale, tt, useT } from "@/lib/i18n";

/** "2026-07-20" → 요일 번호(0=일요일, 날짜가 아니면 -1). 시간대 영향 없이 계산 */
export function weekdayIdx(iso: string) {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
  return isNaN(d.getTime()) ? -1 : d.getUTCDay();
}
/** "2026-07-20" → 현재 언어의 짧은 요일명(월/Mon/lun.) */
export function weekday(iso: string) {
  const i = weekdayIdx(iso);
  return i < 0 ? "" : fmtWeekday(getLocale(), i);
}
/** "2026-07-20" → "7/20"(한국어) · 다른 언어는 그 언어의 월/일 순서(20/7 등) */
export function md(iso: string) {
  const l = getLocale();
  if (l === "ko") return `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;
  return fmtDate(l, iso.slice(0, 10), { month: "numeric", day: "numeric" }) || iso;
}
/** "2026-07-20" → "7/20 (월)" */
export const mdw = (iso: string) => `${md(iso)} (${weekday(iso)})`;

/** D-DAY 표기: 남은 날 >0 → D-n, 0 → D-DAY, 지남 → D+n (언어별 표기, 예: 프랑스어 J-n) */
export function ddText(targetISO: string, todayISO = todayKST()) {
  const d = daysBetween(todayISO, targetISO);
  return d > 0 ? tt("common.dDay", { n: d }) : d === 0 ? tt("common.dDayToday") : tt("common.dDayPast", { n: -d });
}
export const openDday = () => ddText(WYD_OPEN);

export const sortGori = (list: Gori[]) => list.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));

/**
 * 고리기도 D+N — 시작일은 고정 상수(GORI_START). 시작일이 D+1.
 * 데이터 편집(첫 일정 삭제·날짜 변경)에 흔들리지 않도록 데이터의 첫 날짜는 쓰지 않음. 기간(마지막 배정일) 밖이면 null
 */
export function goriDayPlus(sorted: Gori[], todayISO = todayKST()) {
  if (!sorted.length) return null;
  const end = sorted[sorted.length - 1].date;
  if (todayISO < GORI_START || todayISO > end) return null;
  return { n: daysBetween(GORI_START, todayISO) + 1, total: sorted.length };
}

/** 사진 주소 — 서버 업로드(/uploads/…) 또는 http(s)만 허용 */
export function safePhoto(u: string | null | undefined) {
  const s = String(u ?? "").trim();
  return /^https?:\/\//i.test(s) || /^\/(?!\/)/.test(s) ? s : "";
}

// ── WYD 10억단 묵주기도 봉헌 현황 ─────────────────────────────
export const wydKey = ["wyd-status"] as const;
export function useWydStatus() {
  return useQuery({ queryKey: wydKey, queryFn: () => api.get<WydStatus | null>("/wyd-status"), staleTime: 10 * 60_000 });
}
export function useWydSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<WydStatus | null>("/wyd-status/sync"),
    onSuccess: (r) => {
      qc.setQueryData(wydKey, r);
      toast.success(r ? tt("gori.rosary.synced", { date: r.date }) : tt("gori.rosary.syncedEmpty"));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
const pct = (p: WydStatus["progress"]) => (p == null || (p as unknown) === "" ? "-" : String(p));

/** 묵주기도 봉헌 카드. compact: 고리기도 화면 상단용(요약만) */
export function RosaryCard({ compact, className }: { compact?: boolean; className?: string }) {
  const { data: w, isLoading } = useWydStatus();
  const sync = useWydSync();
  const { isAdmin } = useCan();
  const { t, num } = useT();
  return (
    <div className={cn("flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-soft", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[12.5px] font-semibold text-primary">📿 {t("gori.rosary.title")}</div>
        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            className="-mt-1 -mr-1 h-7 px-2 text-[12px]"
            loading={sync.isPending}
            onClick={() => sync.mutate()}
            aria-label={t("gori.rosary.syncAria")}
          >
            {!sync.isPending && <RefreshCw />}
            {t("gori.rosary.syncNow")}
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="mt-3 h-14" />
      ) : !w ? (
        <div className="mt-2 text-[13px] text-ink-3">
          {t("gori.rosary.noData")}
          <br />
          <span className="text-[12px]">{t("gori.rosary.autoHint")}</span>
        </div>
      ) : (
        <>
          {w.churchTotal != null ? (
            <div className="mt-1.5 text-[26px] leading-tight font-bold tracking-tight text-primary tabular">
              {num(w.churchTotal)}
              <span className="text-[14px] font-semibold"> {t("gori.rosary.unit")}</span>
            </div>
          ) : (
            <div className="mt-1.5 py-1 text-[13px] text-ink-3">{t("gori.rosary.notYet")}</div>
          )}
          {compact ? (
            <div className="mt-1 text-[12px] text-ink-3">{t("gori.rosary.compact", { today: w.today ?? 0, pct: pct(w.progress) })}</div>
          ) : (
            <div className="mt-3 border-t border-line pt-2">
              <div className="mb-1 text-[11.5px] font-semibold text-ink-3">{t("gori.rosary.totalHeader")}</div>
              <dl className="divide-y divide-line text-[13px]">
                <Row k={t("gori.rosary.todayOffer")} v={t("gori.rosary.decades", { n: w.today ?? 0 })} />
                <Row k={t("gori.rosary.totalOffer")} v={t("gori.rosary.decades", { n: w.total ?? 0 })} />
                <Row k={t("gori.rosary.progress")} v={`${pct(w.progress)}%`} />
                {(w.churches != null || w.orgs != null) && (
                  <Row k={t("gori.rosary.participants")} v={`${num(w.churches)} · ${num(w.orgs)}`} />
                )}
              </dl>
            </div>
          )}
          <div className="mt-auto pt-2 text-[11.5px] text-ink-3">{t("gori.rosary.updated", { date: w.date || "-" })}</div>
        </>
      )}
      {!compact && (
        <a
          className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
          href="https://wyd.catholic.or.kr/status.asp"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("gori.rosary.official")}
          <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between py-1">
    <dt className="text-ink-2">{k}</dt>
    <dd className="font-semibold text-ink tabular">{v}</dd>
  </div>
);
