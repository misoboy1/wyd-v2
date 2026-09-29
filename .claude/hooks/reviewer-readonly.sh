#!/usr/bin/env bash
# PreToolUse(Bash) — code-reviewer 서브에이전트는 읽기 전용: 파일·git 상태를 바꾸는 명령 차단
source "$(dirname "$0")/lib.sh"
INPUT="$(cat)"
[ "$(jget agent_type)" = "code-reviewer" ] || exit 0
CMD="$(jget tool_input.command)"
HIT="$(CMD="$CMD" node -e '
  const c = process.env.CMD;
  const rules = [
    [/--fix\b|--write\b|\s-w\b.*prettier|prettier.*\s-w\b/, "자동 수정 옵션"],
    [/\bnpm\s+run\s+(-s\s+)?(lint:fix|format)(\s|$|;|&)/, "수정 스크립트"],
    [/\bgit\s+(commit|checkout|reset|stash|add|restore|clean|push|rebase|merge|switch|rm|mv|apply|cherry-pick)\b/, "git 상태 변경"],
    [/(^|[\s;&|])(rm|mv|cp|touch|mkdir|chmod|tee|truncate)\s/, "파일 변경 명령"],
    [/\bsed\s+(-[a-zA-Z]*i|--in-place)/, "sed 제자리 수정"],
    [/(^|\s)\d?>>?\s*(?!&|\/dev\/null)[^\s>]/, "파일 리다이렉션"],
    [/\bdrizzle-kit\s+(generate|push|migrate)|db:migrate|seed:|migrate:sheets/, "DB·마이그레이션 변경"],
  ];
  const hit = rules.find(([re]) => re.test(c));
  process.stdout.write(hit ? hit[1] : "");')"
[ -z "$HIT" ] && exit 0
log "reviewer-readonly deny ($HIT): $CMD"
REASON="code-reviewer는 읽기 전용입니다(${HIT} 차단). 수정 제안은 보고서에만 적으세요. 조회 목적이면 파일을 쓰지 않는 방식으로 다시 실행하세요." \
  node -e 'process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse",
    permissionDecision: "deny", permissionDecisionReason: process.env.REASON } }))'
exit 0
