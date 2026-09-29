# 코드 컨벤션 — WYD v2

코드리뷰(`/wyd-code-review`, `code-reviewer` 에이전트)는 이 문서의 **규칙 ID**를 인용해 위반을 보고합니다.
🤖 표시는 ESLint·Prettier·tsc가 자동으로 검사하는 규칙, 나머지는 리뷰어가 읽고 판단하는 규칙입니다.

## 자동 검사 (반드시 통과)

```bash
npm run check          # format:check → lint → typecheck → test
npm run lint:fix       # 자동 수정 가능한 린트
npm run format         # Prettier 적용
```

| 도구 | 설정 | 역할 |
|---|---|---|
| Prettier | `.prettierrc.json` (140자, 큰따옴표, 세미콜론, trailing comma) | 포맷. 손으로 줄 맞추지 말 것 |
| ESLint | `eslint.config.js` | 버그성 규칙(typescript-eslint type-checked, react-hooks) + 아래 프로젝트 규칙 |
| tsc | 각 패키지 `tsconfig.json` (`strict`, web은 `noUnusedLocals`) | 타입 |
| vitest | `packages/shared/src/*.test.ts` | 배정 규칙 |

린트 규칙을 끌 때는 **해당 줄만**, 사유 주석과 함께: `// eslint-disable-next-line <규칙> -- <이유>`. 파일 전체 비활성화 금지(자동 추출 파일 `content.ts` 제외).

### 리뷰 절차 (Claude Code 훅으로 자동 적용 — `.claude/settings.json`, `v2/`에서 `claude` 실행 시)

구현 → `code-reviewer` 서브에이전트 리뷰 → 🔴 수정 → 재리뷰(🔴 0건) → 커밋

| 시점 | 훅 | 동작 |
|---|---|---|
| 파일 편집 직후 | `post-edit-lint.sh` | Prettier 적용 + 해당 파일 ESLint, 오류는 즉시 Claude에게 되돌림 |
| 턴 종료 | `stop-review-gate.sh` | 미리뷰 변경·🔴 잔존 시 1회 알림 |
| 리뷰어 종료 | `save-review.sh` | 보고서 `.claude/reviews/` 저장, `REVIEW_RESULT` 줄로 🔴 집계 → `.claude/state/review.json` |
| `git commit` (Claude) | `pre-commit-gate.sh` | 현재 변경분이 리뷰되지 않았거나 🔴>0이면 명령 자체를 거부 |
| `git commit` (모든 커밋) | `.githooks/pre-commit` → `pre-commit-gate.sh --git` | 위 조건 + `format:check`·`lint` 실패면 차단. `npm install` 시 `prepare`가 `core.hooksPath`를 설정 |
| 리뷰 중 Bash | `reviewer-readonly.sh` | 리뷰어의 수정·git 변경 명령 차단 |

"리뷰됨"은 리뷰 시점의 코드 지문(`git diff HEAD` + 새 파일, `*.md`·`.claude` 제외)과 현재가 같다는 뜻 — 🔴를 고치면 지문이 바뀌므로 재리뷰가 필요합니다. 긴급 우회: `WYD_SKIP_REVIEW=1` 또는 `touch .claude/state/skip`(사용 후 삭제).

---

## G. 공통

| ID | 규칙 |
|---|---|
| G-01 | 주석은 **한국어, 짧게, "왜"** 위주. 코드가 말하는 "무엇"은 쓰지 않음. 파일 첫 줄에 역할 한 줄 주석 |
| G-02 | 이름: 변수·함수 `camelCase`, 타입·컴포넌트 `PascalCase`, 상수 표 `UPPER_SNAKE`(`WYD_TEAMS`), DB 컬럼 `snake_case` ↔ TS 필드 `camelCase`(Drizzle에서 매핑) |
| G-03 | **공유 로직은 `@wyd/shared` 한 곳**: 배정 규칙(`roomFit`/`hsFit`/`planAutoAssign`), 입력 검증(`schemas`), 상수. 프론트·서버에 같은 로직을 따로 쓰지 않음 |
| G-04 | 콘텐츠 원문(문구·예식서·준비 단계·팀 정의)은 `packages/shared/src/content.ts`에서만 수정 |
| G-05 🤖 | Promise는 `await` 하거나 `void`로 명시(`no-floating-promises`, `no-misused-promises`) — 저장 누락 방지 |
| G-06 🤖 | `==` 금지(`eqeqeq`, `== null`만 허용). 타입 import는 `import { type X }` |
| G-07 | 사용자에게 보이는 메시지는 한국어 존댓말, 원인 + 해결 방법("…입니다. …하세요.") |
| G-08 | 매직 넘버·문자열(상태값 "확정", 성별 "남/여" 등)은 shared 스키마의 enum과 일치시킬 것 |

## API — `apps/api`

