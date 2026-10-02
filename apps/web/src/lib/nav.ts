import {
  LayoutDashboard,
  Hourglass,
  CalendarDays,
  Users,
  Building2,
  Home,
  Network,
  HandHeart,
  Megaphone,
  MessagesSquare,
  CircleHelp,
  MapPin,
  Flower2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { VOLUNTEER_VIEW_ROLES, type NavKey, type Role } from "@wyd/shared";

export interface NavItem {
  path: string;
  /** 메뉴 라벨 메시지 키(nav.*) */
  label: NavKey;
  icon: LucideIcon;
  auth?: boolean;
  roles?: readonly Role[];
}
export interface NavGroup {
  label: NavKey;
  items: NavItem[];
}

/** 13개 기존 탭 + 계정 관리. auth: 로그인 필요 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "nav.group.ops",
    items: [
      { path: "/", label: "nav.dash", icon: LayoutDashboard },
      { path: "/prep", label: "nav.prep", icon: Hourglass },
      { path: "/schedule", label: "nav.schedule", icon: CalendarDays },
    ],
  },
  {
    label: "nav.group.stay",
    items: [
      { path: "/visitors", label: "nav.visitors", icon: Users, auth: true },
      { path: "/facilities", label: "nav.facilities", icon: Building2, auth: true },
      { path: "/homestays", label: "nav.homestays", icon: Home, auth: true },
    ],
  },
  {
    label: "nav.group.vol",
    items: [
      { path: "/org", label: "nav.org", icon: Network, auth: true, roles: VOLUNTEER_VIEW_ROLES },
      { path: "/volunteers", label: "nav.volunteers", icon: HandHeart, auth: true, roles: VOLUNTEER_VIEW_ROLES },
    ],
  },
  {
    label: "nav.group.comm",
    items: [
      { path: "/notices", label: "nav.notices", icon: Megaphone },
      { path: "/posts", label: "nav.posts", icon: MessagesSquare, auth: true },
      { path: "/qna", label: "nav.qna", icon: CircleHelp },
      { path: "/places", label: "nav.places", icon: MapPin },
    ],
  },
  { label: "nav.group.prayer", items: [{ path: "/gori", label: "nav.gori", icon: Flower2 }] },
  { label: "nav.group.admin", items: [{ path: "/admin/users", label: "nav.users", icon: ShieldCheck, auth: true, roles: ["admin"] }] },
];
export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
export const MOBILE_TABS = ["/", "/visitors", "/homestays", "/gori"];
