// 고리기도 안내 + 예식서 전문(GORI_RITE) — 접었다 펴는 구획
import type { ReactNode } from "react";
import { BookOpen, ChevronDown, ScrollText } from "lucide-react";
import { GORI_RITE } from "@wyd/shared";
import { useT } from "@/lib/i18n";

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
  const { t } = useT();
  return (
    <Fold icon={<BookOpen />} title={t("gori.guide.title")} sub={t("gori.guide.sub")}>
      <dl className="grid gap-x-4 gap-y-2.5 text-[13.5px] leading-relaxed sm:grid-cols-[7rem_1fr]">
        <dt className="font-semibold text-ink">{t("gori.guide.order")}</dt>
        <dd className="text-ink-2">{t("gori.guide.orderText")}</dd>
        <dt className="font-semibold text-ink">{t("gori.guide.place")}</dt>
        <dd className="text-ink-2">
          {t("gori.guide.placeText")} · <b className="text-ink">{t("gori.guide.time")}</b>: {t("gori.guide.timeText")}
        </dd>
        <dt className="font-semibold text-ink">{t("gori.guide.items")}</dt>
        <dd className="text-ink-2">{t("gori.guide.itemsText")}</dd>
        <dt className="font-semibold text-ink">{t("gori.guide.personal")}</dt>
        <dd className="text-ink-2">{t("gori.guide.personalText")}</dd>
      </dl>
      <p className="mt-3 text-[12.5px] text-ink-3">{t("gori.guide.note")}</p>
    </Fold>
  );
}

/** 예식서 전문 */
export function GoriRite() {
  const R = GORI_RITE;
  const { t } = useT();
  const contentNote = t("gori.rite.contentNote");
  return (
    <Fold icon={<ScrollText />} title={t("gori.rite.title")} sub={t("gori.rite.sub")}>
      <article className="mx-auto max-w-2xl space-y-6">
        {/* 예식서 본문(GORI_RITE)은 한국어 원문 그대로 — 다른 언어에서는 안내 문구 표시 */}
        {contentNote && <Note>{contentNote}</Note>}
        <Step n="1" title={t("gori.rite.step1")}>
          <ol className="list-decimal space-y-1.5 pl-5 marker:text-ink-3">
            {R.prep.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </Step>
        <Step n="2" title={t("gori.rite.step2")}>
          <Note>{t("gori.rite.step2Note")}</Note>
          <p className="font-semibold text-ink">{R.gospel.ref}</p>
          <Scripture>{R.gospel.text}</Scripture>
          <Note>{t("gori.rite.gospelResp")}</Note>
        </Step>
        <Step n="3" title={t("gori.rite.step3")}>
          <Note>{t("gori.rite.step3Note")}</Note>
          <ol className="space-y-2">
            {R.decades.map((intent, i) => (
              <li key={i} className="rounded-xl border border-line px-3.5 py-2.5">
                <div className="flex gap-2.5">
                  <span className="shrink-0 font-bold text-primary tabular">{t("gori.rite.decade", { n: i + 1 })}</span>
                  <span className="text-ink">{intent}</span>
                </div>
                <div className="mt-1 pl-8 text-[12px] text-ink-3">{t("gori.rite.decadePrayers")}</div>
              </li>
            ))}
          </ol>
          <Note>{t("gori.rite.afterDecades")}</Note>
        </Step>
        <Step n="4" title={t("gori.rite.step4")}>
          <Scripture>{R.official}</Scripture>
          <Note>{t("gori.rite.step4Note")}</Note>
        </Step>
        <p className="border-t border-line pt-3 text-[12px] text-ink-3">{t("gori.rite.footnote")}</p>
      </article>
    </Fold>
  );
}
