// 숙소 배정 현황 카드 — 수치 타일 + 100% 누적 가로 막대(교리실·홈스테이·미배정) + 연결 끊김 칩
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { AlertTriangle, BedDouble, LogIn, Unlink } from "lucide-react";
import { SCALE, type MsgKey } from "@wyd/shared";
import { useAuth, useCan } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import type { Totals } from "./stats";

function Tile({ label, value, of, tone }: { label: string; value: number; of?: number; tone?: "good" | "warn" | "bad" }) {
  const { num } = useT();
  const color = tone ? { good: "text-good", warn: "text-warn", bad: "text-bad" }[tone] : "text-ink";
  return (
    <div className="rounded-xl bg-surface-2 px-3.5 py-3">
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className={cn("mt-1 text-[22px] leading-none font-bold tracking-tight whitespace-nowrap tabular", color)}>
        {num(value)}
        {of != null && <span className="text-[13px] font-medium text-ink-3"> / {num(of)}</span>}
      </div>
    </div>
  );
}

const SERIES = [
  { key: "room", label: "dash.stay.room", cls: "bg-series-room" },
  { key: "hs", label: "dash.stay.hs", cls: "bg-series-hs" },
  { key: "none", label: "dash.stay.none", cls: "bg-series-none" },
] as const satisfies readonly { key: string; label: MsgKey; cls: string }[];

/** 100% 누적 막대 — 조각 사이 2px 간격(표면색), 조각마다 title 툴팁, 범례에 수·비율 직접 표기 */
function SplitBar({ room, hs, none }: { room: number; hs: number; none: number }) {
  const { t, num } = useT();
  const vals = { room, hs, none };
  const den = room + hs + none;
  const pct = (n: number) => (den ? Math.round((n / den) * 1000) / 10 : 0);
  const segs = SERIES.filter((s) => vals[s.key] > 0);
  return (
    <figure className="mt-4">
      <figcaption className="sr-only">
        {t("dash.stay.ratio", {
          list: SERIES.map((s) => t("dash.stay.seg", { label: t(s.label), n: vals[s.key], pct: pct(vals[s.key]) })).join(", "),
        })}
      </figcaption>
      <div className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface" aria-hidden>
        {den === 0 ? (
          <div className="h-full w-full rounded-full bg-surface-3" />
        ) : (
          segs.map((s) => (
            <div
              key={s.key}
              className={cn("h-full min-w-1 first:rounded-l-full last:rounded-r-full", s.cls)}
              style={{ flexGrow: vals[s.key], flexBasis: 0 }}
              title={t("dash.stay.segTitle", { label: t(s.label), n: vals[s.key], pct: pct(vals[s.key]) })}
            />
          ))
        )}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px]">
        {SERIES.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", s.cls)} aria-hidden />
            <span className="text-ink-2">{t(s.label)}</span>
            <b className="font-semibold text-ink tabular">{t("common.people", { n: vals[s.key] })}</b>
            <span className="text-ink-3 tabular">{num(pct(vals[s.key]))}%</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function StayCard({ T, loading }: { T: Totals; loading: boolean }) {
  const { canWrite } = useCan();
  const nav = useNavigate();
  const { t } = useT();
  return (
    <Card>
      <CardHeader
        icon={<BedDouble />}
        title={t("dash.stay.title")}
        description={t("dash.stay.desc", { v: SCALE.visitors, h: SCALE.homestays })}
        actions={
          canWrite("visitors") && (
            <Button size="sm" onClick={() => nav("/visitors")}>
              {t("dash.stay.manage")}
            </Button>
          )
        }
      />
      <CardBody>
        {loading ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
              <Tile label={t("dash.stay.visitors")} value={T.total} of={SCALE.visitors} />
              <Tile label={t("dash.stay.assigned")} value={T.inRoom + T.inHs} tone="good" />
              <Tile label={t("dash.stay.none")} value={T.unassigned} tone={T.unassigned ? "warn" : undefined} />
              <Tile label={t("dash.stay.room")} value={T.inRoom} of={T.roomCap} tone={T.roomOver ? "bad" : undefined} />
              <Tile label={t("dash.stay.hs")} value={T.inHs} of={T.hsCap} />
              <Tile label={t("dash.stay.families")} value={T.hsCount} of={SCALE.homestays} />
              <Tile label={t("dash.stay.capacity")} value={T.cap} tone={T.over ? "bad" : undefined} />
            </div>
            <SplitBar room={T.inRoom} hs={T.inHs} none={T.unassigned} />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
              <span>
                {t("dash.stay.capLine", { cap: T.cap, room: T.roomCap, hs: T.hsCap, left: Math.max(0, T.cap - T.inRoom - T.inHs) })}
              </span>
              {T.orphan > 0 && (
                <Link
                  to="/visitors"
                  className="inline-flex items-center gap-1 rounded-full border border-bad/30 bg-bad-soft px-2.5 py-0.5 font-medium text-bad hover:brightness-95"
                >
                  <Unlink className="size-3.5" />
                  {t("dash.stay.orphan", { n: T.orphan })}
                  <span className="font-normal">{t("dash.stay.orphanHint")}</span>
                </Link>
              )}
            </div>
            {T.over && <Warn>{t("dash.stay.over", { n: T.total, cap: T.cap })}</Warn>}
            {T.roomOver && <Warn>{t("dash.stay.roomOver", { n: T.inRoom, cap: T.roomCap })}</Warn>}
          </>
        )}
      </CardBody>
    </Card>
  );
}
const Warn = ({ children }: { children: ReactNode }) => (
  <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-bad-soft px-3.5 py-2.5 text-[13px] text-bad">
    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
    <div>{children}</div>
  </div>
);

/** 비로그인 안내 타일 */
export function StayLocked() {
  const { setLoginOpen } = useAuth();
  const { t } = useT();
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-8 text-center sm:flex-row sm:text-left">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-ink">
        <BedDouble className="size-5" />
      </div>
      <div className="flex-1">
        <div className="text-[15px] font-semibold text-ink">{t("dash.stay.lockedTitle")}</div>
        <div className="mt-0.5 text-[13px] text-ink-3">{t("dash.stay.lockedBody")}</div>
      </div>
      <Button variant="primary" onClick={() => setLoginOpen(true)}>
        <LogIn />
        {t("shell.login")}
      </Button>
    </Card>
  );
}
