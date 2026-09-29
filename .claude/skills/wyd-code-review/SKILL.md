---
name: wyd-code-review
description: WYD v2(중계양업성당 WYD 관리 프로그램) 코드리뷰. 린트(ESLint·Prettier·tsc·테스트) 자동 검사 + CONVENTIONS.md 컨벤션 검토 + 정확성·보안 점검 후 한국어 보고서 작성. "코드리뷰", "리뷰해줘", "변경사항 검토", "PR 검토", "컨벤션 확인" 요청 시 사용. 인자: 경로들 | --changed(기본, git 변경분) | --all(전체)
---

# WYD v2 코드리뷰

**읽기 전용 리뷰**입니다. 리뷰 중에는 어떤 파일도 수정·포맷·커밋하지 않습니다(`lint:fix`, `format` 실행 금지). 수정은 보고서를 본 사용자가 결정합니다.

저장소 루트(`git rev-parse --show-toplevel`, 즉 `v2/`)에서 진행합니다. 기준 문서:
- `CONVENTIONS.md` — 규칙 ID(G-·API-·WEB-·SEC-·TEST-). 보고서는 반드시 ID를 인용
- `references/checklist.md` (이 스킬 폴더) — 영역별 점검 항목

## 1. 범위 정하기
- 인자가 경로면 그 경로만
- `--all`이면 전체
- 없거나 `--changed`면 git 변경분: `git diff --stat HEAD` + untracked. 변경이 없으면 사용자에게 알리고 `--all` 제안 후 종료
- 변경분 리뷰라도 **변경된 함수가 호출하는 코드·호출하는 쪽**은 필요한 만큼 읽어 맥락을 확인

## 2. 자동 검사 (린트) — 반드시 실행
```bash
bash .claude/skills/wyd-code-review/scripts/review-checks.sh <--all | --changed | 경로…>
```
Prettier 포맷 · ESLint(규칙별 집계 + 위치) · TypeScript(전체) · 단위 테스트 결과를 표로 출력합니다. 스크립트가 실패하면(도구 미설치 등) 원인을 보고서에 적고 가능한 검사는 개별 실행하세요(`npx prettier --check`, `npx eslint`, `npm run typecheck`, `npm test`).

해석 원칙:
- 린트 **오류**는 🔴 또는 🟠로 발견 사항에 포함. 같은 규칙이 여러 곳이면 한 항목으로 묶고 위치 나열
- ESLint 메시지의 `[WEB-02]` 같은 태그는 CONVENTIONS 규칙 ID — 그대로 인용
- 자동 수정 가능한 항목(포맷, `prefer-const`, 불필요한 단언 등)은 "`npm run lint:fix` / `npm run format`으로 일괄 수정 가능"이라고 표시

## 3. 컨벤션 검토 — 반드시 실행
범위 파일을 **실제로 읽고** `CONVENTIONS.md`의 🤖 없는 규칙(사람이 판단하는 규칙)과 `references/checklist.md`의 해당 영역을 대조합니다. 특히:
- API: TablesService 경유(API-01), version·emit 누락, registry 권한(API-02), 오류 코드(API-03), 행 잠금·순서(API-05), 마이그레이션 동반(API-07), 스키마 동기화(API-10)
- WEB: data 훅 사용(WEB-04), canWrite(WEB-06), memo(WEB-08), 접근성(WEB-09)
- 공통: shared 중복 금지(G-03), 주석(G-01), 메시지(G-07)
유용한 grep 예: `db\.(insert|update|delete)\(` in `apps/api/src` (API-01), `#[0-9a-fA-F]{6}` in `apps/web/src` (WEB-02), `useState\(.*rows` (서버 데이터 복제)

## 4. 정확성·보안 점검
버그 가능성이 큰 곳을 우선: 동시성(버전·잠금), 권한 우회, 개인정보 노출(SEC-01), 입력 검증, 1,000명 규모 성능. 추측은 🔴로 올리지 말고 "확인 필요"로 표시. 확인 방법(재현 입력·쿼리)을 함께 적습니다.

## 5. 보고서 (한국어, 이 형식 그대로)

```markdown
# 코드리뷰 보고서 — <범위> (<날짜>)

## 요약
<3줄 이내: 전체 상태, 가장 중요한 문제, 머지/배포 가능 여부>

## 자동 검사
| 검사 | 결과 | 비고 |   ← review-checks.sh 표 그대로

## 발견 사항
### 🔴 반드시 수정 (버그·보안·데이터 손상·검사 실패)
1. **[규칙 ID 또는 ESLint 규칙] 제목** — `파일:줄`
   - 문제: …
   - 영향: …(구체적 시나리오)
   - 수정 제안: …(코드 조각 가능)
### 🟠 수정 권장 (컨벤션 위반·유지보수성·성능)
### 🟡 사소함 (스타일·명명·주석)

## 컨벤션 준수 현황
| 영역 | 확인한 규칙 | 위반 |
|---|---|---|
| 공통(G) | … | n건 |
| API | … | n건 |
| WEB | … | n건 |
| SEC | … | n건 |

## 잘된 점
- 1~3개

## 다음 단계
- 자동 수정 가능: `npm run lint:fix && npm run format` (n건)
- 수동 수정 필요: 🔴 n건, 🟠 n건
```

규칙:
- 모든 발견 사항에 `파일:줄` + 규칙 ID(없으면 "일반")를 붙임
- 같은 유형은 묶어서 한 번만, 대표 위치 + "외 n곳"
- 확인하지 못한 것은 확인하지 못했다고 적음(예: "Docker 빌드는 실행하지 않음")
