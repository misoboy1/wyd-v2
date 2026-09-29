// 바로가기(Quick Menu) — 각 화면 요약(배지·요약·항목). 기존 dashNavInfo 이식
import { useNavigate } from "react-router";
import { ChevronRight, Lock } from "lucide-react";
import { TEAM_NAMES, NO_TEAM, isTeamLead, roleRank, cmpStr, teamOf, teamRange, todayKST, type Dataset, type Volunteer } from "@wyd/shared";
import { NAV_ITEMS, type NavItem } from "@/lib/nav";
import { useAuth } from "@/lib/auth";
import { cn, num } from "@/lib/utils";
import { Progress } from "@/components/ui/misc";
import { md, sortGori } from "@/components/gori/common";
import type { Totals } from "./stats";

type Tone = "" | "amber" | "red";
interface Info {
  badge: string;
  summary: string;
  tone?: Tone;
  items: string[];
  progress?: number;
}
type Data = Pick<
  Dataset,
  "prep" | "gori" | "schedule" | "facilities" | "volunteers" | "homestays" | "visitors" | "notices" | "posts" | "qna" | "places"
>;

function volsByTeam(list: Volunteer[]) {
  const g: Record<string, Volunteer[]> = {};
  list.forEach((v) => {
    const t = teamOf(v);
    (g[t] ??= []).push(v);
  });
  Object.values(g).forEach((l) => l.sort((a, b) => roleRank(a.role) - roleRank(b.role) || cmpStr(a.name, b.name)));
  return g;
}

function info(path: string, d: Data, T: Totals): Info {
  switch (path) {
    case "/prep": {
      const list = d.prep.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id);
      const done = list.filter((x) => x.done).length,
        tot = list.length || 16;
      const next = list
        .filter((x) => !x.done)
        .slice(0, 5)
        .map((x) => "◦ " + x.title);
      return {
        badge: `${done}/${tot}`,
        summary: `D-DAY 준비 ${tot}단계 중 ${done}단계 완료`,
        tone: done >= tot ? "" : "amber",
        items: next.length ? next : ["◦ 모든 단계 완료"],
        progress: Math.round((done / tot) * 100),
      };
    }
    case "/gori": {
      const g = sortGori(d.gori),
        today = todayKST(),
        t = g.find((x) => x.date === today);
      return {
        badge: g.length + "일",
        summary: t ? `오늘: ${t.org} · ${t.rep}` : g.length ? `배정 기간 ${md(g[0].date)}~${md(g[g.length - 1].date)}` : "미등록",
        items: g
          .filter((x) => x.date >= today)
          .slice(0, 5)
          .map((x) => `${md(x.date)} ${x.org}`),
      };
    }
    case "/org": {
      const bt = volsByTeam(d.volunteers);
      const short = TEAM_NAMES.filter((t: string) => {
        const r = teamRange(t);
        return r && (bt[t] ?? []).length < r.min;
      });
      return {
        badge: TEAM_NAMES.length + "개 팀",
        summary: "WYD 봉사단 팀 중심 조직" + (short.length ? ` · 부족 ${short.length}팀` : ""),
        tone: short.length ? "amber" : "",
        items: TEAM_NAMES.slice(0, 6).map((t: string) => {
          const l = bt[t] ?? [];
          const ld = l.find((v) => isTeamLead(v.role));
          return `◦ ${t} ${l.length}명` + (ld ? " · " + ld.name : "");
        }),
      };
    }
    case "/schedule": {
      const s = d.schedule.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id);
      return {
        badge: s.length + "건",
        summary: s.length ? "교구대회·본대회 일정" : "일정 없음",
        items: s.slice(0, 3).map((x) => `${x.date} ${x.event || ""}`),
      };
    }
    case "/facilities": {
      const f = d.facilities,
        av = f.filter((x) => x.status === "가용").length,
        use = f.filter((x) => x.status === "사용중");
      return {
        badge: `${av}/${f.length}`,
        summary: `가용 ${av} · 사용중 ${use.length} · 전체 ${f.length}`,
        tone: av ? "" : "red",
        items: use.length
          ? [
              "사용중: " +
                use
                  .slice(0, 4)
                  .map((x) => x.name)
                  .join(", "),
            ]
          : [],
      };
    }
    case "/volunteers": {
      const bt = volsByTeam(d.volunteers),
        un = (bt[NO_TEAM] ?? []).length,
        teams = TEAM_NAMES.filter((t: string) => bt[t]);
      return {
        badge: d.volunteers.length + "명",
        summary: `봉사자 ${d.volunteers.length}명 · ${teams.length}개 팀 배정` + (un ? ` · 팀 미배정 ${un}` : ""),
        tone: un ? "amber" : "",
        items: teams.slice(0, 6).map((t: string) => `◦ ${t} ${bt[t].length}`),
      };
    }
    case "/homestays": {
      const h = d.homestays,
        un = T.unmatched;
      return {
        badge: num(h.length) + "가정",
        summary: `등록 ${num(h.length)}가정 · 수용 ${num(T.hsCap)}석 · 배정 ${num(T.inHs)}명` + (un ? ` · 미매칭 ${un}` : ""),
        tone: un ? "amber" : "",
        items: h.slice(0, 6).map((x) => "◦ " + x.host),
      };
    }
    case "/visitors": {
      const bc = new Map<string, number>();
      d.visitors.forEach((x) => bc.set(x.country, (bc.get(x.country) ?? 0) + 1));
      return {
        badge: num(d.visitors.length) + "명",
        summary: `${bc.size}개국 ${num(d.visitors.length)}명 · 미배정 ${num(T.unassigned)}명`,
        tone: T.unassigned ? "amber" : "",
        items: [...bc.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([k, n]) => `◦ ${k || "국가 미입력"} ${n}`),
      };
    }
    case "/notices": {
      const n = d.notices.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
      return { badge: n.length + "건", summary: n.length ? "공지사항" : "공지 없음", items: n.slice(0, 3).map((x) => "◦ " + x.title) };
    }
    case "/posts": {
      const p = d.posts.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
      return { badge: p.length + "건", summary: p.length ? "게시판 글" : "게시글 없음", items: p.slice(0, 3).map((x) => "◦ " + x.title) };
    }
    case "/qna": {
      const un = d.qna.filter((x) => !x.answered);
      return {
        badge: d.qna.length + "건",
        summary: un.length ? `미답변 ${un.length}건 대기` : "모두 답변 완료",
        tone: un.length ? "red" : "",
        items: (un.length ? un : d.qna).slice(0, 3).map((x) => "◦ " + x.q),
      };
    }
    case "/places": {
      const bc = new Map<string, number>();
      d.places.forEach((x) => bc.set(x.cat, (bc.get(x.cat) ?? 0) + 1));
      return {
        badge: d.places.length + "곳",
        summary: `추천 장소·지도 ${d.places.length}곳`,
        items: [...bc.entries()].slice(0, 4).map(([k, n]) => `◦ ${k} ${n}`),
      };
    }
  }
  return { badge: "", summary: "", items: [] };
}

