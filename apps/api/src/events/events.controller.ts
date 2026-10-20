import { Controller, Req, Sse, type MessageEvent } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { catchError, concatMap, defer, filter, from, interval, map, merge, of, switchMap, type Observable } from "rxjs";
import { EventsService } from "./events.service.js";
import { PersonService } from "../messages/person.service.js";

@Controller("events")
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly persons: PersonService,
  ) {}

  /**
   * GET /api/events — text/event-stream. 25초마다 ping(ngrok·nginx 유휴 끊김 방지).
   * 받는 사람이 정해진 이벤트(to)는 이 연결의 신원(로그인 계정·개인 링크)에 해당할 때만 보냄(로그인·로그아웃 시 웹이 재연결)
   */
  @Sse()
  stream(@Req() req: FastifyRequest): Observable<MessageEvent> {
    let keys = new Set<string>();
    // ping 때마다 신원을 다시 확인 — 링크 폐기·계정 비활성화 후에는 늦어도 다음 ping부터 메시지가 가지 않음
    const refresh = () => from(this.persons.keys(req).then((k) => void (keys = k)));
    return defer(refresh).pipe(
      switchMap(() =>
        merge(
          this.events.changes$.pipe(
            filter((e) => !e.to || e.to.some((k) => keys.has(k))),
            map(({ to: _to, ...e }) => ({ type: "change", data: e })),
          ),
          interval(25_000).pipe(
            concatMap(() => refresh().pipe(catchError(() => of(undefined)))),
            map(() => ({ type: "ping", data: { t: Date.now() } })),
          ),
        ),
      ),
    );
  }
}
