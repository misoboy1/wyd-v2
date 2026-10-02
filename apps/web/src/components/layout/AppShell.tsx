import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Dialog as D } from "radix-ui";
import { toast } from "sonner";
import {
  Check,
  Languages,
  Lock,
  LogIn,
  LogOut,
  Menu as MenuIcon,
  Moon,
  MoreHorizontal,
  Search,
  Sun,
  SunMoon,
  UserRound,
  KeyRound,
  X,
} from "lucide-react";
import { LOCALES, LOCALE_NAMES, WYD_OPEN, PARISH } from "@wyd/shared";
import { NAV_GROUPS, NAV_ITEMS, MOBILE_TABS, type NavItem } from "@/lib/nav";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { cn, daysBetween } from "@/lib/utils";
import { navLabelEn, todayKST, type MsgKey } from "@wyd/shared";
import { Menu, MenuItem, MenuLabel, MenuSep } from "@/components/ui/menu";
import { Button } from "@/components/ui/button";
import { LoginDialog } from "./LoginDialog";
import { PasswordDialog } from "./PasswordDialog";

// 명령 팔레트(cmdk)는 ⌘K를 처음 누를 때 불러옴 — 첫 번들 절감
const CommandPalette = lazy(() => import("./CommandPalette").then((m) => ({ default: m.CommandPalette })));

const MOBILE_TAB_LABEL: Record<string, MsgKey> = {
  "/": "shell.mobileTab.dash",
  "/visitors": "shell.mobileTab.visitors",
  "/homestays": "shell.mobileTab.homestays",
  "/gori": "shell.mobileTab.gori",
};

