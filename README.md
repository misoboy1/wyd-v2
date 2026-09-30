# 중계양업성당 WYD 2027 관리 프로그램 v2

기존 `index.html`(단일 파일) + Google Apps Script/Sheets 구조를 **웹서버(Nginx) / WAS(Node·NestJS) / DB(PostgreSQL)** 구조로 옮겼습니다.
Docker Compose로 무료 GCP VM(e2-micro) 한 대에 올리고, ngrok으로 공개 주소(https)를 받아 서비스합니다.

```
 브라우저 ──https──▶ ngrok ──▶ web (Nginx: React 정적 파일, /api 프록시, /uploads)
                                   │
                                   ▼
                              api (NestJS + Fastify) ──▶ db (PostgreSQL 16)
                                   │  └─ 실시간 알림(SSE) · 묵주기도 현황 수집(매일 06:10)
                                   └─ uploads 볼륨(고리기도 사진)
 backup (매일 03:30 pg_dump, 7일 보관)
```

## 무엇이 달라졌나

| 영역 | 기존 | v2 |
|---|---|---|
| 동시 접속 | Apps Script 전역 잠금 1개(동시 저장 시 BUSY) | Postgres 트랜잭션. 숙소 행 단위 잠금이라 **다른 숙소 배정은 병렬 처리** |
| 동시 수정 | 시트 `_upd` 문자열 비교 | 행마다 `version` — 먼저 저장된 변경을 덮어쓰면 409 → **비교 창**에서 선택 |
| 숙소 연결 | 이름 문자열(`room`, `homestay`, `hsid`) + 이름 변경 연쇄 | **FK(id)** 연결 — 이름을 바꿔도 연결 유지, 삭제 시 자동 미배정 |
| 배정 규칙 | 화면·서버에 각각 구현 | `packages/shared` 한 곳의 규칙을 화면(후보·자동 배정 미리보기)과 서버(트랜잭션 재검사)가 공유 |
| 로그인 | 공유 PIN(누구나 잠금을 걸 수 있음) | **개인 계정 + 역할**(관리자·분과 책임자·홈스테이 가정), 계정·IP별 실패 제한 |
| 개인정보 | 기본 설정에서 링크만 알면 전체 연락처·주소 열람 | 방문자·가정·봉사자·게시판은 **로그인해야** 열람. 홈스테이 가정 계정은 자기 가정·숙박자만 |
| 화면 반영 | 2분 캐시 + 새로고침 | **SSE 실시간** — 다른 사람이 바꾼 표만 즉시 다시 불러옴 |
| 사진 | Google Drive 공개 링크 | 서버에서 리사이즈(WebP) 후 `uploads` 볼륨, Nginx가 제공 |
| UI | 398KB 단일 HTML, 인라인 onclick | React + Tailwind, 모바일 하단 탭·드로어, 다크 모드, ⌘K 검색, 1,000행 가상 스크롤 |
| 보안 | 인라인 onclick XSS 취약점(`jsq`) | React 자동 이스케이프, CSP·보안 헤더, CSRF 헤더(X-WYD), httpOnly 쿠키 |

콘텐츠(문구·예식서·준비 단계·팀 정의·시설 실측·고리기도 배정표·장소)는 `packages/shared/src/content.ts`에 기존 코드에서 **그대로 추출**했습니다.

## 폴더 구조

```
v2/
  docker-compose.yml        nginx · api · db · ngrok · backup
  .env.example              운영 설정 예시 → .env 로 복사
  nginx/                    웹서버 설정(보안 헤더, SSE, SPA 라우팅, 캐시)
  packages/shared/          공용 TS: 콘텐츠·상수, 배정 규칙(roomFit/hsFit/planAutoAssign), 입력 검증(zod)
  apps/api/                 WAS: NestJS + Fastify + Drizzle ORM
    src/tables/             공용 CRUD(버전 충돌·행 잠금·감사 로그)와 권한 레지스트리
    src/visitors/           배정 재검사(stay.ts), 일괄 배정·해제 API
    src/auth/               로그인·세션(JWT 쿠키)·계정 관리
    src/cli/                초기 관리자·데모 데이터·Sheets 이관 명령
    drizzle/                DB 마이그레이션 SQL(기동 시 자동 적용)
    test/                   통합·동시성 스모크, 간이 부하 테스트
  apps/web/                 React + Vite + Tailwind (13개 화면 + 계정 관리)
  scripts/                  개발용 DB, 백업, k6 부하 테스트
```

---

## 1. GCP 무료 VM에 배포

> 처음이라면 화면 하나하나 따라 하는 **[쉬운 배포 가이드(docs/DEPLOY-GCP.md)](docs/DEPLOY-GCP.md)** 를 보세요. 아래는 요약입니다.

