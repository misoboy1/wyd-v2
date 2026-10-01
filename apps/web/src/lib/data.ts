// 데이터 계층 — 표별 캐시(React Query) + 낙관적 저장 + SSE 실시간 반영 + 충돌 처리
import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TABLE_NAMES, translateDynamic, type Dataset, type TableName } from "@wyd/shared";
import { api, ApiError } from "./api";
import { useAuth, useCan, AUTH_TABLES } from "./auth";
import { getLocale, tt } from "./i18n";

/** 서버·검증 메시지 키를 현재 언어로(키가 아니면 그대로) */
const tdNow = (k: string) => translateDynamic(getLocale(), k);

export type RowOf<T extends TableName> = Dataset[T][number];
export const tableKey = (t: TableName) => ["t", t] as const;

/** 표 하나 읽기. 권한 없으면 빈 배열 */
export function useTable<T extends TableName>(t: T) {
  const { canRead } = useCan();
  const { ready } = useAuth();
  const enabled = ready && canRead(t);
  const q = useQuery({
    queryKey: tableKey(t),
    queryFn: () => api.get<RowOf<T>[]>("/t/" + t),
    enabled,
    staleTime: Infinity, // 변경은 SSE로 무효화
  });
  const rows = useMemo(() => (enabled ? (q.data ?? []) : []), [enabled, q.data]);
  return { rows, isLoading: enabled && q.isLoading, error: q.error as ApiError | null, enabled };
}

/** 첫 화면: /api/data 한 번으로 모든 표를 받아 캐시에 채움(요청 수 절감 — ngrok 경유 시 체감 속도 ↑) */
export function useBootstrapData() {
  const qc = useQueryClient();
  const { user, ready } = useAuth();
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    api
      .get<Partial<Dataset>>("/data")
      .then((d) => {
        if (!alive) return;
        for (const t of TABLE_NAMES) if (d[t]) qc.setQueryData(tableKey(t), d[t]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [qc, ready, user?.id]);
}

/** SSE 구독: 다른 사용자가 바꾼 표만 다시 불러옴. 재연결 시 전체 새로고침(놓친 이벤트 보정) */
export function useLiveUpdates() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const pending = useRef(new Set<string>());
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    let es: EventSource | null = null,
      closed = false,
      hadError = false;
    const flush = () => {
      pending.current.forEach((t) => void qc.invalidateQueries({ queryKey: ["t", t] }));
      pending.current.clear();
    };
    const connect = () => {
      es = new EventSource("/api/events");
      es.addEventListener("change", (ev) => {
        try {
          const e = JSON.parse(ev.data) as { tables: string[] };
          e.tables.forEach((t) => pending.current.add(t));
          clearTimeout(timer.current);
          timer.current = window.setTimeout(flush, 250);
        } catch {
          /* 무시 */
        }
      });
      es.onopen = () => {
        if (hadError) {
          hadError = false;
          void qc.invalidateQueries({ queryKey: ["t"] });
        }
      };
      es.onerror = () => {
        hadError = true;
        if (es?.readyState === EventSource.CLOSED && !closed) setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      closed = true;
      es?.close();
      clearTimeout(timer.current);
    };
  }, [qc, user?.id]);
}

// ── 충돌 안내(다른 사용자가 먼저 수정) ─────────────────────────────
export interface ConflictInfo {
  table: TableName;
  mine: Record<string, any>;
  current: Record<string, any>;
  retry: (merged: Record<string, any>) => Promise<unknown>;
}
type Listener = (c: ConflictInfo | null) => void;
const conflictListeners = new Set<Listener>();
export const conflictBus = {
  emit: (c: ConflictInfo | null) => conflictListeners.forEach((l) => l(c)),
  on: (l: Listener) => {
    conflictListeners.add(l);
    return () => {
      conflictListeners.delete(l);
    };
  },
};

function upsertInCache(qc: QueryClient, t: TableName, row: any) {
  qc.setQueryData<any[]>(tableKey(t), (old) => {
    if (!old) return old;
    const i = old.findIndex((r) => r.id === row.id);
    if (i < 0) return [...old, row];
    const next = old.slice();
    next[i] = row;
    return next;
  });
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return (e as Error)?.message || tt("shell.data.unknownError");
}

/**
 * 저장 훅. id 있으면 수정(PATCH, version 포함), 없으면 추가(POST).
 * 수정은 화면에 먼저 반영(낙관적) → 실패 시 원래 값으로 복구. 충돌이면 비교 창 표시.
 */
