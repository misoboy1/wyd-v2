import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";

export interface ChangeEvent { tables: string[]; by?: number; at: number }

/** 데이터 변경 알림 버스 — SSE로 접속 중인 모든 화면에 "어떤 표가 바뀌었는지" 전달 */
@Injectable()
export class EventsService {
  readonly changes$ = new Subject<ChangeEvent>();
  emit(tables: string[], by?: number) {
    if (tables.length) this.changes$.next({ tables: [...new Set(tables)], by, at: Date.now() });
  }
}
