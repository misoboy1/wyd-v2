import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Zap } from "lucide-react";
import { AA_DEFAULT, planAutoAssign, type AutoAssignOptions } from "@wyd/shared";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/input";
import { Segmented, Stat, Progress } from "@/components/ui/misc";
import { confirm } from "@/components/ui/confirm";
import { assignStays, errorMessage, toastBulk } from "@/lib/data";
import { num } from "@/lib/utils";
import { useStayIndex } from "./useStayIndex";
import { ClearAssignDialog } from "./ClearAssignDialog";

// 창을 닫았다 열어도 마지막 옵션 유지
let savedOpt: AutoAssignOptions = { ...AA_DEFAULT };

/**
 * ⚡ 숙소 자동 배정 — 미리보기(공용 planAutoAssign) 확인 후 적용해야 저장.
 * 서버가 행마다 정원·성별 규칙을 다시 검사(assignStays).
 */
export function AutoAssignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { visitors, facilities, homestays } = useStayIndex();
  const [opt, setOptState] = useState<AutoAssignOptions>(savedOpt);
  const [busy, setBusy] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const setOpt = <K extends keyof AutoAssignOptions>(k: K, v: AutoAssignOptions[K]) => setOptState((o) => (savedOpt = { ...o, [k]: v }));

  const P = useMemo(
    () => (open ? planAutoAssign(visitors, facilities, homestays, opt) : null),
    [open, visitors, facilities, homestays, opt],
  );
  const nRoom = P ? P.plan.filter((x) => x.kind === "room").length : 0;
  const nHs = P ? P.plan.length - nRoom : 0;
  const singles = P ? P.slots.filter((s) => s.kind === "hs" && s.n0 + s.add.length === 1).length : 0;
  const skipTxt = P
    ? [
        P.skip.moved ? `(번호 없는 공간에 있던 ${P.skip.moved}명은 R교리실·홈스테이로 재배정 대상)` : "",
        P.skip.orphanIncluded ? `(연결 끊김 ${P.skip.orphanIncluded}명은 대상에 포함)` : "",
        P.skip.noSex ? `성별 미입력 ${P.skip.noSex}명` : "",
        P.skip.waiting ? `상태 '대기' ${P.skip.waiting}명` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const apply = async () => {
    if (!P || !P.plan.length) return;
    if (!(await confirm({ title: "자동 배정 적용", body: `${num(P.plan.length)}명의 숙소 배정을 저장할까요?`, confirmText: "적용" })))
      return;
    const byId = new Map(visitors.map((v) => [v.id, v]));
    const changes = P.plan.flatMap((x) => {
      const v = byId.get(x.visitorId);
      return v
        ? [
            {
              id: v.id,
              version: v.version,
              facilityId: x.kind === "room" ? x.targetId : null,
              homestayId: x.kind === "hs" ? x.targetId : null,
            },
          ]
        : [];
    });
    setBusy(`0 / ${changes.length}`);
    try {
      const res = await assignStays(qc, changes, (d, n) => setBusy(`${d} / ${n}`));
      toastBulk("자동 배정", res);
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const unplacedSex = P ? [...new Set(P.unplaced.map((v) => v.sex))].join("·") : "";
  const progress = busy ? busy.split(" / ").map(Number) : null;

  return (
    <>
      <Dialog
        open={open && !clearOpen}
        onOpenChange={(o) => !busy && onOpenChange(o)}
        size="lg"
        title={
          <span className="inline-flex items-center gap-2">
            <Zap className="size-4.5 text-gold" />
            숙소 자동 배정
          </span>
        }
        description={
          <>
            미배정 방문자를 그룹(G번호)·성별 단위로 묶어 교리실·홈스테이에 채웁니다. 이미 배정된 방문자는 바꾸지 않습니다. 아래 미리보기를
            확인한 뒤 <b className="text-ink-2">적용</b>을 눌러야 저장됩니다.
          </>
        }
        footer={
          <>
            <Button variant="danger-ghost" className="mr-auto" disabled={!!busy} onClick={() => setClearOpen(true)}>
              배정 해제…
            </Button>
            {busy && <span className="text-[13px] text-ink-3 tabular">저장 중 {busy}</span>}
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={!!busy}>
              닫기
            </Button>
            <Button variant="primary" loading={!!busy} disabled={!P?.plan.length} onClick={() => void apply()}>
              적용 ({num(P?.plan.length ?? 0)}명 배정)
            </Button>
          </>
        }
      >
        {P && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-ink-3">우선 숙소</span>
              <Segmented
                value={opt.prefer}
                onChange={(v) => setOpt("prefer", v)}
                options={[
                  { value: "hs", label: "홈스테이 먼저" },
                  { value: "room", label: "교리실 먼저" },
                ]}
              />
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              <Checkbox checked={opt.rOnly} onChange={(v) => setOpt("rOnly", v)} label="R번호 교리실만 사용(만남의방 등 제외·재배정)" />
              <Checkbox checked={opt.lang} onChange={(v) => setOpt("lang", v)} label="홈스테이 언어 일치 우선" />
              <Checkbox checked={opt.confirmedOnly} onChange={(v) => setOpt("confirmedOnly", v)} label="확정·입실 가정만 사용" />
              <Checkbox checked={opt.includeWaiting} onChange={(v) => setOpt("includeWaiting", v)} label="상태 '대기' 방문자도 포함" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="대상(미배정)" value={num(P.targets)} />
              <Stat label="교리실 배정" value={num(nRoom)} tone="primary" />
              <Stat label="홈스테이 배정" value={num(nHs)} tone="warn" />
              <Stat label="자리 부족" value={num(P.unplaced.length)} tone={P.unplaced.length ? "bad" : undefined} />
            </div>
            {progress && <Progress value={progress[0]} max={progress[1] || 1} />}
            <div className="space-y-1.5 text-[12.5px]">
              {skipTxt && <Note tone="warn">제외: {skipTxt} — 성별·상태를 입력/변경하면 다음 실행 때 포함됩니다.</Note>}
              {singles > 0 && (
                <Note tone="warn">
                  홈스테이 1인 단독 배정 {singles}곳 — 인원 구성상 불가피한 경우입니다. 필요하면 적용 후 방문자 편집에서 조정하세요.
                </Note>
              )}
              {P.unplaced.length > 0 && (
                <Note tone="bad">
                  남는 {P.unplaced.length}명({unplacedSex})은 조건에 맞는 빈자리가 없습니다. 홈스테이 추가 모집 또는 수용 인원을 확인하세요.
                </Note>
              )}
            </div>
            <div>
              <div className="mb-1.5 text-[13px] font-semibold text-ink">
                배정 미리보기 · {P.slots.length}곳{P.slots.length > 300 && " (앞 300곳 표시)"}
              </div>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-line">
                {P.slots.length ? (
                  P.slots.slice(0, 300).map((s) => {
                    const gs = [...new Set(s.add.map((v) => v.gno || "개별"))].join(", ");
                    const sx = s.add[0]?.sex || "";
                    return (
                      <div
                        key={s.kind + s.id}
                        className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-[13px] last:border-b-0"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Badge tone={s.kind === "room" ? "blue" : "amber"}>{s.kind === "room" ? "교리실" : "홈"}</Badge>
                          <b className="truncate text-ink">{s.label}</b>
                          <span className="truncate text-[12px] text-ink-3">{gs}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap tabular">
                          {s.n0 > 0 && <span className="text-[12px] text-ink-3">기존 {s.n0}</span>}+{s.add.length}명
                          {sx && <Badge tone={sx === "남" ? "blue" : "amber"}>{sx}</Badge>}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-6 text-center text-[13px] text-ink-3">배정할 대상이 없거나 빈자리가 없습니다.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </Dialog>
      <ClearAssignDialog
        open={open && clearOpen}
        onOpenChange={(o) => {
          if (!o) {
            setClearOpen(false);
            onOpenChange(false);
          }
        }}
        onBack={() => setClearOpen(false)}
      />
    </>
  );
}

function Note({ tone, children }: { tone: "warn" | "bad"; children: ReactNode }) {
  return (
    <div
      className={
        tone === "bad"
          ? "flex gap-1.5 rounded-lg bg-bad-soft px-3 py-2 text-bad"
          : "flex gap-1.5 rounded-lg bg-warn-soft px-3 py-2 text-warn"
      }
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
