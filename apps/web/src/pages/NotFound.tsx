import { Link } from "react-router";
import { Compass, LayoutDashboard } from "lucide-react";
import { useT } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useT();
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-soft">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-soft-ink">
        <Compass className="size-6" />
      </div>
      <div className="text-[13px] font-semibold tracking-widest text-ink-3">404</div>
      <h1 className="mt-1 text-[20px] font-bold text-ink">{t("shell.notFound.title")}</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{t("shell.notFound.body")}</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-9.5 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-ink shadow-soft hover:brightness-110"
      >
        <LayoutDashboard className="size-4" />
        {t("shell.notFound.home")}
      </Link>
    </div>
  );
}
