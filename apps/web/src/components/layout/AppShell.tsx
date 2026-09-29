import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Dialog as D } from "radix-ui";
import { Lock, LogIn, LogOut, Menu as MenuIcon, Moon, MoreHorizontal, Search, Sun, SunMoon, UserRound, KeyRound, X } from "lucide-react";
import { WYD_OPEN, PARISH } from "@wyd/shared";
import { NAV_GROUPS, NAV_ITEMS, MOBILE_TABS, type NavItem } from "@/lib/nav";
import { useAuth, ROLE_LABEL } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { cn, daysBetween } from "@/lib/utils";
import { todayKST } from "@wyd/shared";
import { Menu, MenuItem, MenuLabel, MenuSep } from "@/components/ui/menu";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "./CommandPalette";
import { LoginDialog } from "./LoginDialog";
import { PasswordDialog } from "./PasswordDialog";

function visible(item: NavItem, role?: string) {
  return !item.roles || (role && item.roles.includes(role as any));
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  return (
    <nav className="flex flex-col gap-5 px-3 py-4" aria-label="주 메뉴">
      {NAV_GROUPS.map((g) => {
        const items = g.items.filter((i) => visible(i, user?.role));
        if (!items.length) return null;
        return (
          <div key={g.label}>
            <div className="mb-1.5 px-2.5 text-[11.5px] font-semibold tracking-wide text-ink-3">{g.label}</div>
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
                    <span className="flex-1 truncate">{i.label}</span>
                    {i.auth && !user && <Lock className="size-3.5 text-ink-3" aria-label="로그인 필요" />}
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
  return (
    <button onClick={() => nav("/")} className="flex min-w-0 items-center gap-2.5 text-left" title="대시보드로 이동">
      <img
        src="/wyd-logo.png"
        alt="WYD Seoul 2027"
        className={cn("w-auto shrink-0 dark:rounded dark:bg-white dark:p-0.5", compact ? "h-7" : "h-8")}
      />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[14px] font-bold text-ink">{PARISH.name}</div>
        <div className="truncate text-[11.5px] text-ink-3">WYD 2027 순례자 맞이</div>
      </div>
    </button>
  );
}

function DdayBadge() {
  const d = daysBetween(todayKST(), WYD_OPEN);
  const label = d > 0 ? `D-${d}` : d === 0 ? "D-DAY" : `D+${-d}`;
  return (
    <div
      className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[12.5px] font-semibold sm:flex"
      title="개막미사 2027-08-03 기준"
    >
      <span className="size-1.5 rounded-full bg-accent" />
      <span className="text-ink-3">개막미사</span>
      <span className="tabular text-ink">{label}</span>
    </div>
  );
}

function ThemeButton() {
  const { pref, setPref } = useTheme();
  const Icon = pref === "dark" ? Moon : pref === "light" ? Sun : SunMoon;
  return (
    <Menu
      trigger={
        <Button variant="ghost" size="icon" aria-label="화면 테마">
          <Icon />
        </Button>
      }
    >
      <MenuLabel>화면 테마</MenuLabel>
      <MenuItem icon={<SunMoon />} onSelect={() => setPref("system")}>
        기기 설정 따름{pref === "system" && " ✓"}
      </MenuItem>
      <MenuItem icon={<Sun />} onSelect={() => setPref("light")}>
        밝게{pref === "light" && " ✓"}
      </MenuItem>
      <MenuItem icon={<Moon />} onSelect={() => setPref("dark")}>
        어둡게{pref === "dark" && " ✓"}
      </MenuItem>
    </Menu>
  );
}

function UserButton() {
  const { user, logout, setLoginOpen } = useAuth();
  const [pw, setPw] = useState(false);
  if (!user)
    return (
      <Button variant="primary" size="sm" onClick={() => setLoginOpen(true)}>
        <LogIn />
        로그인
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
          {user.username} · {ROLE_LABEL[user.role]}
          {user.team ? ` · ${user.team}` : ""}
        </MenuLabel>
        <MenuItem icon={<KeyRound />} onSelect={() => setPw(true)}>
          비밀번호 변경
        </MenuItem>
        <MenuSep />
        <MenuItem icon={<LogOut />} onSelect={() => void logout()}>
          로그아웃
        </MenuItem>
      </Menu>
      <PasswordDialog open={pw} onOpenChange={setPw} />
    </>
  );
}

/** 보호된 화면: 비로그인이면 안내 + 로그인 버튼 */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: readonly string[] }) {
  const { user, ready, setLoginOpen } = useAuth();
  if (!ready) return null;
  if (!user || (roles && !roles.includes(user.role))) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-soft">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-ink">
          <Lock className="size-5" />
        </div>
        <h2 className="text-[17px] font-semibold">{user ? "권한이 필요한 화면입니다" : "로그인이 필요한 화면입니다"}</h2>
        <p className="mt-1.5 text-[13.5px] text-ink-3">
          {user ? "본당 관리자에게 권한을 요청하세요." : "연락처·주소 등 개인정보 보호를 위해 봉사자 계정으로 로그인해야 볼 수 있습니다."}
        </p>
        {!user && (
          <Button variant="primary" className="mt-5" onClick={() => setLoginOpen(true)}>
            <LogIn />
            로그인
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
    document.title = `${current?.label ?? "WYD"} · 중계양업성당 WYD 2027`;
  }, [current]);

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

      {/* 상단 바 */}
      <header className="no-print sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-md lg:pl-64">
        <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="메뉴" onClick={() => setDrawer(true)}>
            <MenuIcon />
          </Button>
          <div className="min-w-0 lg:hidden">
            <Brand compact />
          </div>
          <div className="hidden min-w-0 lg:block">
            <div className="text-[15px] font-semibold text-ink">{current?.label}</div>
            <div className="text-[11.5px] text-ink-3">{current?.en}</div>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setCmd(true)}
            className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-[13px] text-ink-3 hover:border-line-strong md:flex"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">이름·번호·메뉴 검색</span>
            <kbd className="rounded border border-line bg-surface px-1.5 text-[11px]">⌘K</kbd>
          </button>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="검색" onClick={() => setCmd(true)}>
            <Search />
          </Button>
          <DdayBadge />
          <ThemeButton />
          <UserButton />
        </div>
      </header>

      {/* 모바일 드로어 */}
      <D.Root open={drawer} onOpenChange={setDrawer}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-72 flex-col bg-surface shadow-pop outline-none lg:hidden">
            <D.Title className="sr-only">메뉴</D.Title>
            <D.Description className="sr-only">화면 이동</D.Description>
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <Brand compact />
              <D.Close className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2" aria-label="닫기">
                <X className="size-5" />
              </D.Close>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavList onNavigate={() => setDrawer(false)} />
            </div>
            {!user && (
              <div className="border-t border-line p-3 text-[12px] text-ink-3">
                <UserRound className="mr-1 inline size-3.5" />
                자물쇠 메뉴는 로그인 후 이용할 수 있습니다.
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
        aria-label="빠른 메뉴"
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
            {i.label.replace(" 명단", "").replace(" 가정", "").replace(" 일정", "")}
          </NavLink>
        ))}
        <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink-3">
          <MoreHorizontal className="size-5" />
          더보기
        </button>
      </nav>

      <CommandPalette open={cmd} onOpenChange={setCmd} />
      <LoginDialog />
    </div>
  );
}