function visible(item: NavItem, role?: string) {
  return !item.roles || (role && item.roles.includes(role as any));
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const { t } = useT();
  return (
    <nav className="flex flex-col gap-5 px-3 py-4" aria-label={t("shell.mainNav")}>
      {NAV_GROUPS.map((g) => {
        const items = g.items.filter((i) => visible(i, user?.role));
        if (!items.length) return null;
        return (
          <div key={g.label}>
            <div className="mb-1.5 px-2.5 text-[11.5px] font-semibold tracking-wide text-ink-3">{t(g.label)}</div>
            <ul className="flex flex-col gap-0.5">
              {items.map((i) => (
                <li key={i.path}>
                  <NavLink
                    to={i.path}
                    end={i.path === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-medium transition-colors",
                        isActive ? "bg-primary-soft text-primary-soft-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                      )
                    }
                  >
                    <i.icon className="size-4.5 shrink-0 opacity-80" />
                    <span className="flex-1 truncate">{t(i.label)}</span>
                    {i.auth && !user && <Lock className="size-3.5 text-ink-3" aria-label={t("shell.loginRequired")} />}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  const nav = useNavigate();
  const { t } = useT();
  return (
    <button onClick={() => nav("/")} className="flex min-w-0 items-center gap-2.5 text-left" title={t("shell.goDashboard")}>
      <img
        src="/wyd-logo.png"
        alt="WYD Seoul 2027"
        className={cn("w-auto shrink-0 dark:rounded dark:bg-white dark:p-0.5", compact ? "h-7" : "h-8")}
      />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[14px] font-bold text-ink">{PARISH.name}</div>
        <div className="truncate text-[11.5px] text-ink-3">{t("shell.tagline")}</div>
      </div>
    </button>
  );
}

function DdayBadge() {
  const { t } = useT();
  const d = daysBetween(todayKST(), WYD_OPEN);
  const label = d > 0 ? t("common.dDay", { n: d }) : d === 0 ? t("common.dDayToday") : t("common.dDayPast", { n: -d });
  return (
    <div
      className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[12.5px] font-semibold sm:flex"
      title={t("shell.openingMassHint")}
    >
      <span className="size-1.5 rounded-full bg-accent" />
      <span className="text-ink-3">{t("shell.openingMass")}</span>
      <span className="tabular text-ink">{label}</span>
    </div>
  );
}

function ThemeButton() {
  const { pref, setPref } = useTheme();
  const { t } = useT();
  const Icon = pref === "dark" ? Moon : pref === "light" ? Sun : SunMoon;
  return (
    <Menu
      trigger={
        <Button variant="ghost" size="icon" aria-label={t("shell.themeTitle")}>
          <Icon />
        </Button>
      }
    >
      <MenuLabel>{t("shell.themeTitle")}</MenuLabel>
      <MenuItem icon={<SunMoon />} onSelect={() => setPref("system")}>
        {t("shell.themeSystem")}
        {pref === "system" && " ✓"}
      </MenuItem>
      <MenuItem icon={<Sun />} onSelect={() => setPref("light")}>
        {t("shell.themeLight")}
        {pref === "light" && " ✓"}
      </MenuItem>
      <MenuItem icon={<Moon />} onSelect={() => setPref("dark")}>
        {t("shell.themeDark")}
        {pref === "dark" && " ✓"}
      </MenuItem>
    </Menu>
  );
}

function LangButton() {
  const { t, locale, setLocale } = useT();
  return (
    <Menu
      trigger={
        <Button variant="ghost" size="icon" aria-label={t("shell.langTitle")}>
          <Languages />
        </Button>
      }
    >
      <MenuLabel>{t("shell.langTitle")}</MenuLabel>
      {LOCALES.map((l) => (
        <MenuItem
          key={l}
          icon={l === locale ? <Check /> : <span className="size-4" />}
          onSelect={() => void setLocale(l).then((ok) => ok || toast.error(t("shell.langLoadFailed")))}
        >
          <span lang={l}>{LOCALE_NAMES[l]}</span>
        </MenuItem>
      ))}
    </Menu>
  );
}

function UserButton() {
  const { user, logout, setLoginOpen } = useAuth();
  const { t, label } = useT();
  const [pw, setPw] = useState(false);
  if (!user)
    return (
      <Button variant="primary" size="sm" onClick={() => setLoginOpen(true)}>
        <LogIn />
        {t("shell.login")}
      </Button>
    );
  return (
    <>
      <Menu
        trigger={
          <button className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-[13px] hover:bg-surface-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-ink">
              {(user.name || user.username).slice(0, 1)}
            </span>
            <span className="hidden max-w-28 truncate font-medium sm:block">{user.name || user.username}</span>
          </button>
        }
      >
        <MenuLabel>
          {user.username} · {label("appRole", user.role)}
          {user.team ? ` · ${user.team}` : ""}
        </MenuLabel>
        <MenuItem icon={<KeyRound />} onSelect={() => setPw(true)}>
          {t("shell.changePassword")}
        </MenuItem>
        <MenuSep />
        <MenuItem icon={<LogOut />} onSelect={() => void logout()}>
          {t("shell.logout")}
        </MenuItem>
      </Menu>
      <PasswordDialog open={pw} onOpenChange={setPw} />
    </>
  );
}

/** 보호된 화면: 비로그인이면 안내 + 로그인 버튼 */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: readonly string[] }) {
  const { user, ready, setLoginOpen } = useAuth();
  const { t } = useT();
  if (!ready) return null;
  if (!user || (roles && !roles.includes(user.role))) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-soft">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-ink">
          <Lock className="size-5" />
        </div>
        <h2 className="text-[17px] font-semibold">{user ? t("shell.needRoleTitle") : t("shell.needLoginTitle")}</h2>
        <p className="mt-1.5 text-[13.5px] text-ink-3">{user ? t("shell.needRoleBody") : t("shell.needLoginBody")}</p>
        {!user && (
          <Button variant="primary" className="mt-5" onClick={() => setLoginOpen(true)}>
            <LogIn />
            {t("shell.login")}
          </Button>
        )}
      </div>
    );
  }
  return <>{children}</>;
}

export function AppShell() {
  const [drawer, setDrawer] = useState(false);
  const [cmd, setCmd] = useState(false);
  const loc = useLocation();
  const { user } = useAuth();
  const { t, locale } = useT();

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmd((v) => !v);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);
  const current = NAV_ITEMS.find((i) => (i.path === "/" ? loc.pathname === "/" : loc.pathname.startsWith(i.path)));
  useEffect(() => {
    document.title = t("shell.docTitle", { page: current ? t(current.label) : "WYD" });
  }, [current, t]);

  return (
    <div className="min-h-dvh">
      {/* 데스크톱 사이드바 */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center border-b border-line px-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>
        <div className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-ink-3">
          <img src="/parish-logo.png" alt="" className="mb-2 h-9 w-auto opacity-80 dark:rounded dark:bg-white dark:p-0.5" />
          {PARISH.addr}
          <br />
          {PARISH.tel}
        </div>
      </aside>

      {/* 상단 바 — 높이(h-14/sm:h-16)를 바꾸면 App.tsx Toaster offset도 함께 수정 */}
      <header className="no-print sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-md lg:pl-64">
        <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("shell.menu")} onClick={() => setDrawer(true)}>
            <MenuIcon />
          </Button>
          <div className="min-w-0 lg:hidden">
            <Brand compact />
          </div>
          <div className="hidden min-w-0 lg:block">
            <div className="text-[15px] font-semibold text-ink">{current && t(current.label)}</div>
            {locale !== "en" && current && <div className="text-[11.5px] text-ink-3">{navLabelEn(current.label)}</div>}
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setCmd(true)}
            className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-[13px] text-ink-3 hover:border-line-strong md:flex"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">{t("shell.searchHint")}</span>
            <kbd className="rounded border border-line bg-surface px-1.5 text-[11px]">⌘K</kbd>
          </button>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("shell.search")} onClick={() => setCmd(true)}>
            <Search />
          </Button>
          <DdayBadge />
          <LangButton />
          <ThemeButton />
          <UserButton />
        </div>
      </header>

      {/* 모바일 드로어 */}
      <D.Root open={drawer} onOpenChange={setDrawer}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-72 flex-col bg-surface shadow-pop outline-none lg:hidden">
            <D.Title className="sr-only">{t("shell.menu")}</D.Title>
            <D.Description className="sr-only">{t("shell.navigate")}</D.Description>
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <Brand compact />
              <D.Close className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2" aria-label={t("common.close")}>
                <X className="size-5" />
              </D.Close>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavList onNavigate={() => setDrawer(false)} />
            </div>
            {!user && (
              <div className="border-t border-line p-3 text-[12px] text-ink-3">
                <UserRound className="mr-1 inline size-3.5" />
                {t("shell.lockedHint")}
              </div>
            )}
          </D.Content>
        </D.Portal>
      </D.Root>

      <main className="px-3 pt-5 pb-28 sm:px-6 lg:pb-12 lg:pl-[calc(16rem+1.5rem)] print:p-0">
        <div className="mx-auto max-w-[1400px]">
          <Outlet />
        </div>
      </main>

      {/* 모바일 하단 탭 */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label={t("shell.quickNav")}
      >
        {MOBILE_TABS.map((p) => NAV_ITEMS.find((i) => i.path === p)!).map((i) => (
          <NavLink
            key={i.path}
            to={i.path}
            end={i.path === "/"}
            className={({ isActive }) =>
              cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", isActive ? "text-primary" : "text-ink-3")
            }
          >
            <i.icon className="size-5" />
            {t(MOBILE_TAB_LABEL[i.path])}
          </NavLink>
        ))}
        <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink-3">
          <MoreHorizontal className="size-5" />
          {t("shell.more")}
        </button>
      </nav>

      {cmd && (
        <Suspense fallback={null}>
          <CommandPalette open={cmd} onOpenChange={setCmd} />
        </Suspense>
      )}
      <LoginDialog />
    </div>
  );
}
