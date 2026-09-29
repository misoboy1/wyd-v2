// API 클라이언트 — 쿠키 인증(httpOnly), 쓰기 요청 X-WYD 헤더(CSRF), 401 시 토큰 1회 갱신 후 재시도
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public detail?: any) { super(message); }
}

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", headers: { "x-wyd": "1" }, credentials: "same-origin" })
    .then((r) => r.ok).catch(() => false).finally(() => { setTimeout(() => (refreshing = null), 0); });
  return refreshing;
}
/** 세션 만료 시 호출(로그인 화면 전환 등) — auth.tsx에서 등록 */
let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: () => void) => { onSessionExpired = fn; };

export async function request<T = any>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = { "ngrok-skip-browser-warning": "1" };
  if (method !== "GET") headers["x-wyd"] = "1";
  if (body !== undefined && !isForm) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch("/api" + path, {
      method, headers, credentials: "same-origin",
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요.");
  }
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refresh()) return request<T>(method, path, body, false);
    onSessionExpired?.();
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const code = (data && data.error) || (res.status === 409 ? "CONFLICT" : "HTTP_" + res.status);
    const msg = (data && typeof data.message === "string" && data.message) || (res.status >= 500 ? "서버 오류가 발생했습니다. 잠시 후 다시 시도하세요." : "요청을 처리하지 못했습니다.");
    throw new ApiError(res.status, code, msg, data?.detail);
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>("GET", p),
  post: <T = any>(p: string, b?: unknown) => request<T>("POST", p, b ?? {}),
  patch: <T = any>(p: string, b: unknown) => request<T>("PATCH", p, b),
  del: <T = any>(p: string) => request<T>("DELETE", p),
  upload: <T = any>(p: string, fd: FormData) => request<T>("POST", p, fd),
};
