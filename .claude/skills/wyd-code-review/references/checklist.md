# 리뷰 체크리스트 — 파일 영역별

자동 검사(Prettier·ESLint·tsc·vitest)로 잡히지 않는 것 위주. 괄호는 CONVENTIONS.md 규칙 ID.

## 모든 파일
- [ ] 주석이 "왜"를 설명하는가, 코드와 어긋난 낡은 주석은 없는가 (G-01)
- [ ] 같은 로직이 프론트·서버에 중복 구현되지 않았는가 → shared로 (G-03)
- [ ] 사용자 메시지가 한국어 존댓말 + 해결 방법인가 (G-07)
- [ ] 상태·성별 등 enum 문자열이 shared `schemas`와 일치하는가 (G-08)
- [ ] 죽은 코드·미사용 export·디버그 `console.log`가 남지 않았는가
- [ ] eslint-disable가 한 줄 단위 + 사유 주석인가

## apps/api
- [ ] 업무 표 쓰기가 `TablesService`를 거치는가 — 직접 `db.insert/update/delete` 여부 grep (API-01)
- [ ] 수정(PATCH) 경로에서 `version` 검사가 빠지지 않았는가 → 동시 수정 덮어쓰기 (API-01)
- [ ] 변경 후 `events.emit([...표])`로 SSE 알림을 보내는가(연쇄로 바뀐 표 포함, 예: 시설 삭제 → visitors) (API-01)
- [ ] 새 라우트에 `@RequireLogin` 또는 공개 이유가 있는가. 권한 판단이 registry 밖에 흩어지지 않았는가 (API-02)
- [ ] 오류가 `ApiError` 코드로 나가는가, 스택·SQL이 응답에 새지 않는가 (API-03)
- [ ] 입력을 zod로 검증하는가. 수정은 병합 후 전체 검증인가 (API-04)
- [ ] 배정·정원 관련 변경이 `checkVisitorStay`/`checkHostPolicy`를 **행 잠금 후** 호출하는가, 잠금 순서가 id 오름차순인가 (API-05)
- [ ] `schema.ts`가 바뀌었는데 `drizzle/` 마이그레이션이 없거나, 기존 마이그레이션을 고치지 않았는가 (API-07)
- [ ] shared `types.ts`/`schemas.ts`와 DB 컬럼(이름·nullable·기본값)이 맞는가 (API-10)
- [ ] 트랜잭션 안에서 외부 HTTP 호출·긴 작업을 하지 않는가(잠금 시간)
- [ ] N+1 쿼리, 요청당 전체 표 반복 조회가 없는가 (1,000명·500가정 기준)

## apps/web
- [ ] 서버 데이터를 `useTable`로 읽고 `useSave`/`useRemove`로 쓰는가, 수정 시 `version`을 보내는가 (WEB-04)
- [ ] 로컬 state로 서버 데이터를 복제해 SSE 갱신과 어긋나지 않는가
- [ ] 편집 버튼·메뉴가 `useCan().canWrite`로 가려지는가 — 서버 권한과 일치하는가 (WEB-06, API-02)
- [ ] `useMemo`/`useCallback` 의존성이 맞는가, `EditDialog` props가 매 렌더 새 객체가 아닌가 (WEB-08)
- [ ] 1,000행 목록에서 렌더마다 O(n²) 계산(`filter` 안의 `find` 등)이 없는가
- [ ] 로딩·빈 목록·오류 상태가 있는가, 저장 중 중복 클릭이 막히는가
- [ ] 아이콘 버튼 `aria-label`, 입력 라벨, 키보드 조작 (WEB-09)
- [ ] 모바일 폭에서 레이아웃이 깨지지 않을 구조인가(고정 폭, `whitespace-nowrap` 남용) (WEB-11)
- [ ] 인쇄·CSV가 `printDocument`/`downloadCSV`를 쓰는가 (WEB-05)

## packages/shared
- [ ] 규칙 변경이 프론트 미리보기와 서버 재검사 **양쪽에** 같은 결과를 내는가 (G-03)
- [ ] `rules.test.ts`에 케이스가 추가됐는가 (TEST-01)
- [ ] `content.ts` 수정이 원문 콘텐츠 수정 의도인가 (G-04)
- [ ] 브라우저·Node 양쪽에서 동작하는 코드인가(Node 전용 API 사용 금지)

## 인프라 (docker-compose, nginx, Dockerfile, scripts)
- [ ] DB·API 포트가 외부에 열리지 않는가(`internal` 네트워크, `127.0.0.1` 바인딩)
- [ ] e2-micro 메모리 상한(`mem_limit`) 합이 1GB+스왑 안인가
- [ ] nginx `add_header`를 쓰는 location에 `security-headers.conf` include가 있는가(상속 안 됨)
- [ ] SSE 경로 `proxy_buffering off` 유지
- [ ] 비밀값이 이미지·compose·로그에 들어가지 않는가 (SEC-02)

## 보안·개인정보
- [ ] tel·addr 등 개인정보가 비로그인 응답에 포함되지 않는가 (SEC-01)
- [ ] 공개 엔드포인트에 요청 제한·필드 최소화가 있는가 (SEC-05)
- [ ] `sql.raw`·동적 SQL에 사용자 입력이 섞이지 않는가 (SEC-04)
- [ ] 업로드 파일 형식·크기 검사, 저장 파일명에 사용자 입력을 쓰지 않는가
