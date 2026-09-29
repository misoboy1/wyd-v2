// 고리기도·묵주기도 봉헌 공용 — 대시보드와 고리기도 화면이 함께 씀
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, RefreshCw } from "lucide-react";
import { GORI_START, WYD_OPEN, todayKST, type Gori, type WydStatus } from "@wyd/shared";
import { api } from "@/lib/api";
import { useCan } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { cn, daysBetween, num } from "@/lib/utils";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
/** "2026-07-20" → 요일(한 글자). 시간대 영향 없이 계산 */
export function weekday(iso: string) {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
  return isNaN(d.getTime()) ? "" : WD[d.getUTCDay()];
}
/** "2026-07-20" → "7/20" */
export const md = (iso: string) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;
/** "2026-07-20" → "7/20 (월)" */
export const mdw = (iso: string) => `${md(iso)} (${weekday(iso)})`;

/** D-DAY 표기: 남은 날 >0 → D-n, 0 → D-DAY, 지남 → D+n */
export function ddText(targetISO: string, todayISO = todayKST()) {
  const d = daysBetween(todayISO, targetISO);
  return d > 0 ? "D-" + d : d === 0 ? "D-DAY" : "D+" + -d;
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
      toast.success(r ? `동기화했습니다 (${r.date})` : "동기화했지만 받은 데이터가 없습니다.");
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
  return (
    <div className={cn("flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-soft", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[12.5px] font-semibold text-primary">📿 중계양업 묵주기도 봉헌</div>
        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            className="-mt-1 -mr-1 h-7 px-2 text-[12px]"
            loading={sync.isPending}
            onClick={() => sync.mutate()}
            aria-label="묵주기도 현황 지금 동기화"
          >
            {!sync.isPending && <RefreshCw />}지금 동기화
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="mt-3 h-14" />
      ) : !w ? (
        <div className="mt-2 text-[13px] text-ink-3">
          아직 데이터 없음
          <br />
          <span className="text-[12px]">매일 아침 자동으로 공식 현황을 가져옵니다.</span>
        </div>
      ) : (
        <>
          {w.churchTotal != null ? (
            <div className="mt-1.5 text-[26px] leading-tight font-bold tracking-tight text-primary tabular">
              {num(w.churchTotal)}
              <span className="text-[14px] font-semibold"> 단</span>
            </div>
          ) : (
            <div className="mt-1.5 py-1 text-[13px] text-ink-3">중계양업 개별 수치는 다음 동기화 때 표시됩니다.</div>
          )}
          {compact ? (
            <div className="mt-1 text-[12px] text-ink-3">
              전체 오늘 {num(w.today ?? 0)}단 · 진행률 {pct(w.progress)}%
            </div>
          ) : (
            <div className="mt-3 border-t border-line pt-2">
              <div className="mb-1 text-[11.5px] font-semibold text-ink-3">전체 봉헌 / 목표 10억단</div>
              <dl className="divide-y divide-line text-[13px]">
                <Row k="오늘 봉헌" v={`${num(w.today ?? 0)} 단`} />
                <Row k="누적 봉헌" v={`${num(w.total ?? 0)} 단`} />
                <Row k="진행률" v={`${pct(w.progress)}%`} />
                {(w.churches != null || w.orgs != null) && <Row k="참여 본당 · 단체" v={`${num(w.churches)} · ${num(w.orgs)}`} />}
              </dl>
            </div>
          )}
          <div className="mt-auto pt-2 text-[11.5px] text-ink-3">갱신: {w.date || "-"}</div>
        </>
      )}
      {!compact && (
        <a
          className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
          href="https://wyd.catholic.or.kr/status.asp"
          target="_blank"
          rel="noopener noreferrer"
        >
          공식 현황 페이지
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