export function useSave<T extends TableName>(t: T) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<RowOf<T>> & { id?: number; version?: number }) => {
      if (row.id) {
        const { id, ...rest } = row as any;
        return api.patch<RowOf<T>>(`/t/${t}/${id}`, rest);
      }
      return api.post<RowOf<T>>(`/t/${t}`, row);
    },
    onMutate: async (row: any) => {
      if (!row.id) return {};
      await qc.cancelQueries({ queryKey: tableKey(t) });
      const prev = qc.getQueryData<any[]>(tableKey(t));
      const before = prev?.find((r) => r.id === row.id);
      if (before) upsertInCache(qc, t, { ...before, ...row, version: before.version });
      return { before };
    },
    onError: (e, row: any, ctx: any) => {
      if (ctx?.before) upsertInCache(qc, t, ctx.before);
      if (e instanceof ApiError && e.code === "CONFLICT" && e.detail?.current) {
        const current = e.detail.current;
        upsertInCache(qc, t, current);
        conflictBus.emit({
          table: t,
          mine: row,
          current,
          retry: (merged) =>
            api.patch(`/t/${t}/${current.id}`, { ...merged, version: current.version }).then((r) => {
              upsertInCache(qc, t, r);
              return r;
            }),
        });
        return;
      }
      if (e instanceof ApiError && e.code === "NOTFOUND") void qc.invalidateQueries({ queryKey: tableKey(t) });
      toast.error(errorMessage(e));
    },
    onSuccess: (row) => {
      upsertInCache(qc, t, row);
    },
  });
}

/** 삭제. 가정·시설 삭제 시 배정 방문자는 서버가 자동 미배정 → 방문자 표도 새로고침 */
export function useRemove<T extends TableName>(t: T) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: { id: number; version?: number }) =>
      api.del<{ cleared: number }>(`/t/${t}/${row.id}${row.version != null ? `?version=${row.version}` : ""}`),
    onMutate: async (row) => {
      await qc.cancelQueries({ queryKey: tableKey(t) });
      const prev = qc.getQueryData<any[]>(tableKey(t));
      qc.setQueryData<any[]>(tableKey(t), (old) => old?.filter((r) => r.id !== row.id));
      return { prev };
    },
    onError: (e, _row, ctx) => {
      if (ctx?.prev) qc.setQueryData(tableKey(t), ctx.prev);
      toast.error(errorMessage(e));
      if (e instanceof ApiError && e.code === "CONFLICT") void qc.invalidateQueries({ queryKey: tableKey(t) });
    },
    onSuccess: (r) => {
      if (t === "facilities" || t === "homestays") {
        void qc.invalidateQueries({ queryKey: tableKey("visitors") });
        if (r?.cleared) toast.info(tt("shell.data.cleared", { n: r.cleared }));
      }
    },
  });
}

export interface BulkResult {
  ok: boolean;
  row?: any;
  error?: string;
  code?: string;
}
/** 일괄 저장(200행씩). 진행 상황 콜백. 결과는 입력 순서대로 */
export async function bulkSave(
  qc: QueryClient,
  t: TableName,
  rows: any[],
  onProgress?: (done: number, total: number) => void,
): Promise<BulkResult[]> {
  const out: BulkResult[] = [];
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    try {
      const r = await api.post<{ results: BulkResult[] }>(`/t/${t}/bulk`, { rows: chunk });
      out.push(...r.results);
    } catch (e) {
      chunk.forEach(() => out.push({ ok: false, error: errorMessage(e) }));
    }
    onProgress?.(Math.min(i + 200, rows.length), rows.length);
  }
  await qc.invalidateQueries({ queryKey: tableKey(t) });
  return out;
}

/** 배정 일괄 적용(자동 배정 등) — 서버가 행마다 재검사 */
export async function assignStays(
  qc: QueryClient,
  changes: { id: number; version: number; facilityId: number | null; homestayId: number | null }[],
  onProgress?: (d: number, n: number) => void,
) {
  const out: BulkResult[] = [];
  for (let i = 0; i < changes.length; i += 200) {
    try {
      const r = await api.post<{ results: BulkResult[] }>("/visitors/assign", { changes: changes.slice(i, i + 200) });
      out.push(...r.results);
    } catch (e) {
      changes.slice(i, i + 200).forEach(() => out.push({ ok: false, error: errorMessage(e) }));
    }
    onProgress?.(Math.min(i + 200, changes.length), changes.length);
  }
  await qc.invalidateQueries({ queryKey: tableKey("visitors") });
  return out;
}
export async function unassignStays(qc: QueryClient, scope: "orphan" | "unconfirmed" | "hs" | "room" | "all") {
  const r = await api.post<{ cleared: number }>("/visitors/unassign", { scope });
  await qc.invalidateQueries({ queryKey: tableKey("visitors") });
  return r.cleared;
}

/** 공용 결과 요약 토스트 */
export function toastBulk(label: string, res: BulkResult[]) {
  const ok = res.filter((r) => r.ok).length,
    ng = res.length - ok;
  if (!ng) toast.success(tt("shell.data.bulkOk", { label, n: ok }));
  else {
    const reasons = new Map<string, number>();
    const fallback = tt("shell.data.error");
    res
      .filter((r) => !r.ok)
      .forEach((r) => {
        const m = r.error ? tdNow(r.error) : fallback;
        reasons.set(m, (reasons.get(m) || 0) + 1);
      });
    const top = [...reasons.entries()]
      .slice(0, 3)
      .map(([m, n]) => `${m} (${n})`)
      .join("\n");
    toast.warning(tt("shell.data.bulkPartial", { label, ok, ng }), { description: top, duration: 10000 });
  }
}

export { AUTH_TABLES };
