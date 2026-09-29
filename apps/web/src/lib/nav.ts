import { LayoutDashboard, Hourglass, CalendarDays, Users, Building2, Home, Network, HandHeart, Megaphone, MessagesSquare, CircleHelp, MapPin, Flower2, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Role } from "@wyd/shared";

export interface NavItem { path: string; label: string; en: string; icon: LucideIcon; auth?: boolean; roles?: Role[] }
export interface NavGroup { label: string; items: NavItem[] }

/** 13개 기존 탭 + 계정 관리. auth: 로그인 필요 */
export const NAV_GROUPS: NavGroup[] = [
  { label: "운영", items: [
    { path: "/", label: "대시보드", en: "Dashboard", icon: LayoutDashboard },
    { path: "/prep", label: "D-DAY 준비", en: "D-DAY Prep", icon: Hourglass },
    { path: "/schedule", label: "일정표", en: "Schedule", icon: CalendarDays },
  ] },
  { label: "숙소 · 방문자", items: [
    { path: "/visitors", label: "방문자 명단", en: "Pilgrims", icon: Users, auth: true },
    { path: "/facilities", label: "성당시설", en: "Facilities", icon: Building2, auth: true },
    { path: "/homestays", label: "홈스테이 가정", en: "Homestays", icon: Home, auth: true },
  ] },
  { label: "봉사단", items: [
    { path: "/org", label: "조직도", en: "Organization", icon: Network, auth: true },
    { path: "/volunteers", label: "봉사자 명단", en: "Volunteers", icon: HandHeart, auth: true },
  ] },
  { label: "소통", items: [
    { path: "/notices", label: "공지사항", en: "Notices", icon: Megaphone },
    { path: "/posts", label: "게시판", en: "Board", icon: MessagesSquare, auth: true },
    { path: "/qna", label: "방문자 Q&A", en: "Pilgrim Q&A", icon: CircleHelp },
    { path: "/places", label: "추천 장소·지도", en: "Places & Map", icon: MapPin },
  ] },
  { label: "기도", items: [
    { path: "/gori", label: "고리기도 일정", en: "Prayer Chain", icon: Flower2 },
  ] },
  { label: "관리", items: [
    { path: "/admin/users", label: "계정 관리", en: "Accounts", icon: ShieldCheck, auth: true, roles: ["admin"] },
  ] },
];
export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
export const MOBILE_TABS = ["/", "/visitors", "/homestays", "/gori"];
