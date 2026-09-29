#!/usr/bin/env bash
# Stop — 리뷰되지 않은 코드 변경이나 미해결 🔴가 있으면 종료를 1회 되돌려 리뷰 절차를 알림
source "$(dirname "$0")/lib.sh"
INPUT="$(cat)"
# 이미 한 번 되돌렸으면 통과(무한 루프 방지 — 강제는 커밋 게이트가 담당)
[ "$(jget stop_hook_active)" = "true" ] && exit 0
[ "$(jget permission_mode)" = "plan" ] && exit 0
skip_enabled && exit 0

FP="$(fingerprint)"
[ "$FP" = clean ] && exit 0
SFP="$(state_get fingerprint)"
RED="$(state_get red)"
REPORT="$(state_get reportPath)"
[ "$FP" = "$SFP" ] && [ "${RED:-1}" = 0 ] && exit 0

if [ "$FP" = "$SFP" ]; then
  REASON="최근 코드리뷰(${REPORT})에 🔴 ${RED}건이 남아 있습니다. 🔴 항목을 수정한 뒤 code-reviewer 서브에이전트로 변경분을 다시 리뷰하세요. 사용자에게 질문 중이면 그대로 종료해도 됩니다."
else
  REASON="리뷰되지 않은 코드 변경이 있습니다. 작업 한 단위가 끝났다면 code-reviewer 서브에이전트로 변경분(--changed)을 리뷰하고, 🔴를 수정한 뒤 재리뷰해 🔴 0건을 확인하세요. 아직 작업 중이거나 사용자 확인이 필요하면 그대로 종료해도 됩니다(커밋은 리뷰 통과 전까지 차단됩니다)."
fi
log "stop-gate block fp=${FP:0:12} state=${SFP:0:12} red=${RED}"
REASON="$REASON" node -e 'process.stdout.write(JSON.stringify({ decision: "block", reason: process.env.REASON }))'
exit 0
