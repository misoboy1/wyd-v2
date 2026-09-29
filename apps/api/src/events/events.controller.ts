import { Controller, Sse, type MessageEvent } from "@nestjs/common";
import { interval, map, merge, type Observable } from "rxjs";
import { EventsService } from "./events.service.js";

@Controller("events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /** GET /api/events — text/event-stream. 25초마다 ping(ngrok·nginx 유휴 끊김 방지) */
  @Sse()
  stream(): Observable<MessageEvent> {
    return merge(
      this.events.changes$.pipe(map((e) => ({ type: "change", data: e }))),
      interval(25_000).pipe(map(() => ({ type: "ping", data: { t: Date.now() } }))),
    );
  }
}
