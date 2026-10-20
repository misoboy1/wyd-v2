import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";

export interface ChangeEvent {
  tables: string[];
  by?: number;
  at: number;
  /** 받을 사람 키(`user:12`, `visitor:88`) — 있으면 해당자에게만 보냄(SSE 응답에는 넣지 않음) */
  to?: string[];
  /** 새 메시지 알림(받는 사람에게만 가는 이벤트에서만) */
  msg?: { id: number; title: string };
}

/** 데이터 변경 알림 버스 — SSE로 접속 중인 화면에 "어떤 표가 바뀌었는지" 전달. to가 있으면 대상자 화면에만 */
@Injectable()
export class EventsService {
  readonly changes$ = new Subject<ChangeEvent>();
  emit(tables: string[], by?: number) {
    if (tables.length) this.changes$.next({ tables: [...new Set(tables)], by, at: Date.now() });
  }
  /** 특정 사람들에게만(수신함 갱신 등) */
  emitTo(to: string[], tables: string[], msg?: ChangeEvent["msg"]) {
    if (to.length && tables.length) this.changes$.next({ tables, to: [...new Set(to)], msg, at: Date.now() });
  }
}

/** 받는 사람 키 — SSE 필터·발송 대상 공용 */
export const whoKey = (kind: string, id: number) => `${kind}:${id}`;
