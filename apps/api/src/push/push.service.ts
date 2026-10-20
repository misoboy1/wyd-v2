// 웹 푸시 발송 — VAPID 서명, 구독 저장, 만료 구독 정리. 메시지 저장과 분리해 실패해도 수신함은 그대로
import { Injectable, Logger } from "@nestjs/common";
import webpush from "web-push";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { z } from "zod";
import type { pushSubscriptionSchema } from "@wyd/shared";
import { db } from "../db/client.js";
import { pushSubscriptions } from "../db/schema.js";
import { env } from "../common/env.js";
import type { Who } from "../messages/person.service.js";

/** 구독 주소로 허용하는 브라우저 푸시 서비스 — 임의 주소로 서버가 요청을 보내는 것(SSRF) 방지 */
const PUSH_HOSTS = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];
export const isPushEndpoint = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
};

export interface PushPayload {
  title: string;
  body: string;
  /** 알림을 누르면 열 앱 안 경로 */
  url: string;
  tag: string;
}

/** 1GB 서버·api 256MB — 동시 발송 수를 묶어 메모리·소켓 사용을 제한 */
const CONCURRENCY = 10;

@Injectable()
export class PushService {
  private readonly log = new Logger("Push");
  readonly publicKey: string | null = null;

  constructor() {
    let pub = env.VAPID_PUBLIC_KEY,
      priv = env.VAPID_PRIVATE_KEY;
    if ((!pub || !priv) && !env.isProd) {
      // 개발: 기동마다 임시 키 — 재시작하면 기존 구독은 무효(다시 켜면 됨)
      ({ publicKey: pub, privateKey: priv } = webpush.generateVAPIDKeys());
      this.log.log("VAPID 키가 없어 임시 키로 실행합니다(개발 전용).");
    }
    if (pub && priv) {
      webpush.setVapidDetails(env.VAPID_SUBJECT, pub, priv);
      this.publicKey = pub;
    } else this.log.warn("VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY가 없어 웹 푸시를 끕니다(수신함은 동작).");
  }

  get enabled() {
    return this.publicKey !== null;
  }

  /** 같은 기기(endpoint)를 다른 사람이 다시 등록하면 새 주인으로 바뀜 */
  async subscribe(who: Who, sub: z.infer<typeof pushSubscriptionSchema>) {
    const v = { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, kind: who.kind, refId: who.refId };
    await db
      .insert(pushSubscriptions)
      .values(v)
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { ...v, createdAt: sql`now()`, lastOkAt: null } });
  }

  /** 지운 행 수 — 이 기기가 다른 주인에게 묶여 있으면 0 */
  async unsubscribe(who: Who, endpoint: string) {
    const r = await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.kind, who.kind), eq(pushSubscriptions.refId, who.refId)))
      .returning({ id: pushSubscriptions.id });
    return r.length;
  }

  /** 개인 링크 폐기·재발급 — 그 사람의 기존 기기 알림도 끊음 */
  async removeOwner(kind: string, refIds: number[]) {
    if (refIds.length)
      await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.kind, kind), inArray(pushSubscriptions.refId, refIds)));
  }

  /** 백그라운드 발송 — 호출한 요청은 기다리지 않음. url은 받는 사람 종류별(계정은 /inbox, 개인 링크는 /me) */
  send(recipients: Who[], payload: (w: Who) => PushPayload) {
    if (!this.enabled || !recipients.length) return;
    void this.deliver(recipients, payload).catch((e: unknown) => this.log.error(`푸시 발송 실패: ${String(e)}`));
  }

  private async deliver(recipients: Who[], payload: (w: Who) => PushPayload) {
    const byKind = new Map<string, number[]>();
    for (const r of recipients) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.refId]);
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(or(...[...byKind].map(([k, ids]) => and(eq(pushSubscriptions.kind, k), inArray(pushSubscriptions.refId, ids)))));
    const ok: number[] = [],
      gone: number[] = [];
    let i = 0;
    const worker = async () => {
      while (i < subs.length) {
        const s = subs[i++];
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload({ kind: s.kind as Who["kind"], refId: s.refId })),
            { TTL: 24 * 3600, timeout: 10_000 },
          );
          ok.push(s.id);
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          // 404·410: 사용자가 알림을 끄거나 브라우저 데이터를 지움 → 구독 삭제
          if (code === 404 || code === 410) gone.push(s.id);
          else this.log.warn(`푸시 실패(${code ?? "network"}) id=${s.id}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, subs.length) }, worker));
    if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
    if (ok.length)
      await db
        .update(pushSubscriptions)
        .set({ lastOkAt: sql`now()` })
        .where(inArray(pushSubscriptions.id, ok));
  }
}
