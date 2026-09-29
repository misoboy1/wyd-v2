// 고리기도 사진 — 썸네일(눌러서 크게) + 관리자 업로드·변경
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ImageOff, RefreshCw } from "lucide-react";
import type { Gori } from "@wyd/shared";
import { api, ApiError } from "@/lib/api";
import { errorMessage, tableKey } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { mdw, safePhoto } from "./common";

// 서버 허용 형식과 같음(uploads.controller OK_TYPES)
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
const OK_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
const MAX = 10 * 1024 * 1024;

/** 파일 검사 — 문제 있으면 안내 문구 */
function checkFile(f: File): string | null {
  // 일부 브라우저는 HEIC의 type을 비워 보냄 → 확장자로 보조 판정
  if (!(OK_TYPES.includes(f.type) || (!f.type && OK_EXT.test(f.name)))) return "jpg·png·webp·gif·heic 사진만 올릴 수 있습니다.";
  if (f.size > MAX) return "사진은 10MB 이하만 올릴 수 있습니다.";
  return null;
}

export function GoriPhotoCell({ row, canEdit }: { row: Gori; canEdit: boolean }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const src = safePhoto(row.photo);
  const failed = !!src && broken === src;

  const upload = async (f: File) => {
    const err = checkFile(f);
    if (err) {
      toast.error(err);
      return;
    }
    const fd = new FormData();
    fd.append("file", f);
    setBusy(true);
    try {
      const saved = await api.upload<Gori>(`/gori/${row.id}/photo?version=${row.version}`, fd);
      qc.setQueryData<Gori[]>(tableKey("gori"), (old) => old?.map((g) => (g.id === saved.id ? saved : g)));
      setBroken(null);
      toast.success(`${mdw(row.date)} 사진을 올렸습니다.`);
    } catch (e) {
      if (e instanceof ApiError && (e.code === "CONFLICT" || e.code === "NOTFOUND")) {
        void qc.invalidateQueries({ queryKey: tableKey("gori") });
        toast.error("다른 사용자가 먼저 수정했습니다. 새로 불러온 뒤 다시 올려 주세요.");
      } else toast.error("사진 업로드에 실패했습니다. (" + errorMessage(e) + ")");
    } finally {
      setBusy(false);
    }
  };

  const picker = canEdit && (
    <input
      ref={input}
      type="file"
      accept="image/*,.heic,.heif"
      className="hidden"
      aria-hidden
      tabIndex={-1}
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) void upload(f);
      }}
    />
  );

  return (
    <div className="flex items-center gap-2">
      {picker}
      {src ? (
        failed ? (
          <span
            className="inline-flex h-11 items-center gap-1 rounded-lg border border-dashed border-bad/50 bg-bad-soft px-2 text-[11.5px] text-bad"
            title="사진을 불러오지 못했습니다"
          >
            <ImageOff className="size-3.5" />
            불러오기 실패
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setZoom(true)}
            className="shrink-0 overflow-hidden rounded-lg border border-line focus-visible:ring-3 focus-visible:ring-[var(--ring)]"
            aria-label={`${mdw(row.date)} ${row.org} 사진 크게 보기`}
          >
            <img src={src} alt="" loading="lazy" className="size-11 object-cover" onError={() => setBroken(src)} />
          </button>
        )
      ) : (
        !canEdit && <span className="text-ink-3">—</span>
      )}
      {canEdit && (
        <Button
          size="sm"
          variant={src ? "ghost" : "secondary"}
          loading={busy}
          onClick={() => input.current?.click()}
          aria-label={`${mdw(row.date)} 사진 ${src ? "변경" : "업로드"}`}
        >
          {!busy && (src ? <RefreshCw /> : <Camera />)}
          {src ? "변경" : "업로드"}
        </Button>
      )}
      <Dialog
        open={zoom}
        onOpenChange={setZoom}
        size="lg"
        title={`${mdw(row.date)} · ${row.org}`}
        description={row.rep ? `대표: ${row.rep}` : undefined}
      >
        {src && !failed && (
          <img
            src={src}
            alt={`${row.org} 고리기도 사진`}
            className="mx-auto max-h-[70dvh] w-auto rounded-xl object-contain"
            onError={() => {
              setBroken(src);
              setZoom(false);
              toast.error("사진을 불러오지 못했습니다.");
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