### 1-1. VM 만들기
1. GCP 콘솔 → Compute Engine → VM 인스턴스 만들기
   - 리전: **us-west1 / us-central1 / us-east1** 중 하나(무료 등급 대상)
   - 머신: **e2-micro**, 부팅 디스크: Ubuntu 24.04 LTS, **표준 영구 디스크 30GB**
   - 방화벽: HTTP/HTTPS 허용 **불필요**(ngrok이 바깥으로 연결을 여는 방식이라 인바운드 포트를 열지 않습니다)
2. SSH 접속 후 **스왑 2GB**(RAM 1GB라 필수):
   ```bash
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
3. Docker 설치:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER && newgrp docker
   ```

### 1-2. ngrok 준비
1. https://dashboard.ngrok.com 가입 → **Your Authtoken** 복사
2. **Domains** → 무료 고정 도메인 1개 발급(예: `jungye-wyd.ngrok-free.app`)

> ⚠️ ngrok 무료 플랜: 브라우저로 처음 들어오면 **안내(경고) 페이지**가 한 번 뜨고("Visit Site" 클릭), 월 전송량 한도가 있습니다.
> 순례자·신자 등 외부 방문이 많아지면 `docker-compose.yml` 하단 주석의 **Cloudflare Tunnel**(무료, 경고 페이지 없음)로 바꾸는 것을 권장합니다.

### 1-3. 실행
```bash
git clone <저장소> wyd && cd wyd/v2        # 또는 v2 폴더를 scp로 복사
cp .env.example .env
nano .env        # DB_PASSWORD, JWT_SECRET(openssl rand -base64 32), ADMIN_PASSWORD, NGROK_AUTHTOKEN, NGROK_DOMAIN
docker compose up -d --build              # 첫 빌드는 e2-micro에서 5~10분
docker compose ps                          # 모두 healthy 확인
docker compose logs -f api                 # "관리자 계정 생성: admin" 확인
```
`https://<NGROK_DOMAIN>` 접속 → 로그인(`ADMIN_USERNAME`/`ADMIN_PASSWORD`) → **오른쪽 위 메뉴 → 비밀번호 변경**.
이후 **관리 → 계정 관리**에서 분과 책임자·홈스테이 가정 계정을 발급합니다.

> 빌드가 메모리 부족으로 느리거나 실패하면: 로컬 PC에서 이미지를 빌드해 올리거나(`docker save | ssh … docker load`), 스왑이 켜져 있는지 확인하세요.

### 1-4. 업데이트
> 자동 배포(GitHub push → 서버 자동 반영)를 켰다면 [docs/CICD.md](docs/CICD.md)를 따르세요. 아래는 수동 방식입니다.

```bash
git pull && docker compose up -d --build   # DB 마이그레이션은 api 기동 시 자동 적용
```

---

## 2. 기존 Google Sheets 데이터 이관

1. 기존 Apps Script 주소로 원본 JSON을 받습니다(둘 중 하나).
   - 서버에서 바로: `--url "<exec 주소>" --pin "<관리자 PIN>"`
   - 또는 브라우저에서 `<exec 주소>?action=read&pin=<관리자 PIN>` 을 열어 `sheets.json`으로 저장 → VM에 복사
2. 먼저 **dry-run**(DB 변경 없이 건수·문제 목록만):
   ```bash
   docker compose cp sheets.json api:/tmp/sheets.json
   docker compose exec -w /tmp api node /app/apps/api/dist/cli/migrate-sheets.js --file /tmp/sheets.json --dry-run
   ```
3. 결과(교리실/홈스테이/연결 끊김/미배정 수)가 기존 대시보드 숫자와 맞는지 확인 후 실제 실행:
   ```bash
   docker compose exec -w /tmp api node /app/apps/api/dist/cli/migrate-sheets.js --file /tmp/sheets.json --replace
   docker compose cp api:/tmp/migration-report.csv .     # 확인 필요 항목(번호 보정·연결 끊김 등)
   ```
   - `--replace`: 기준 콘텐츠 자동 채우기로 이미 들어간 표를 비우고 원본으로 채웁니다(계정은 유지, 홈스테이 가정 계정의 가정 연결은 다시 지정).
   - `--skip-virtual`: 비고에 `가상 …(임시)` 표시가 있는 테스트 데이터 제외
   - 연결 규칙은 기존 앱과 같습니다: 교리실 이름 → 가정 번호(hsid) → 대표자명(동명이면 처음 나오는 가정). 연결하지 못한 값은 **연결 끊김**으로 보존됩니다.
4. 사진: 기존 Drive 썸네일 URL은 그대로 표시됩니다(CSP `img-src`에 Drive 주소 허용). 새로 올리는 사진은 서버 `uploads` 볼륨에 저장됩니다.

---

## 3. 운영

