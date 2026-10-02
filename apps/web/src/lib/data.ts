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

/** 첫 화면 일괄 로딩 키 — 사용자가 바뀌면 키도 바뀌어 한 번 더 받음 */
export const bootKey = (uid?: number) => ["boot", uid ?? 0] as const;

/** 첫 화면: /api/data 한 번으로 모든 표를 받아 캐시에 채움(요청 수 절감 — ngrok 경유 시 체감 속도 ↑) */
function useBoot() {
  const qc = useQueryClient();
  const { user, ready } = useAuth();
  return useQuery({
    queryKey: bootKey(user?.id),
    queryFn: async ({ signal }) => {
      try {
        const d = await api.get<Partial<Dataset>>("/data");
        // 응답 전에 사용자가 바뀌었으면(취소됨) 캐시에 쓰지 않음 — 이전 사용자 데이터가 섞이지 않게
        if (signal.aborted) throw new Error("boot cancelled");
        for (const t of TABLE_NAMES) if (d[t]) qc.setQueryData(tableKey(t), d[t]);
        return true;
      } catch (e) {
        if (signal.aborted) throw e;
        // 실패하면 표별로 받음(실패를 성공으로 끝내 화면 이동마다 /data를 다시 시도하지 않게)
        void qc.invalidateQueries({ queryKey: ["t"] });
        return false;
      }
    },
    enabled: ready,
    staleTime: Infinity,
    retry: false,
  });
}
export function useBootstrapData() {
  useBoot();
}

/** 표 하나 읽기. 권한 없으면 빈 배열. 첫 일괄 로딩이 끝난 뒤에만 표별 요청(중복 다운로드 방지) */
export function useTable<T extends TableName>(t: T) {
  const { canRead } = useCan();
  const { ready } = useAuth();
  const boot = useBoot();
  const allowed = ready && canRead(t);
  const booted = !boot.isPending;
  const q = useQuery({
    queryKey: tableKey(t),
    queryFn: () => api.get<RowOf<T>[]>("/t/" + t),
    enabled: allowed && booted,
    staleTime: Infinity, // 변경은 SSE로 무효화
  });
  const rows = useMemo(() => (allowed ? (q.data ?? []) : []), [allowed, q.data]);
  const isLoading = allowed && (q.isLoading || (!booted && q.data === undefined));
  return { rows, isLoading, error: q.error as ApiError | null, enabled: allowed };
}

// ── 내가 저장한 변경의 SSE 메아리 — 캐시는 응답으로 이미 갱신했으니 표 전체를 다시 받지 않음 ──
const ECHO_TTL = 10_000;
const selfEcho = new Map<string, number[]>();
function expectEcho(t: string) {
  const now = Date.now();
  const list = (selfEcho.get(t) ?? []).filter((at) => now - at < ECHO_TTL);
  list.push(now);
  selfEcho.set(t, list);
  return now;
}
function dropEcho(t: string, at: number) {
  const list = selfEcho.get(t);
  const i = list?.indexOf(at) ?? -1;
  if (i >= 0) list!.splice(i, 1);
}
/**
 * 저장 직전에 그 표의 재요청이 진행 중이거나 무효화돼 있었는지. 저장이 그 재요청을 취소하거나(cancelQueries)
 * 늦게 온 응답이 저장 결과를 덮어쓸 수 있으므로, 그런 경우엔 메아리를 무시하는 대신 성공 후 다시 받는다.
 * (upsertInCache가 무효화 표시를 지우므로 cancel·upsert 전에 읽어야 함)
 */
function wasStale(qc: QueryClient, t: TableName) {
  const s = qc.getQueryState(tableKey(t));
  return s?.fetchStatus === "fetching" || !!s?.isInvalidated;
}
function refetchIfStale(qc: QueryClient, t: TableName, stale?: boolean) {
  if (stale || qc.isFetching({ queryKey: tableKey(t) }) > 0) void qc.invalidateQueries({ queryKey: tableKey(t) });
}
function takeEcho(t: string) {
  const now = Date.now();
  const list = (selfEcho.get(t) ?? []).filter((at) => now - at < ECHO_TTL);
  const hit = list.length > 0;
  if (hit) list.shift();
  selfEcho.set(t, list);
  return hit;
}

/** SSE 구독: 다른 사용자가 바꾼 표만 다시 불러옴. 재연결 시 전체 새로고침(놓친 이벤트 보정) */
export function useLiveUpdates() {
  const qc = useQueryClient();
  const uid = useAuth().user?.id;
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
          const e = JSON.parse(ev.data) as { tables: string[]; by?: number };
          const mine = uid != null && e.by === uid;
          e.tables.forEach((t) => {
            if (!(mine && takeEcho(t))) pending.current.add(t);
          });
          if (!pending.current.size) return;
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
  }, [qc, uid]);
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
      const echo = expectEcho(t);
      try {
        if (row.id) {
          const { id, ...rest } = row as any;
          return await api.patch<RowOf<T>>(`/t/${t}/${id}`, rest);
        }
        return await api.post<RowOf<T>>(`/t/${t}`, row);
      } catch (e) {
        dropEcho(t, echo);
        throw e;
      }
    },
    onMutate: async (row: any) => {
      const stale = wasStale(qc, t);
      if (!row.id) return { stale };
      await qc.cancelQueries({ queryKey: tableKey(t) });
      const prev = qc.getQueryData<any[]>(tableKey(t));
      const before = prev?.find((r) => r.id === row.id);
      if (before) upsertInCache(qc, t, { ...before, ...row, version: before.version });
      return { before, stale };
    },
    onError: (e, row: any, ctx: any) => {
      if (ctx?.before) upsertInCache(qc, t, ctx.before);
      refetchIfStale(qc, t, ctx?.stale); // 실패하면 메아리도 없으니 취소된 재요청은 여기서 복구
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
    onSuccess: (row, _row, ctx) => {
      upsertInCache(qc, t, row);
      refetchIfStale(qc, t, ctx?.stale);
    },
  });
}

/** 삭제. 가정·시설 삭제 시 배정 방문자는 서버가 자동 미배정 → 방문자 표도 새로고침 */
export function useRemove<T extends TableName>(t: T) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { id: number; version?: number }) => {
      const echo = expectEcho(t);
      try {
        return await api.del<{ cleared: number }>(`/t/${t}/${row.id}${row.version != null ? `?version=${row.version}` : ""}`);
      } catch (e) {
        dropEcho(t, echo);
        throw e;
      }
    },
    onMutate: async (row) => {
      const stale = wasStale(qc, t);
      await qc.cancelQueries({ queryKey: tableKey(t) });
      const prev = qc.getQueryData<any[]>(tableKey(t));
      qc.setQueryData<any[]>(tableKey(t), (old) => old?.filter((r) => r.id !== row.id));
      return { prev, stale };
    },
    onError: (e, _row, ctx) => {
      if (ctx?.prev) qc.setQueryData(tableKey(t), ctx.prev);
      refetchIfStale(qc, t, ctx?.stale);
      toast.error(errorMessage(e));
      if (e instanceof ApiError && e.code === "CONFLICT") void qc.invalidateQueries({ queryKey: tableKey(t) });
    },
    onSuccess: (r, _row, ctx) => {
      refetchIfStale(qc, t, ctx?.stale);
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
