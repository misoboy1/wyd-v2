// 메시지 대상 — 보내기 화면 후보 목록과 표시 이름. 후보 규칙은 서버 MessagesService.resolve와 같게(서버가 최종 판단)
import { useMemo } from "react";
import { NO_TEAM, TEAM_NAMES, teamInfo, type MessageTarget, type MsgKey } from "@wyd/shared";
import { useTable } from "@/lib/data";
import { useCan } from "@/lib/auth";
import { useDirectory } from "@/lib/messages";
import { useT } from "@/lib/i18n";

export interface Candidate {
  key: string;
  target: MessageTarget;
  label: string;
  /** 종류 배지 문구 키(inbox.kind.*) */
  kind: MsgKey;
  /** 검색용 보조 문구(번호·팀·그룹) */
  sub?: string;
  /** 검색어 없을 때 위에 보여 줄 빠른 선택 */
  quick?: boolean;
}

export const targetKey = (t: MessageTarget) => JSON.stringify(t);

/** 보내기 화면 후보 전체 + 대상 표시 이름 함수(보낸 목록에서도 사용) */
export function useTargets(enabled: boolean) {
  const { t, label } = useT();
  const { user, isAdmin } = useCan();
  const { rows: visitors } = useTable("visitors");
  const { rows: volunteers } = useTable("volunteers");
  const { rows: homestays } = useTable("homestays");
  const users = useDirectory(enabled);

  const nameOf = useMemo(() => {
    const u = new Map(users.map((x) => [x.id, x.name || x.username]));
    const v = new Map(visitors.map((x) => [x.id, `${x.name} (${x.pid})`]));
    const o = new Map(volunteers.map((x) => [x.id, x.name]));
    const h = new Map(homestays.map((x) => [x.id, x]));
    const unknown = (id: number) => t("inbox.target.unknown", { id });
    if (user) u.set(user.id, user.name || user.username);
    return (x: MessageTarget): string => {
      switch (x.k) {
        case "user":
          return u.get(x.id) ?? unknown(x.id);
        case "role":
          return t("inbox.target.role", { role: label("appRole", x.role) });
        case "team":
          return t("inbox.target.team", { team: x.team });
        case "homestay": {
          const r = h.get(x.id);
          return r ? t("inbox.target.homestay", { hid: r.hid, host: r.host }) : unknown(x.id);
        }
        case "group":
          return t("inbox.target.group", { gno: x.gno });
        case "visitor":
          return v.get(x.id) ?? unknown(x.id);
        case "volunteer":
          return o.get(x.id) ?? unknown(x.id);
        case "allVisitors":
          return t("inbox.target.allVisitors");
        case "allVolunteers":
          return t("inbox.target.allVolunteers");
      }
    };
  }, [users, visitors, volunteers, homestays, user, t, label]);

  const candidates = useMemo(() => {
    if (!user) return [];
    const out: Candidate[] = [];
    const push = (target: MessageTarget, kind: MsgKey, sub?: string, quick?: boolean) =>
      out.push({ key: targetKey(target), target, label: nameOf(target), kind, sub, quick });
    // 팀 미배정(매핑 안 되는 팀 이름) 계정은 팀 대상이 없음 — 서버 isSameTeam과 같은 기준
    const myTeam = user.role === "dept" && user.team ? teamInfo({ team: user.team }).team : null;
    const ownTeam = myTeam !== NO_TEAM ? myTeam : null;

    if (isAdmin) {
      push({ k: "allVisitors" }, "inbox.kind.all", undefined, true);
      push({ k: "allVolunteers" }, "inbox.kind.all", undefined, true);
      push({ k: "role", role: "host" }, "inbox.kind.role", undefined, true);
      push({ k: "role", role: "dept" }, "inbox.kind.role", undefined, true);
    }
    push({ k: "role", role: "admin" }, "inbox.kind.role", undefined, true);
    for (const team of isAdmin ? TEAM_NAMES : ownTeam ? [ownTeam] : []) push({ k: "team", team }, "inbox.kind.team", undefined, !isAdmin);
    for (const h of homestays)
      if (isAdmin || (user.role === "host" && h.id === user.homestayId))
        push({ k: "homestay", id: h.id }, "inbox.kind.homestay", `${h.hid} ${h.zone}`, !isAdmin);
    if (isAdmin)
      for (const gno of [...new Set(visitors.map((v) => v.gno).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ))
        push({ k: "group", gno }, "inbox.kind.group");
    for (const u of users) push({ k: "user", id: u.id }, "inbox.kind.user", `${u.username} ${label("appRole", u.role)} ${u.team}`);
    // 순례자: 관리자는 전원, 가정 계정은 자기 집 숙박자(서버가 이미 그만큼만 내려줌)
    if (isAdmin || user.role === "host")
      for (const v of visitors) push({ k: "visitor", id: v.id }, "inbox.kind.visitor", `${v.pid} ${v.gno} ${v.country}`);
    for (const v of volunteers)
      if (isAdmin || (ownTeam && teamInfo(v).team === ownTeam)) push({ k: "volunteer", id: v.id }, "inbox.kind.volunteer", v.team);
    return out;
  }, [user, isAdmin, homestays, visitors, volunteers, users, nameOf, label]);

  return { candidates, nameOf };
}
