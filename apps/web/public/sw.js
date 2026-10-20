// 서비스 워커 — 웹 푸시 알림 표시·클릭 처리만. 오프라인 캐시는 하지 않음(ETag 재검증 흐름 유지)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    /* 형식이 다른 푸시 — 기본 문구로 */
  }
  e.waitUntil(
    self.registration.showNotification(d.title || "WYD 2027", {
      body: d.body || "",
      tag: d.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      data: { url: typeof d.url === "string" && d.url.startsWith("/") ? d.url : "/" },
    }),
  );
});

// 알림을 누르면 이미 열린 창을 앞으로 가져와 해당 화면으로, 없으면 새 창
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const win = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (win) return win.focus().then((w) => (w && "navigate" in w ? w.navigate(url) : w));
      return self.clients.openWindow(url);
    }),
  );
});
