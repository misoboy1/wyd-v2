import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TableName, User } from "@wyd/shared";
import { teamInfo, VOLUNTEER_VIEW_ROLES } from "@wyd/shared";
import { api, setSessionExpiredHandler } from "./api";
import { tt } from "./i18n";

type AuthUser = Pick<User, "id" | "username" | "name" | "role" | "team" | "homestayId">;
interface AuthCtx {
  user: AuthUser | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** 로그인 창 열기(보호된 화면 접근·세션 만료 시) */
  loginOpen: boolean;
  setLoginOpen: (v: boolean) => void;
}
const Ctx = createContext<AuthCtx | null>(null);

/** 로그인해야 볼 수 있는 표(서버 REGISTRY.read === "auth"와 동일) */
export const AUTH_TABLES: TableName[] = ["facilities", "homestays", "visitors", "volunteers", "posts"];

/** 사용자 전환: 표는 첫 일괄 로딩(/api/data)이 새로 채우므로 표별 재요청은 하지 않음 */
function refreshForUser(qc: QueryClient) {
  void qc.cancelQueries({ queryKey: ["boot"] }); // 진행 중인 이전 사용자 응답이 캐시에 쓰지 않게
  qc.removeQueries({ queryKey: ["boot"] });
  void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "t" }, { cancelRefetch: false });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    api
      .get<{ user: AuthUser | null }>("/auth/me")
      .then(async (r) => {
        if (r.user) return setUser(r.user);
        // access 만료 상태일 수 있으니 refresh 1회 시도
        try {
          const x = await api.post<{ user: AuthUser }>("/auth/refresh");
          setUser(x.user);
        } catch {
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser((u) => {
        if (u) {
          toast.warning(tt("shell.loginDlg.sessionExpired"));
          setLoginOpen(true);
        }
        return null;
      });
    });
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const r = await api.post<{ user: AuthUser }>("/auth/login", { username, password });
      refreshForUser(qc);
      setUser(r.user);
    },
    [qc],
  );
  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    // 표 캐시는 모두 지움 — 공개 표도 로그인 사용자에겐 마스킹 전 값(연락처)이 있으므로. 첫 일괄 로딩이 다시 채움
    qc.removeQueries({ queryKey: ["t"] });
    refreshForUser(qc);
    setUser(null);
  }, [qc]);

  const v = useMemo(() => ({ user, ready, login, logout, loginOpen, setLoginOpen }), [user, ready, login, logout, loginOpen]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AuthProvider 필요");
  return c;
}

/** 권한 확인 — 서버 registry.canWrite와 같은 규칙(서버가 최종 판단) */
export function useCan() {
  const { user } = useAuth();
  return useMemo(
    () => ({
      user,
      isAdmin: user?.role === "admin",
      loggedIn: !!user,
      canRead: (t: TableName) =>
        (!AUTH_TABLES.includes(t) || !!user) && (t !== "volunteers" || (!!user && VOLUNTEER_VIEW_ROLES.includes(user.role))),
      /** row: 대상 행(수정·삭제) 또는 새 값(추가) */
      canWrite: (t: TableName, row?: Record<string, any> | null) => {
        if (!user) return false;
        if (user.role === "admin") return true;
        if (t === "posts") return !row || !row.id || row.authorId === user.id;
        if (t === "volunteers" && user.role === "dept")
          return !!user.team && (!row || teamInfo(row as any).team === teamInfo({ team: user.team } as any).team);
        return false;
      },
    }),
    [user],
  );
}
