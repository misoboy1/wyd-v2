// WYD 10억단 묵주기도 봉헌 현황 수집 — 기존 Code.gs dailyWydStatusSync / fetchChurchRank 이식
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { wydStatus } from "../db/schema.js";
import { env } from "../common/env.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const n = (s: string | undefined) => (s ? Number(s.replace(/,/g, "").trim()) || null : null);

export function parseStatusHtml(html: string) {
  const pick = (re: RegExp) => {
    const m = html.match(re);
    return m ? m[1] : undefined;
  };
  let today = n(pick(/오늘\s*봉헌<\/h6>[\s\S]{0,120}?>([\d,]+)<small/));
  const progress = pick(/진행률<\/span>[\s\S]{0,150}?>([\d.]+)<small/) ?? null;
  const churches = n(pick(/참여본당<\/h6>[\s\S]{0,120}?>([\d,]+)<small/));
  const orgs = n(pick(/참여기관\/?단체<\/h6>[\s\S]{0,120}?>([\d,]+)<small/));
  // "전체 봉헌" 카드는 JS 애니메이션이라 원문에 값이 없음 → 일자별 누적표의 Today 행에서 추출
  const row = html.match(
    /(\d{4}-\d{2}-\d{2})[\s\S]{0,350}?Today[\s\S]{0,100}?<td[^>]*>([\d,]+)\s*단<\/td>[\s\S]{0,150}?<td[^>]*>([\d,]+)\s*단<\/td>/,
  );
  let total = row ? n(row[3]) : null;
  if (today == null && row) today = n(row[2]);
  if (total == null) total = n(pick(/전체\s*봉헌<\/h6>[\s\S]{0,150}?>([\d,]+)<small/));
  return { today, total, progress, churches, orgs };
}

@Injectable()
export class WydService implements OnModuleInit {
  private log = new Logger("WydService");

  onModuleInit() {
    if (!env.WYD_SYNC_ENABLED) return;
    // 매일 06:10(KST) 1회 + 기동 1분 후 오늘 데이터가 없으면 1회
    const schedule = () => {
      const now = new Date(),
        kst = new Date(now.toLocaleString("en-US", { timeZone: env.TZ }));
      const next = new Date(kst);
      next.setHours(6, 10, 0, 0);
      if (next <= kst) next.setDate(next.getDate() + 1);
      setTimeout(() => {
        void this.sync().finally(schedule);
      }, next.getTime() - kst.getTime()).unref();
    };
    schedule();
    setTimeout(() => {
      void this.syncIfMissing();
    }, 60_000).unref();
  }

  async latest() {
    const [r] = await db.select().from(wydStatus).orderBy(desc(wydStatus.date), desc(wydStatus.id)).limit(1);
    return r ?? null;
  }

  private todayKst() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: env.TZ }).format(new Date());
  }

  async syncIfMissing() {
    const l = await this.latest().catch(() => null);
    if (!l || l.date !== this.todayKst()) await this.sync();
  }

  async sync() {
    try {
      const res = await fetch("https://wyd.catholic.or.kr/status.asp", {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(20_000),
      });
      const s = parseStatusHtml(await res.text());
      const churchTotal = await this.fetchChurch("중계양업");
      await db.insert(wydStatus).values({ date: this.todayKst(), ...s, churchTotal });
      this.log.log(`WYD 현황 동기화: 누적 ${s.total ?? "?"} / 중계양업 ${churchTotal ?? "?"}`);
    } catch (e) {
      this.log.warn(`WYD 현황 동기화 실패: ${(e as Error).message}`);
    }
  }

  /** 본당 검색 API에서 누적 단수(순위는 검색 결과 내 순번이라 사용 안 함) */
  async fetchChurch(name: string): Promise<number | null> {
    try {
      const url = "https://wyd.catholic.or.kr/api/church_list.asp?ot=&keyword=" + encodeURIComponent(name) + "&page=1";
      const res = await fetch(url, {
        headers: { Referer: "https://wyd.catholic.or.kr/church.asp", "X-Requested-With": "XMLHttpRequest", "User-Agent": UA },
        signal: AbortSignal.timeout(15_000),
      });
      const m = (await res.text()).match(new RegExp("<strong>" + name + "<\\/strong>[\\s\\S]{0,100}?>([\\d,]+)\\s*단"));
      return m ? n(m[1]) : null;
    } catch {
      return null;
    }
  }
}
