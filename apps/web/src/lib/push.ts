// 웹 푸시 — 서비스 워커(/sw.js) 등록, 기기 구독·해지. 권한 요청은 반드시 버튼 클릭 안에서(iOS 요구사항)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";

export type PushState = "unsupported" | "in-app" | "ios-install" | "ios-old" | "denied" | "off" | "on" | "server-off";

const supported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
/** 홈 화면에 추가한 앱으로 열렸는지 */
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export type InApp = "kakao" | "naver" | "line" | "instagram" | "facebook" | "other";
/** 기기·브라우저 판별(UA) — 상태별 안내 문구·외부 브라우저 열기에 씀 */
export function detectEnv() {
  const ua = navigator.userAgent;
  const os = isIOS() ? "ios" : /Android/i.test(ua) ? "android" : "desktop";
  const inApp: InApp | null = /KAKAOTALK/i.test(ua)
    ? "kakao"
    : /NAVER\(inapp|Whale\/.*inapp/i.test(ua)
      ? "naver"
      : /\bLine\//i.test(ua)
        ? "line"
        : /Instagram/i.test(ua)
          ? "instagram"
          : /FBAN|FBAV|FB_IAB/i.test(ua)
            ? "facebook"
            : /DaumApps|everytimeApp|BAND\//i.test(ua) || (os === "android" && /; wv\)/.test(ua))
              ? "other"
              : null;
  // iPadOS 데스크톱 모드는 UA에 iOS 버전이 없음 → null(버전 검사 생략)
  const m = /(?:iPhone|iPad|iPod).*? OS (\d+)_(\d+)/.exec(ua);
  /** 주·부 버전을 major*100+minor로 (16.4 → 1604) — 소수로 합치면 16_10이 16.1이 되어 비교가 틀어짐 */
  const iosVersion = m ? Number(m[1]) * 100 + Number(m[2]) : null;
  const browser = /SamsungBrowser/i.test(ua)
    ? "samsung"
    : /Edg(?:e|iOS|A)?\//.test(ua)
      ? "edge"
      : /Firefox|FxiOS/.test(ua)
        ? "firefox"
        : /Chrome|CriOS/.test(ua)
          ? "chrome"
          : /Safari/.test(ua)
            ? "safari"
            : "other";
  return { os, inApp, iosVersion, browser } as const;
}

/** 이 앱 안 브라우저에서 기본 브라우저로 바로 열 수 있는지. 일반 WebView(other)는 intent:를 처리하지 않아 오류 화면이 남을 수 있고,
 * hash(/me#토큰)는 intent 주소에 실을 수 없으므로 안드로이드 intent는 그 외 경우만 */
export function canOpenExternal() {
  const { os, inApp } = detectEnv();
  return inApp === "kakao" || inApp === "line" || (os === "android" && inApp !== "other" && !location.hash);
}

/** 앱 안 브라우저에서 이 주소를 기본 브라우저로 다시 열기. 열 방법이 없으면 false(주소 복사로 대체) */
export function openExternal(): boolean {
  if (!canOpenExternal()) return false;
  const { inApp } = detectEnv();
  const href = location.href;
  if (inApp === "kakao") location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
  else if (inApp === "line") {
    const u = new URL(href);
    u.searchParams.set("openExternalBrowser", "1");
    location.href = u.href;
  } else {
    const fallback = encodeURIComponent(href);
    const scheme = location.protocol.slice(0, -1);
    location.href = `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
  }
  return true;
}

/** 앱 시작 시 한 번 — 알림을 누르면 열 화면 처리 등을 위해 항상 등록(푸시를 켜지 않아도 무해) */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* 사설 창·보안 컨텍스트 아님 등 — 푸시만 못 씀 */
    });
  });
}

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function current() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** 이 기기의 지금 알림 상태를 판정. 켜져 있으면 지금 신원(owner)으로 구독을 다시 묶음 */
async function probe(owner: string, as: object): Promise<PushState> {
  const env = detectEnv();
  // 앱 안 브라우저(카카오톡 등)는 API가 있어도 푸시가 오지 않음 → 먼저 판정
  if (env.inApp) return "in-app";
  if (env.os === "ios" && env.iosVersion !== null && env.iosVersion < 1604) return "ios-old";
  if (env.os === "ios" && !isStandalone()) return "ios-install";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const { key } = await api.get<{ key: string | null }>("/push/key");
  if (!key) return "server-off";
  const sub = await current();
  if (!sub || Notification.permission !== "granted") return "off";
  // 같은 기기를 다른 사람이 쓰게 됐을 수 있으므로 지금 신원으로 다시 묶음(서버가 endpoint 기준으로 주인 교체)
  if (owner) await api.post("/push/subscribe", { ...sub.toJSON(), ...as }).catch(() => {});
  return "on";
}

/** 이 기기의 알림 상태 + 켜기·끄기. owner: 신원(로그인 계정·개인 링크)이 바뀌면 다시 확인. asPerson: /me 화면(개인 링크로 구독) */
export function usePush(owner: string, asPerson?: boolean) {
  const as = useMemo(() => (asPerson ? { as: "person" } : {}), [asPerson]);
  const [state, setStateRaw] = useState<PushState | null>(null);
  const seenPerm = useRef<NotificationPermission | null>(null);
  // 마지막에 시작한 확인의 결과만 반영. 켜기·끄기가 시작되면 진행 중인 확인은 무효(seq 증가)
  const seq = useRef(0);
  // 켜기·끄기 진행 중 들어온 재확인 요청(권한 변경 이벤트 등)은 미뤘다가 끝난 뒤 한 번 — 구독 전 상태를 읽어 "off"로 덮지 않게
  const op = useRef(false);
  const again = useRef(false);
  const check = useCallback(async () => {
    const my = ++seq.current;
    if ("Notification" in window) seenPerm.current = Notification.permission;
    const next = await probe(owner, as).catch((): PushState => "unsupported");
    if (my === seq.current) setStateRaw(next);
  }, [owner, as]);
  const recheck = useCallback(async () => {
    if (op.current) {
      again.current = true;
      return;
    }
    await check();
  }, [check]);
  // 켜기·끄기 도중 신원(owner)이 바뀌어도 미뤄 둔 재확인은 최신 recheck로
  const recheckRef = useRef(recheck);
  useEffect(() => {
    recheckRef.current = recheck;
  }, [recheck]);
  const act = useCallback(async <T>(fn: () => Promise<T>) => {
    op.current = true;
    seq.current++;
    try {
      return await fn();
    } finally {
      op.current = false;
      if (again.current) {
        again.current = false;
        void recheckRef.current();
      }
    }
  }, []);
  useEffect(() => {
    void recheck();
    // 설정에서 차단을 풀고 돌아오면 자동으로 다시 확인(권한 변경 이벤트·탭 복귀)
    // 탭 복귀마다 서버를 부르지 않도록 권한이 실제로 바뀐 경우에만
    const onVisible = () => {
      if (document.visibilityState === "visible" && "Notification" in window && Notification.permission !== seenPerm.current)
        void recheck();
    };
    document.addEventListener("visibilitychange", onVisible);
    let perm: PermissionStatus | null = null;
    const onPerm = () => void recheck();
    let gone = false;
    navigator.permissions
      ?.query({ name: "notifications" })
      .then((p) => {
        if (gone) return;
        perm = p;
        p.addEventListener("change", onPerm);
      })
      .catch(() => {
        /* 지원하지 않는 브라우저 — 탭 복귀로만 확인 */
      });
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", onVisible);
      perm?.removeEventListener("change", onPerm);
    };
  }, [recheck]);

  const enable = useCallback(
    () =>
      act(async () => {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setStateRaw(perm === "denied" ? "denied" : "off");
          return false;
        }
        const { key } = await api.get<{ key: string | null }>("/push/key");
        if (!key) {
          setStateRaw("server-off");
          return false;
        }
        const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js"));
        await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        // 서버 키가 바뀌었으면(개발 서버 재시작 등) 옛 구독은 쓸 수 없으므로 새로 만듦
        const want = b64ToBytes(key);
        const have = sub?.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
        if (sub && (!have || have.length !== want.length || have.some((b, i) => b !== want[i]))) {
          await sub.unsubscribe();
          sub = null;
        }
        sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want });
        await api.post("/push/subscribe", { ...sub.toJSON(), ...as });
        setStateRaw("on");
        return true;
      }),
    [act, as],
  );

  const disable = useCallback(
    () =>
      act(async () => {
        const sub = await current();
        if (sub) {
          await api.post("/push/unsubscribe", { endpoint: sub.endpoint, ...as }).catch(() => {});
          await sub.unsubscribe();
        }
        setStateRaw("off");
      }),
    [act, as],
  );

  /** 서버를 거치지 않고 이 기기에 알림 하나를 띄워 권한·서비스 워커가 동작하는지 확인 */
  const test = useCallback(async (title: string, body: string) => {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      tag: "wyd-test",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      data: { url: location.pathname + location.hash }, // 누르면 지금 화면으로(/me#토큰 유지)
    });
  }, []);

  return { state, enable, disable, recheck, test };
}

/** 로그아웃·개인 링크 해제 시 — 공용 기기에서 이전 사람의 메시지 알림이 계속 뜨지 않게 이 기기 구독을 해지 */
export async function dropDevicePush(asPerson?: boolean) {
  if (!supported()) return;
  const sub = await current().catch(() => null);
  if (!sub) return;
  const r = await api
    .post<{ removed: number }>("/push/unsubscribe", { endpoint: sub.endpoint, ...(asPerson ? { as: "person" } : {}) })
    .catch(() => null);
  // 이 기기가 개인 링크(순례자·봉사자)에 묶여 있으면 그대로 둠
  if (r?.removed) await sub.unsubscribe().catch(() => false);
}
