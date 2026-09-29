// 고리기도 안내 + 예식서 전문(GORI_RITE) — 접었다 펴는 구획
import type { ReactNode } from "react";
import { BookOpen, ChevronDown, ScrollText } from "lucide-react";
import { GORI_RITE } from "@wyd/shared";

function Fold({
  icon,
  title,
  sub,
  children,
  defaultOpen,
}: {
  icon: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-line bg-surface shadow-soft">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 select-none [&::-webkit-details-marker]:hidden">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-ink [&_svg]:size-4">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold text-ink">{title}</span>
          {sub && <span className="block text-[12.5px] text-ink-3">{sub}</span>}
        </span>
        <ChevronDown className="size-4 text-ink-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line px-5 py-4">{children}</div>
    </details>
  );
}

const Step = ({ n, title, children }: { n: string; title: string; children: ReactNode }) => (
  <section className="relative pl-9">
    <span className="absolute top-0 left-0 flex size-6.5 items-center justify-center rounded-full bg-primary text-[12.5px] font-bold text-primary-ink">
      {n}
    </span>
    <h4 className="text-[14.5px] font-semibold text-ink">{title}</h4>
    <div className="mt-1.5 space-y-2 text-[13.5px] leading-relaxed text-ink-2">{children}</div>
  </section>
);
const Note = ({ children }: { children: ReactNode }) => <p className="text-[12.5px] text-ink-3">{children}</p>;
const Scripture = ({ children }: { children: ReactNode }) => (
  <blockquote className="rounded-xl border border-line bg-surface-2 px-4 py-3 font-serif text-[14px] leading-[1.9] whitespace-pre-line text-ink">
    {children}
  </blockquote>
);

/** 기도 순서·준비물 안내(기존 화면의 접이식 안내) */
export function GoriGuide() {
  return (
    <Fold icon={<BookOpen />} title="기도 순서·준비물 안내" sub="누르면 펼쳐집니다">
      <dl className="grid gap-x-4 gap-y-2.5 text-[13.5px] leading-relaxed sm:grid-cols-[7rem_1fr]">
        <dt className="font-semibold text-ink">기도 순서</dt>
        <dd className="text-ink-2">
          성호경 → 복음낭독(요한 16,25-33 "내가 세상을 이겼다") → 묵주기도 5단(각 단마다 WYD 지향 봉헌) → 성모찬송 → 2027 서울 세계청년대회
          공식기도문 → 성호경
        </dd>
        <dt className="font-semibold text-ink">기도 장소</dt>
        <dd className="text-ink-2">
          각 단체 회합실 및 교리실 · <b className="text-ink">시간</b>: 단체가 자유롭게 정함
        </dd>
        <dt className="font-semibold text-ink">기도 물품</dt>
        <dd className="text-ink-2">
          십자가·초(2)·촛대(2)·이콘·상본·제대보·기도 예식서·이콘 받침대(2) — 양업관 입구 &lt;WYD 고리기도&gt; 사물함 비치
        </dd>
        <dt className="font-semibold text-ink">개인 준비물</dt>
        <dd className="text-ink-2">묵주 (기도 후 성당 입구 봉헌함에 묵주알 봉헌)</dd>
      </dl>
      <p className="mt-3 text-[12.5px] text-ink-3">
        ※ 이콘 거치대는 아크릴 소재로 파손 위험이 있으니 조심히 다루어 주세요. 기도 모습을 사진으로 찍어 분과장에게 전달 바랍니다.
      </p>
    </Fold>
  );
}

/** 예식서 전문 */
export function GoriRite() {
  const R = GORI_RITE;
  return (
    <Fold icon={<ScrollText />} title="고리기도 예식서 전문" sub="2027 WYD 성공적 개최를 위한 묵주 고리기도 예식서">
      <article className="mx-auto max-w-2xl space-y-6">
        <Step n="1" title="기도 차림 및 유의사항">
          <ol className="list-decimal space-y-1.5 pl-5 marker:text-ink-3">
            {R.prep.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </Step>
        <Step n="2" title="시작 · 복음 낭독">
          <Note>성호경 → 복음 낭독</Note>
          <p className="font-semibold text-ink">{R.gospel.ref}</p>
          <Scripture>{R.gospel.text}</Scripture>
          <Note>✠ 주님의 말씀입니다. ◎ 그리스도님 찬미합니다.</Note>
        </Step>
        <Step n="3" title="묵주기도 5단 (각 단 지향)">
          <Note>사도신경 → 주님의 기도 → 성모송(3회) → 영광송 → 구원의 기도</Note>
          <ol className="space-y-2">
            {R.decades.map((t, i) => (
              <li key={i} className="rounded-xl border border-line px-3.5 py-2.5">
                <div className="flex gap-2.5">
                  <span className="shrink-0 font-bold text-primary tabular">{i + 1}단</span>
                  <span className="text-ink">{t}</span>
                </div>
                <div className="mt-1 pl-8 text-[12px] text-ink-3">주님의 기도 · 성모송(10회) · 영광송 · 구원의 기도</div>
              </li>
            ))}
          </ol>
          <Note>5단을 다 바친 후 &lt;성모 찬송&gt; 기도 (예식서 참조)</Note>
        </Step>
        <Step n="4" title="2027 서울 세계청년대회 공식기도문">
          <Scripture>{R.official}</Scripture>
          <Note>→ 성호경으로 마칩니다.</Note>
        </Step>
        <p className="border-t border-line pt-3 text-[12px] text-ink-3">
          ※ 사도신경·주님의 기도·성모송·영광송·구원의 기도·성모 찬송 전문은 준비된 인쇄 예식서를 참고하세요(양업관 입구 &lt;WYD 고리기도&gt;
          사물함 비치).
        </p>
      </article>
    </Fold>
  );
}