const TONE_CLS: Record<Tone, string> = {
  "": "bg-primary-soft text-primary-soft-ink",
  amber: "bg-warn-soft text-warn",
  red: "bg-bad-soft text-bad",
};

function NavCard({ item, i, locked, onClick }: { item: NavItem; i: Info | null; locked: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col rounded-2xl border border-line bg-surface p-4 text-left shadow-soft transition hover:border-line-strong hover:shadow-card focus-visible:ring-3 focus-visible:ring-[var(--ring)] focus-visible:outline-none",
        locked && "bg-surface-2/60",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            locked ? "bg-surface-3 text-ink-3" : "bg-primary-soft text-primary-soft-ink",
          )}
        >
          <Icon className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold text-ink">{item.label}</span>
          <span className="block truncate text-[11.5px] text-ink-3">{item.en}</span>
        </span>
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[11.5px] font-medium text-ink-3">
            <Lock className="size-3" />
            로그인
          </span>
        ) : (
          i?.badge && (
            <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap tabular", TONE_CLS[i.tone ?? ""])}>
              {i.badge}
            </span>
          )
        )}
      </div>
      {locked ? (
        <p className="mt-3 text-[12.5px] text-ink-3">로그인하면 볼 수 있습니다.</p>
      ) : (
        i && (
          <>
            {i.summary && <p className="mt-3 text-[13px] font-medium text-ink-2">{i.summary}</p>}
            {i.progress != null && <Progress value={i.progress} tone={i.progress >= 100 ? "good" : "primary"} className="mt-2 h-1.5" />}
            {i.items.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-[12.5px] text-ink-3">
                {i.items.map((t, k) => (
                  <li key={k} className="truncate">
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      )}
      <span className="mt-auto inline-flex items-center gap-0.5 pt-3 text-[12.5px] font-medium text-primary opacity-80 group-hover:opacity-100">
        {locked ? "로그인" : "이동"}
        <ChevronRight className="size-3.5" />
      </span>
    </button>
  );
}

export function QuickMenu({ data, T }: { data: Data; T: Totals }) {
  const { user, setLoginOpen } = useAuth();
  const nav = useNavigate();
  const items = NAV_ITEMS.filter((n) => n.path !== "/" && (!n.roles || (user && n.roles.includes(user.role))) && n.path !== "/admin/users");
  return (
    <section aria-labelledby="qm-title">
      <h2 id="qm-title" className="mb-3 text-[16px] font-semibold text-ink">
        바로가기 <span className="text-[12.5px] font-normal text-ink-3">Quick Menu · 각 메뉴 요약 · 누르면 이동</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((n) => {
          const locked = !!n.auth && !user;
          return (
            <NavCard
              key={n.path}
              item={n}
              locked={locked}
              i={locked ? null : info(n.path, data, T)}
              onClick={() => (locked ? setLoginOpen(true) : nav(n.path))}
            />
          );
        })}
      </div>
    </section>
  );
}
