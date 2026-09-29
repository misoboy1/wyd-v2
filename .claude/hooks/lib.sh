#!/usr/bin/env bash
# 훅 공통 함수 — 입력 JSON 파싱, 코드 변경 지문(fingerprint), 리뷰 상태 파일 관리
# 저장소 루트는 스크립트 위치 기준(상위 폴더에서 claude를 띄워도 v2를 가리키도록)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="$ROOT/.claude/state"
STATE="$STATE_DIR/review.json"
REVIEW_DIR="$ROOT/.claude/reviews"
mkdir -p "$STATE_DIR"

# stdin JSON에서 점 경로 값 추출: jget tool_input.file_path
jget() {
  INPUT_JSON="$INPUT" node -e '
    let v; try { v = JSON.parse(process.env.INPUT_JSON || "{}"); } catch { v = {}; }
    for (const k of process.argv[1].split(".")) v = v == null ? undefined : v[k];
    process.stdout.write(v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));' "$1"
}

# 리뷰 대상 코드 변경의 지문. 변경이 없으면 "clean"
# 문서(*.md)·.claude 설정은 리뷰 대상이 아니므로 제외
# 커밋 중 git이 넘기는 임시 인덱스(GIT_INDEX_FILE)는 무시 — 새 파일 목록이 달라져 지문이 흔들림
# 새 파일은 스테이징 여부와 무관하게 같은 방식(경로+내용)으로 센다 — git add 전후로 지문이 바뀌면 리뷰 통과 코드도 커밋이 막힘
fingerprint() {
  local diff untracked
  diff="$(env -u GIT_INDEX_FILE git -C "$ROOT" diff HEAD --no-ext-diff --diff-filter=a -- . ':(exclude).claude' ':(exclude)*.md' 2>/dev/null)"
  untracked="$( {
    env -u GIT_INDEX_FILE git -C "$ROOT" ls-files --others --exclude-standard -- . ':(exclude).claude' ':(exclude)*.md'
    env -u GIT_INDEX_FILE git -C "$ROOT" diff HEAD --name-only --diff-filter=A -- . ':(exclude).claude' ':(exclude)*.md'
  } 2>/dev/null | sort -u)"
  if [ -z "$diff" ] && [ -z "$untracked" ]; then echo clean; return; fi
  {
    printf '%s\n' "$diff"
    printf '%s\n' "$untracked" | while IFS= read -r f; do [ -f "$ROOT/$f" ] && { echo "== $f"; cat "$ROOT/$f"; }; done
  } | shasum -a 256 | cut -d' ' -f1
}

# 상태 파일 필드 읽기: state_get red
state_get() {
  [ -f "$STATE" ] || return 0
  node -e '
    try { const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); const v = s[process.argv[2]];
      process.stdout.write(v == null ? "" : String(v)); } catch {}' "$STATE" "$1"
}

# 긴급 우회: WYD_SKIP_REVIEW=1 또는 .claude/state/skip 파일
skip_enabled() { [ "${WYD_SKIP_REVIEW:-}" = 1 ] || [ -f "$STATE_DIR/skip" ]; }

log() { echo "$(date '+%F %T') $*" >> "$STATE_DIR/hooks.log"; }
