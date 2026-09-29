// 대시보드 — D-DAY·오늘의 고리기도·묵주기도 봉헌, 숙소 배정 현황, 바로가기(각 화면 요약)
import { useMemo } from "react";
import { Link } from "react-router";
import { ChevronRight, Download, LayoutDashboard, Printer } from "lucide-react";
import { PARISH, WYD_DIOCESE, WYD_OPEN, todayKST } from "@wyd/shared";
import { useTable } from "@/lib/data";
import { useCan } from "@/lib/auth";
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
  const today = todayKST();
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-primary/40 bg-primary-soft p-5 text-center">
      <div className="text-[12.5px] font-semibold text-primary">2027 서울 WYD 개막까지</div>
      <div className="my-1 text-[40px] leading-none font-bold tracking-tight text-primary tabular">{ddText(WYD_OPEN, today)}</div>
      <div className="text-[12.5px] text-ink-3">
        개막미사 {md(WYD_OPEN)} · 교구대회 {ddText(WYD_DIOCESE, today)}
      </div>
      <More to="/prep">D-DAY 준비 일정</More>
    </div>
  );
}

function GoriTodayCard() {
  const { rows, isLoading } = useTable("gori");
  const list = useMemo(() => sortGori(rows), [rows]);
  const todayIso = todayKST();
  const t = list.find((x) => x.date === todayIso);
  const dp = goriDayPlus(list, todayIso);
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[12.5px] font-semibold text-primary">🙏 오늘의 고리기도</div>
        {dp && <div className="text-[24px] leading-none font-bold text-primary tabular">D+{dp.n}</div>}
      </div>
      {isLoading ? (
        <Skeleton className="mt-3 h-14" />
      ) : t ? (
        <>
          <div className="mt-2 text-[20px] font-bold text-ink">{t.org}</div>
          <div className="mt-0.5 text-[13px] text-ink-2">{t.rep}</div>
          <div className="mt-1.5 text-[11.5px] text-ink-3">{todayIso}</div>
        </>
      ) : (
        <div className="mt-3 text-[13.5px] text-ink-3">오늘({todayIso}) 배정된 고리기도가 없습니다.</div>
      )}
      <More to="/gori">고리기도 일정</More>
    </div>
  );
}

export default function Dashboard() {
  const { loggedIn } = useCan();
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
  const data = {
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
  };
  const all = { ...data, departments: departments.rows };
  const stayLoading = visitors.isLoading || facilities.isLoading || homestays.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<LayoutDashboard />}
        title="대시보드"
        subtitle={`${PARISH.name} 운영 현황 · 아래 수치는 각 화면과 같은 데이터에서 산출`}
        actions={
          loggedIn && (
            <>
              <Button onClick={() => downloadAllCSV(all, T)} disabled={stayLoading}>
                <Download />
                종합 엑셀(CSV)
              </Button>
              <Button variant="primary" onClick={() => printAll(all, T)} disabled={stayLoading}>
                <Printer />
                종합 보고서 PDF·인쇄
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
