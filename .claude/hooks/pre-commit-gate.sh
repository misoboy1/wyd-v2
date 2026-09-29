#!/usr/bin/env bash
# 커밋 게이트 — "현재 코드 변경분 리뷰 완료 + 🔴 0건 (+ git 모드는 포맷·린트 통과)"일 때만 커밋 허용
#   Claude PreToolUse(Bash): stdin JSON, git commit 명령일 때만 검사, 거부는 JSON
#   --git: .githooks/pre-commit에서 호출(사람 커밋 포함), 거부는 stderr + exit 1
source "$(dirname "$0")/lib.sh"
MODE=claude; [ "${1:-}" = "--git" ] && MODE=git

if [ "$MODE" = claude ]; then
  INPUT="$(cat)"
  CMD="$(jget tool_input.command)"
  CMD="$CMD" node -e 'process.exit(/(^|[\s;&|(])git(\s+-{1,2}[\w-]+(\s+[^\s-]\S*)?)*\s+commit\b/.test(process.env.CMD) ? 0 : 1)' || exit 0
fi

deny() {
  log "commit-gate($MODE) deny: $1"
  if [ "$MODE" = git ]; then
    printf '%s\n우회(긴급 시만): WYD_SKIP_REVIEW=1 git commit … 또는 git commit --no-verify\n' "$1" >&2
    exit 1
  fi
  REASON="$1" node -e 'process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse",
    permissionDecision: "deny", permissionDecisionReason: process.env.REASON } }))'
  exit 0
}
if skip_enabled; then log "commit-gate($MODE) skipped (WYD_SKIP_REVIEW)"; exit 0; fi

FP="$(fingerprint)"
[ "$FP" = clean ] && exit 0
SFP="$(state_get fingerprint)"; RED="$(state_get red)"; REPORT="$(state_get reportPath)"
[ "$FP" = "$SFP" ] || deny "커밋 차단: 현재 코드 변경분이 리뷰되지 않았습니다(리뷰 이후 코드가 바뀜 포함). code-reviewer 서브에이전트로 변경분을 리뷰하고 🔴 0건을 확인한 뒤 커밋하세요."
[ "${RED:-1}" = 0 ] || deny "커밋 차단: 최근 리뷰(${REPORT})에 🔴 ${RED}건이 남아 있습니다. 수정 후 재리뷰하세요."

# 포맷·린트는 git 모드에서만(Claude 커밋도 결국 git 훅을 거치므로 중복 실행 방지)
[ "$MODE" = git ] || exit 0
cd "$ROOT" || exit 0
OUT="$( { npm run -s format:check && npm run -s lint; } 2>&1 )" || deny "커밋 차단: 포맷/린트 실패(npm run format:check && npm run lint):
$(echo "$OUT" | tail -20)"
exit 0