| 작업 | 명령 |
|---|---|
| 관리자 비밀번호 분실 | `docker compose exec api node dist/cli/seed-admin.js admin '새비밀번호'` |
| 수동 백업 | `docker compose exec backup sh /backup.sh` → `./backups/` |
| 복원 | `gunzip -c backups/wyd_YYYYMMDD_HHMM.sql.gz \| docker compose exec -T db psql -U wyd -d wyd` (빈 DB에) |
| 사진 볼륨 백업 | `docker run --rm -v wyd_uploads:/u -v $PWD:/b alpine tar czf /b/uploads.tgz -C /u .` |
| 묵주기도 현황 즉시 수집 | 대시보드의 "지금 동기화"(관리자) |
| 로그 | `docker compose logs -f api` / `web` / `ngrok` |
| 자원 확인 | `docker stats` (db 256MB · api 256MB · web 64MB 상한) |

감사 로그: 모든 추가·수정·삭제·배정은 `audit_log` 표에 누가·언제·무엇을(변경 전후) 기록됩니다.

### 권한

| 역할 | 볼 수 있는 것 | 편집 |
|---|---|---|
| 비로그인 | 대시보드(요약), D-DAY 준비, 일정표, 고리기도, 공지, Q&A(질문 등록 가능), 추천 장소 | Q&A 질문만 |
| 홈스테이 가정 | + 자기 가정과 그 숙박자, 성당시설, 봉사자, 게시판 | 게시판 글(본인 글) |
| 분과 책임자 | + 전체 방문자·가정·봉사자 | 자기 팀 봉사자, 게시판(본인 글) |
| 본당 관리자 | 전체 | 전체 + 계정 관리, 자동 배정, 사진 업로드 |

---

## 4. 개발

```bash
cd v2
npm install
npm run dev:db                    # Docker 없이 로컬 PostgreSQL(포트 54329) — 별도 터미널
cp .env.example .env              # DATABASE_URL=postgres://wyd:wyd@localhost:54329/wyd, COOKIE_SECURE=false, HOST=127.0.0.1
npm run build -w @wyd/shared
npm run dev:api                   # http://127.0.0.1:3000/api
npm run dev:web                   # http://localhost:5173 (/api 프록시)
node apps/api/dist/cli/seed-demo.js [--scale]   # 데모 데이터(--scale: 방문자 1,000·가정 500 추가)
```

테스트:
```bash
npm test                                   # 배정 규칙 단위 테스트(vitest)
npm run test:smoke                         # (API 실행 중) 통합·동시성 테스트
node apps/api/test/smoke.mjs               # 통합·동시성: 정원 4명 방에 50명 동시 배정 → 정확히 4명 성공 등
VUS=50 SECS=30 node apps/api/test/load.mjs # 간이 부하(동시 50명)
k6 run -e BASE=https://<도메인> -e USER=admin -e PASS=… scripts/load/k6-mixed.js
```

### 코드 컨벤션 · 코드리뷰
- 규칙: [`CONVENTIONS.md`](CONVENTIONS.md) — 커밋 전 `npm run check`(포맷·린트·타입·테스트)
- 리뷰: Claude Code 세션을 **`v2/` 폴더에서 열고** `/wyd-code-review`(변경분), `/wyd-code-review --all`(전체), `/wyd-code-review apps/api/src/tables`(경로) 또는 "code-reviewer 에이전트로 리뷰해줘"
  - 스킬: `.claude/skills/wyd-code-review/` (자동 검사 스크립트·체크리스트), 에이전트: `.claude/agents/code-reviewer.md`(읽기 전용)

### API 요약 (`/api`)
| | |
|---|---|
| `GET /data?tables=a,b` | 초기 로딩(권한 있는 표만) |
| `GET/POST /t/:table`, `PATCH/DELETE /t/:table/:id` | 공용 CRUD. PATCH는 `version` 필수(다르면 409 CONFLICT + 최신 행) |
| `POST /t/:table/bulk` | 일괄 저장(최대 200행, 행별 결과) |
| `POST /visitors/assign` · `/visitors/unassign` | 일괄 배정(행별 재검사) · 일괄 해제(orphan/unconfirmed/hs/room/all) |
| `POST /qna/ask` | 비로그인 질문(IP당 10분 5건) |
| `POST /gori/:id/photo?version=` | 고리기도 사진(multipart `file`) |
| `GET /wyd-status`, `POST /wyd-status/sync` | 묵주기도 봉헌 현황 |
| `GET /events` | 실시간 변경 알림(SSE) |
| `POST /auth/login·refresh·logout·password`, `GET /auth/me` | 로그인 |
| `GET/POST/PATCH/DELETE /users` | 계정 관리(관리자) |
| `GET /health` | 상태 확인 |

오류 응답: `{ error: CODE, message, detail? }` — `CONFLICT`(409) · `STAY`/`CAPACITY`(422, 배정 규칙) · `VALIDATION`(400) · `NOTFOUND`(404) · `UNAUTHORIZED`(401) · `FORBIDDEN`(403) · `DUPLICATE`(409) · `RATE_LIMIT`(429)
