// 대시보드 — D-DAY·오늘의 고리기도·묵주기도 봉헌, 숙소 배정 현황, 바로가기(각 화면 요약)
import { useMemo } from "react";
import { Link } from "react-router";
import { ChevronRight, Download, LayoutDashboard, Printer } from "lucide-react";
import { PARISH, WYD_DIOCESE, WYD_OPEN, todayKST } from "@wyd/shared";
import { useTable } from "@/lib/data";
import { useCan } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ddText, goriDayPlus, md, RosaryCard, sortGori } from "@/components/gori/common";
import { totals } from "@/components/dash/stats";
import { StayCard, StayLocked } from "@/components/dash/StayCard";
import { QuickMenu } from "@/components/dash/QuickMenu";
import { downloadAllCSV, printAll } from "@/components/dash/exportAll";

const More = ({ to, children }: { to: string; children: string }) => (
  <Link to={to} className="mt-auto inline-flex items-center gap-0.5 pt-3 text-[12.5px] font-medium text-primary hover:underline">
    {children}
    <ChevronRight className="size-3.5" />
  </Link>
);

function DdayCard() {
  const { t } = useT();
  const today = todayKST();
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-primary/40 bg-primary-soft p-5 text-center">
      <div className="text-[12.5px] font-semibold text-primary">{t("dash.ddayTitle")}</div>
      <div className="my-1 text-[40px] leading-none font-bold tracking-tight text-primary tabular">{ddText(WYD_OPEN, today)}</div>
      <div className="text-[12.5px] text-ink-3">{t("dash.ddaySub", { open: md(WYD_OPEN), diocese: ddText(WYD_DIOCESE, today) })}</div>
      <More to="/prep">{t("dash.prepLink")}</More>
    </div>
  );
}

function GoriTodayCard() {
  const { t } = useT();
  const { rows, isLoading } = useTable("gori");
  const list = useMemo(() => sortGori(rows), [rows]);
  const todayIso = todayKST();
  const cur = list.find((x) => x.date === todayIso);
  const dp = goriDayPlus(list, todayIso);
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[12.5px] font-semibold text-primary">🙏 {t("gori.todayTitle")}</div>
        {dp && <div className="text-[24px] leading-none font-bold text-primary tabular">{t("common.dDayPast", { n: dp.n })}</div>}
      </div>
      {isLoading ? (
        <Skeleton className="mt-3 h-14" />
      ) : cur ? (
        <>
          <div className="mt-2 text-[20px] font-bold text-ink">{cur.org}</div>
          <div className="mt-0.5 text-[13px] text-ink-2">{cur.rep}</div>
          <div className="mt-1.5 text-[11.5px] text-ink-3">{todayIso}</div>
        </>
      ) : (
        <div className="mt-3 text-[13.5px] text-ink-3">{t("gori.todayNone", { date: todayIso })}</div>
      )}
      <More to="/gori">{t("gori.title")}</More>
    </div>
  );
}

export default function Dashboard() {
  const { loggedIn } = useCan();
  const { t } = useT();
  const visitors = useTable("visitors"),
    facilities = useTable("facilities"),
    homestays = useTable("homestays");
  const volunteers = useTable("volunteers"),
    departments = useTable("departments");
  const prep = useTable("prep"),
    gori = useTable("gori"),
    schedule = useTable("schedule"),
    notices = useTable("notices");
  const posts = useTable("posts"),
    qna = useTable("qna"),
    places = useTable("places");

  const T = useMemo(() => totals(visitors.rows, facilities.rows, homestays.rows), [visitors.rows, facilities.rows, homestays.rows]);
  const data = useMemo(
    () => ({
      visitors: visitors.rows,
      facilities: facilities.rows,
      homestays: homestays.rows,
      volunteers: volunteers.rows,
      prep: prep.rows,
      gori: gori.rows,
      schedule: schedule.rows,
      notices: notices.rows,
      posts: posts.rows,
      qna: qna.rows,
      places: places.rows,
    }),
    [
      visitors.rows,
      facilities.rows,
      homestays.rows,
      volunteers.rows,
      prep.rows,
      gori.rows,
      schedule.rows,
      notices.rows,
      posts.rows,
      qna.rows,
      places.rows,
    ],
  );
  const all = { ...data, departments: departments.rows };
  const stayLoading = visitors.isLoading || facilities.isLoading || homestays.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<LayoutDashboard />}
        title={t("nav.dash")}
        subtitle={t("dash.subtitle", { parish: PARISH.name })}
        actions={
          loggedIn && (
            <>
              <Button onClick={() => downloadAllCSV(all, T)} disabled={stayLoading}>
                <Download />
                {t("dash.exportCsv")}
              </Button>
              <Button variant="primary" onClick={() => printAll(all, T)} disabled={stayLoading}>
                <Printer />
                {t("dash.printReport")}
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <DdayCard />
        <GoriTodayCard />
        <RosaryCard />
      </div>

      {loggedIn ? <StayCard T={T} loading={stayLoading} /> : <StayLocked />}

      <QuickMenu data={data} T={T} />
    </div>
  );
}
