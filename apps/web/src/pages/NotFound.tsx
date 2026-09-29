import { Link } from "react-router";
import { Compass, LayoutDashboard } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-soft">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-soft-ink"><Compass className="size-6" /></div>
      <div className="text-[13px] font-semibold tracking-widest text-ink-3">404</div>
      <h1 className="mt-1 text-[20px] font-bold text-ink">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">주소가 바뀌었거나 없는 화면입니다. 왼쪽 메뉴나 아래 버튼으로 이동하세요.<br />Page not found.</p>
      <Link to="/" className="mt-6 inline-flex h-9.5 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-ink shadow-soft hover:brightness-110">
        <LayoutDashboard className="size-4" />대시보드로 가기
      </Link>
    </div>
  );
}
