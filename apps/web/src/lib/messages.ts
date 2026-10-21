// 메시지 데이터 — 수신함(로그인 계정 /messages, 개인 링크 /p)·보내기·보낸 목록. 갱신은 SSE(inbox·sent 이벤트)로 무효화
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { InboxMessage, MessageTarget, PersonChat, PersonMe, Role, SentMessage } from "@wyd/shared";
import { api, type ApiError } from "./api";
import { useAuth } from "./auth";
import { tt } from "./i18n";

export const inboxKey = ["inbox"] as const;
export const sentKey = ["sent"] as const;
export const personKey = ["person"] as const;
/** 개인 링크 봉사자의 팀 오픈채팅방 — SSE teamChats 변경 시 무효화 */
export const personChatKey = ["p", "chat"] as const;

export interface PersonState {
  person: PersonMe | null;
  /** 서버가 요청 제한으로 확인하지 못함(링크는 그대로) — 잠시 뒤 자동으로 다시 확인 */
  limited?: boolean;
}
/** 개인 링크로 연결된 사람(로그인 사용자도 같은 기기에서 링크를 열 수 있으므로 항상 확인) */
export function usePerson() {
  const { ready } = useAuth();
  const q = useQuery({
    queryKey: personKey,
    queryFn: () => api.get<PersonState>("/p/me"),
    enabled: ready,
    staleTime: Infinity,
    refetchInterval: (query) => (query.state.data?.limited ? 30_000 : false),
  });
  return { person: q.data?.person ?? null, limited: !!q.data?.limited, isLoading: q.isLoading };
}

/** 수신함 주체 — 로그인 계정 우선, 없으면 개인 링크. key는 사람별 캐시 키(계정을 바꿔도 이전 사람 수신함이 보이지 않게) */
export function useInboxMode(asPerson?: boolean): { mode: "user" | "person" | null; key: readonly unknown[] } {
  const { user: u } = useAuth();
  const { person } = usePerson();
  // /me 화면은 같은 기기에 로그인돼 있어도 개인 링크 수신함을 보여 줌
  const user = asPerson ? null : u;
  const mode = user ? "user" : person ? "person" : null;
  const who = user ? `user:${user.id}` : person ? `${person.kind}:${person.id}` : "";
  return { mode, key: [...inboxKey, who] };
}

export function useInbox(asPerson?: boolean) {
  const { mode, key } = useInboxMode(asPerson);
  const q = useQuery({
    queryKey: key,
    queryFn: () => api.get<InboxMessage[]>(mode === "user" ? "/messages/inbox" : "/p/inbox"),
    enabled: mode !== null,
    staleTime: Infinity,
  });
  const rows = mode ? (q.data ?? []) : [];
  return { rows, unread: rows.filter((m) => !m.readAt).length, isLoading: q.isLoading, mode };
}

/** ids 없으면 전부 읽음. 화면은 바로 읽음으로 표시(실패하면 SSE·재조회가 바로잡음) */
export function useMarkRead(asPerson?: boolean) {
  const qc = useQueryClient();
  const { mode, key } = useInboxMode(asPerson);
  return useMutation({
    mutationFn: (ids?: number[]) => api.post(mode === "user" ? "/messages/read" : "/p/read", ids ? { ids } : {}),
    onMutate: (ids) => {
      const now = new Date().toISOString();
      qc.setQueryData<InboxMessage[]>(key, (old) =>
        old?.map((m) => (!m.readAt && (!ids || ids.includes(m.id)) ? { ...m, readAt: now } : m)),
      );
    },
    onError: () => void qc.invalidateQueries({ queryKey: inboxKey }),
  });
}

export function useSent(enabled: boolean) {
  const uid = useAuth().user?.id;
  const q = useQuery({
    queryKey: [...sentKey, uid],
    queryFn: () => api.get<SentMessage[]>("/messages/sent"),
    enabled: enabled && uid != null,
    staleTime: Infinity,
  });
  return { rows: q.data ?? [], isLoading: q.isLoading };
}

export interface DirectoryUser {
  id: number;
  name: string;
  username: string;
  role: Role;
  team: string;
}
/** 보내기 화면 계정 후보(서버가 보낼 수 있는 계정만 줌) */
export function useDirectory(enabled: boolean) {
  const uid = useAuth().user?.id;
  const q = useQuery({
    queryKey: ["directory", uid],
    queryFn: () => api.get<DirectoryUser[]>("/messages/directory"),
    enabled,
    staleTime: 60_000,
  });
  return q.data ?? [];
}

export interface SendInput {
  title: string;
  body: string;
  link: string;
  to: MessageTarget[];
}
export const previewRecipients = (to: MessageTarget[]) =>
  api.post<{ recipients: number; max: number }>("/messages", { title: "-", body: "-", to, dryRun: true });

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: SendInput) => api.post<{ id: number; recipients: number }>("/messages", m),
    onSuccess: (r) => {
      toast.success(tt("inbox.sentToast", { n: r.recipients }));
      void qc.invalidateQueries({ queryKey: sentKey });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/messages/${id}`),
    onSuccess: () => {
      toast.success(tt("common.deleted"));
      void qc.invalidateQueries({ queryKey: sentKey });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });
}

/** 개인 링크 봉사자: 자기 팀 카카오톡 오픈채팅방(순례자·미등록이면 null) */
export function usePersonChat(person: PersonMe | null) {
  return useQuery({
    queryKey: [...personChatKey, person?.kind, person?.id],
    queryFn: () => api.get<{ chat: PersonChat }>("/p/chat"),
    enabled: person?.kind === "volunteer",
    staleTime: Infinity,
  }).data?.chat;
}
