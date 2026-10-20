// 웹 푸시 — 서비스 워커(/sw.js) 등록, 기기 구독·해지. 권한 요청은 반드시 버튼 클릭 안에서(iOS 요구사항)
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";

export type PushState = "unsupported" | "ios-install" | "denied" | "off" | "on" | "server-off";

const supported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
/** 홈 화면에 추가한 앱으로 열렸는지 */
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

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

/** 이 기기의 알림 상태 + 켜기·끄기. owner: 신원(로그인 계정·개인 링크)이 바뀌면 다시 확인. asPerson: /me 화면(개인 링크로 구독) */
export function usePush(owner: string, asPerson?: boolean) {
  const as = useMemo(() => (asPerson ? { as: "person" } : {}), [asPerson]);
  const [state, setState] = useState<PushState | null>(null);
  const check = useCallback(async () => {
    if (isIOS() && !isStandalone()) return setState("ios-install");
    if (!supported()) return setState("unsupported");
    if (Notification.permission === "denied") return setState("denied");
    const { key } = await api.get<{ key: string | null }>("/push/key");
    if (!key) return setState("server-off");
    const sub = await current();
    if (sub && Notification.permission === "granted") {
      // 같은 기기를 다른 사람이 쓰게 됐을 수 있으므로 지금 신원으로 다시 묶음(서버가 endpoint 기준으로 주인 교체)
      if (owner) await api.post("/push/subscribe", { ...sub.toJSON(), ...as }).catch(() => {});
      setState("on");
    } else setState("off");
  }, [owner, as]);
  useEffect(() => {
    void check().catch(() => setState("unsupported"));
  }, [check]);

  const enable = useCallback(async () => {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setState(perm === "denied" ? "denied" : "off");
      return false;
    }
    const { key } = await api.get<{ key: string | null }>("/push/key");
    if (!key) {
      setState("server-off");
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
    setState("on");
    return true;
  }, [as]);

  const disable = useCallback(async () => {
    const sub = await current();
    if (sub) {
      await api.post("/push/unsubscribe", { endpoint: sub.endpoint, ...as }).catch(() => {});
      await sub.unsubscribe();
    }
    setState("off");
  }, [as]);

  return { state, enable, disable };
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
