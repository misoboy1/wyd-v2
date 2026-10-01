// 바로가기(Quick Menu) — 각 화면 요약(배지·요약·항목). 기존 dashNavInfo 이식
import { useNavigate } from "react-router";
import { ChevronRight, Lock } from "lucide-react";
import {
  TEAM_NAMES,
  NO_TEAM,
  isTeamLead,
  roleRank,
  cmpStr,
  teamOf,
  teamRange,
  todayKST,
  translate,
  type Dataset,
  type Volunteer,
} from "@wyd/shared";
import { NAV_ITEMS, type NavItem } from "@/lib/nav";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
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

type Tr = ReturnType<typeof useT>;

function info(path: string, d: Data, T: Totals, { t, label }: Tr): Info {
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
        summary: t("dash.quick.prepSummary", { tot, done }),
        tone: done >= tot ? "" : "amber",
        items: next.length ? next : ["◦ " + t("dash.quick.prepAllDone")],
        progress: Math.round((done / tot) * 100),
      };
    }
    case "/gori": {
      const g = sortGori(d.gori),
        today = todayKST(),
        cur = g.find((x) => x.date === today);
      return {
        badge: t("common.days", { n: g.length }),
        summary: cur
          ? t("dash.quick.goriToday", { org: cur.org, rep: cur.rep })
          : g.length
            ? t("dash.quick.goriRange", { from: md(g[0].date), to: md(g[g.length - 1].date) })
            : t("dash.quick.goriNone"),
        items: g
          .filter((x) => x.date >= today)
          .slice(0, 5)
          .map((x) => `${md(x.date)} ${x.org}`),
      };
    }
    case "/org": {
      const bt = volsByTeam(d.volunteers);
      const short = TEAM_NAMES.filter((tm: string) => {
        const r = teamRange(tm);
        return r && (bt[tm] ?? []).length < r.min;
      });
      return {
        badge: t("dash.quick.teams", { n: TEAM_NAMES.length }),
        summary: short.length ? t("dash.quick.orgSummaryShort", { n: short.length }) : t("dash.quick.orgSummary"),
        tone: short.length ? "amber" : "",
        items: TEAM_NAMES.slice(0, 6).map((tm: string) => {
          const l = bt[tm] ?? [];
          const ld = l.find((v) => isTeamLead(v.role));
          return `◦ ${tm} ${t("common.people", { n: l.length })}` + (ld ? " · " + ld.name : "");
        }),
      };
    }
    case "/schedule": {
      const s = d.schedule.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id);
      return {
        badge: t("common.count", { n: s.length }),
        summary: s.length ? t("dash.quick.schedSummary") : t("dash.quick.schedNone"),
        items: s.slice(0, 3).map((x) => `${x.date} ${x.event || ""}`),
      };
    }
    case "/facilities": {
      const f = d.facilities,
        av = f.filter((x) => x.status === "가용").length,
        use = f.filter((x) => x.status === "사용중");
      return {
        badge: `${av}/${f.length}`,
        summary: t("dash.quick.facSummary", { av, use: use.length, all: f.length }),
        tone: av ? "" : "red",
        items: use.length
          ? [
              t("dash.quick.facInUse", {
                list: use
                  .slice(0, 4)
                  .map((x) => x.name)
                  .join(", "),
              }),
            ]
          : [],
      };
    }
    case "/volunteers": {
      const bt = volsByTeam(d.volunteers),
        un = (bt[NO_TEAM] ?? []).length,
        teams = TEAM_NAMES.filter((tm: string) => bt[tm]);
      const p = { n: d.volunteers.length, teams: teams.length, un };
      return {
        badge: t("common.people", { n: d.volunteers.length }),
        summary: un ? t("dash.quick.volSummaryUn", p) : t("dash.quick.volSummary", p),
        tone: un ? "amber" : "",
        items: teams.slice(0, 6).map((tm: string) => `◦ ${tm} ${bt[tm].length}`),
      };
    }
    case "/homestays": {
      const h = d.homestays,
        un = T.unmatched;
      const p = { n: h.length, cap: T.hsCap, inHs: T.inHs, un };
      return {
        badge: t("dash.quick.families", { n: h.length }),
        summary: un ? t("dash.quick.hsSummaryUn", p) : t("dash.quick.hsSummary", p),
        tone: un ? "amber" : "",
        items: h.slice(0, 6).map((x) => "◦ " + x.host),
      };
    }
    case "/visitors": {
      const bc = new Map<string, number>();
      d.visitors.forEach((x) => bc.set(x.country, (bc.get(x.country) ?? 0) + 1));
      return {
        badge: t("common.people", { n: d.visitors.length }),
        summary: t("dash.quick.visSummary", { countries: bc.size, n: d.visitors.length, un: T.unassigned }),
        tone: T.unassigned ? "amber" : "",
        items: [...bc.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([k, n]) => `◦ ${k || t("dash.quick.noCountry")} ${n}`),
      };
    }
    case "/notices": {
      const n = d.notices.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
      return {
        badge: t("common.count", { n: n.length }),
        summary: n.length ? t("dash.quick.noticeSummary") : t("dash.quick.noticeNone"),
        items: n.slice(0, 3).map((x) => "◦ " + x.title),
      };
    }
    case "/posts": {
      const p = d.posts.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
      return {
        badge: t("common.count", { n: p.length }),
        summary: p.length ? t("dash.quick.postSummary") : t("dash.quick.postNone"),
        items: p.slice(0, 3).map((x) => "◦ " + x.title),
      };
    }
    case "/qna": {
      const un = d.qna.filter((x) => !x.answered);
      return {
        badge: t("common.count", { n: d.qna.length }),
        summary: un.length ? t("dash.quick.qnaPending", { n: un.length }) : t("dash.quick.qnaAllDone"),
        tone: un.length ? "red" : "",
        items: (un.length ? un : d.qna).slice(0, 3).map((x) => "◦ " + x.q),
      };
    }
    case "/places": {
      const bc = new Map<string, number>();
      d.places.forEach((x) => bc.set(x.cat, (bc.get(x.cat) ?? 0) + 1));
      return {
        badge: t("dash.quick.places", { n: d.places.length }),
        summary: t("dash.quick.placesSummary", { n: d.places.length }),
        items: [...bc.entries()].slice(0, 4).map(([k, n]) => `◦ ${label("placeCat", k)} ${n}`),
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
  const { t, locale } = useT();
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
          <span className="block truncate text-[14.5px] font-semibold text-ink">{t(item.label)}</span>
          {locale !== "en" && <span className="block truncate text-[11.5px] text-ink-3">{translate("en", item.label)}</span>}
        </span>
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[11.5px] font-medium text-ink-3">
            <Lock className="size-3" />
            {t("dash.quick.login")}
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
        <p className="mt-3 text-[12.5px] text-ink-3">{t("dash.quick.loginToView")}</p>
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
        {locked ? t("dash.quick.login") : t("dash.quick.go")}
        <ChevronRight className="size-3.5" />
      </span>
    </button>
  );
}

export function QuickMenu({ data, T }: { data: Data; T: Totals }) {
  const { user, setLoginOpen } = useAuth();
  const nav = useNavigate();
  const tr = useT();
  const { t } = tr;
  const items = NAV_ITEMS.filter((n) => n.path !== "/" && (!n.roles || (user && n.roles.includes(user.role))) && n.path !== "/admin/users");
  return (
    <section aria-labelledby="qm-title">
      <h2 id="qm-title" className="mb-3 text-[16px] font-semibold text-ink">
        {t("dash.quick.title")} <span className="text-[12.5px] font-normal text-ink-3">{t("dash.quick.sub")}</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((n) => {
          const locked = !!n.auth && !user;
          return (
            <NavCard
              key={n.path}
              item={n}
              locked={locked}
              i={locked ? null : info(n.path, data, T, tr)}
              onClick={() => (locked ? setLoginOpen(true) : nav(n.path))}
            />
          );
        })}
      </div>
    </section>
  );
}
