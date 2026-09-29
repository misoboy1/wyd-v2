// 메모리 기반 슬라이딩 윈도 제한기 — 키(계정·IP)별로 따로 센다(기존 전역 PIN 잠금 문제 해결)
import { toStr } from "@wyd/shared";
export class Limiter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {
    setInterval(() => this.sweep(), windowMs).unref();
  }
  /** 남은 대기 시간(ms). 0이면 허용 */
  retryAfter(key: string): number {
    const now = Date.now(),
      a = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    this.hits.set(key, a);
    return a.length >= this.max ? this.windowMs - (now - a[0]) : 0;
  }
  /** 창 안의 기록 수 */
  count(key: string): number {
    const now = Date.now();
    return (this.hits.get(key) || []).filter((t) => now - t < this.windowMs).length;
  }
  hit(key: string) {
    const a = this.hits.get(key) || [];
    a.push(Date.now());
    // max 이상은 판정에 쓰이지 않음 — 대량 요청에도 키당 메모리 상한
    if (a.length > this.max) a.splice(0, a.length - this.max);
    this.hits.set(key, a);
  }
  /** 마지막 기록 하나 취소(미리 센 시도가 성공했을 때) */
  undo(key: string) {
    this.hits.get(key)?.pop();
  }
  reset(key: string) {
    this.hits.delete(key);
  }
  private sweep() {
    const now = Date.now();
    for (const [k, a] of this.hits) if (!a.some((t) => now - t < this.windowMs)) this.hits.delete(k);
  }
}
export function clientIp(req: { headers: Record<string, unknown>; ip: string }): string {
  // nginx가 X-Real-IP 설정(ngrok → nginx → api). trustProxy로 req.ip도 보정됨
  return toStr(req.headers["x-real-ip"]) || req.ip || "unknown";
}