| ID | 규칙 |
|---|---|
| API-01 | 업무 표 쓰기는 **`TablesService`(`createIn`/`updateIn`/`removeIn`/`bulk`) 경유** — 트랜잭션, `FOR UPDATE`, `version` 검사, `audit`, `events.emit`이 함께 보장됨. 컨트롤러에서 `db.insert/update/delete` 직접 호출 금지(계정 `users`·`wyd_status` 제외) |
| API-02 | 권한은 **`tables/registry.ts`의 `read`/`canWrite`/`scope`/`publicMask`** 한 곳에서. 라우트에는 `@RequireLogin(역할)`만. 프론트 `useCan()`도 같은 규칙으로 맞출 것 |
| API-03 | 오류는 `common/errors.ts`의 코드(`CONFLICT`·`STAY`·`CAPACITY`·`VALIDATION`·`NOTFOUND`·`FORBIDDEN`·`DUPLICATE`·`RATE_LIMIT`)로만. `throw new Error`를 클라이언트까지 흘리지 않음. DB 오류는 `mapDbError` |
| API-04 | 입력 검증은 shared `schemas`(zod) + `safeParse`. 수정은 **현재 행과 병합 후 전체 검증**(부분 스키마 기본값이 덮어쓰는 문제 방지) |
| API-05 | 숙소 배정 변경은 `visitors/stay.ts`의 `checkVisitorStay`, 시설·가정 정원/성별/상태 변경은 `checkHostPolicy`를 **대상 행 잠금 후** 호출. 여러 행 잠금은 **id 오름차순**(교착 방지) |
| API-06 🤖 | `TRUNCATE … CASCADE` 금지 — `users.homestay_id` FK 때문에 계정까지 지워짐. 의존 순서대로 `DELETE` |
| API-07 | DB 구조 변경: `db/schema.ts` 수정 → `npx drizzle-kit generate --name <설명>` → `drizzle/*.sql` 함께 커밋. 기존 마이그레이션 파일 수정 금지 |
| API-08 | ESM: 상대 import에 `.js` 확장자(`from "./x.js"`). tsc(NodeNext)가 검사 |
| API-09 | 한 요청의 일괄 처리 상한 200행(`BULK_MAX`). 행별 결과는 `SAVEPOINT`(`tx.transaction`)로 격리 |
| API-10 | 새 표를 추가하면: `schema.ts` + shared `types.ts`/`schemas.ts`/`TABLE_NAMES` + `registry.ts` + 웹 `AUTH_TABLES`(로그인 필요 시)까지 한 번에 |

## WEB — `apps/web`

| ID | 규칙 |
|---|---|
| WEB-01 🤖 | 서버 호출은 `src/lib/api.ts`(`api.get/post/patch/del/upload`)만. `fetch` 직접 호출 금지 |
| WEB-02 🤖 | 색은 **디자인 토큰 클래스**(`bg-surface`, `text-ink-2`, `bg-primary-soft`, `text-bad`…)만. hex·`rgb()` 하드코딩 금지 — 다크 모드가 깨짐 |
| WEB-03 🤖 | `dangerouslySetInnerHTML`·`innerHTML` 금지. 여러 줄 텍스트는 `whitespace-pre-wrap` |
| WEB-04 | 데이터는 `src/lib/data.ts` 훅: 읽기 `useTable`, 저장 `useSave`(수정 시 `version` 포함), 삭제 `useRemove`, 일괄 `bulkSave`/`assignStays`. 쿼리 키 `["t", 표이름]` |
| WEB-05 | 인쇄는 `lib/print.ts`(`printDocument`), CSV는 `lib/csv.ts`(`downloadCSV`) — 이스케이프·수식 방지 내장 |
| WEB-06 | 편집 UI는 `useCan().canWrite(표, 행)`로 숨김(최종 판단은 서버). 관리자 전용 기능은 `isAdmin` |
| WEB-07 🤖 | Hook 규칙(`rules-of-hooks`), 의존성 배열(`exhaustive-deps`) |
| WEB-08 | `EditDialog`의 `defaults`·`fields`·`custom`은 `useMemo`로 고정. 큰 목록 계산(`buildStayIndex` 등)도 `useMemo`/`useStayIndex` |
| WEB-09 | 접근성: 아이콘만 있는 버튼에 `aria-label`, 입력에 `Field` 라벨, 클릭 가능한 요소는 `button`/`a` |
| WEB-10 | 구조: 페이지 `src/pages/<Name>.tsx`(default export, `App.tsx`에 lazy 라우트), 영역 컴포넌트 `src/components/<area>/`, 공용 UI `src/components/ui/` |
| WEB-11 | 반응형: 모바일(390px)에서 가로 스크롤은 표 안에서만, 페이지 전체 가로 스크롤 금지 |

## SEC — 보안·개인정보

| ID | 규칙 |
|---|---|
| SEC-01 | 연락처·주소 등 개인정보 필드가 있는 표는 registry `read: "auth"`, 공개 표에 넣을 때는 `publicMask` |
| SEC-02 | 비밀값(`JWT_SECRET`, DB 비밀번호, ngrok 토큰)은 `.env`만. 코드·로그·커밋 금지 |
| SEC-03 | 쓰기 요청은 `X-WYD` 헤더(CSRF 방어) — `api.ts`가 자동 부착, 새 클라이언트 코드도 이 경로 사용 |
| SEC-04 🤖 | `sql.raw`는 값 바인딩이 없음 — 사용자 입력이 들어가면 안 됨(경고 규칙). 쿼리는 `sql\`…${값}\`` 템플릿 사용 |
| SEC-05 | 공개 엔드포인트(비로그인)는 `Limiter`로 요청 수 제한, 받는 필드를 스키마로 최소화 |

## TEST

| ID | 규칙 |
|---|---|
| TEST-01 | 배정 규칙(`packages/shared/src/rules.ts`) 변경 → `rules.test.ts`에 케이스 추가 |
| TEST-02 | API 동작·권한 변경 → `apps/api/test/smoke.mjs` 갱신 후 `npm run test:smoke`(API 실행 중) |
| TEST-03 | 화면 변경 → 모바일·다크 모드에서 한 번 확인 |
