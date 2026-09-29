#!/usr/bin/env bash
# PostToolUse(Edit|Write|MultiEdit) — 편집한 파일에 Prettier 적용 후 ESLint. 오류는 Claude에게 되돌려 즉시 수정하게 함
source "$(dirname "$0")/lib.sh"
INPUT="$(cat)"
FILE="$(jget tool_input.file_path)"
case "$FILE" in "$ROOT"/*) ;; *) exit 0 ;; esac
case "$FILE" in */node_modules/* | */dist/* | "$ROOT"/.claude/*) exit 0 ;; esac
[ -f "$FILE" ] || exit 0
cd "$ROOT" || exit 0

# 포맷은 의미를 바꾸지 않으므로 자동 적용(.prettierignore 대상은 prettier가 건너뜀)
if echo "$FILE" | grep -Eq '\.(ts|tsx|js|mjs|cjs|json|css)$'; then
  npx --no-install prettier --write --log-level silent --ignore-unknown "$FILE" >/dev/null 2>&1
fi

echo "$FILE" | grep -Eq '\.(ts|tsx|js|mjs|cjs)$' || exit 0
# --fix는 쓰지 않음(의미가 바뀔 수 있는 수정은 Claude가 판단)
OUT="$(npx --no-install eslint --no-error-on-unmatched-pattern --no-warn-ignored "$FILE" 2>&1)"; RC=$?
if [ $RC -eq 1 ]; then
  {
    echo "ESLint 오류 — ${FILE#"$ROOT"/}. [규칙 ID]는 CONVENTIONS.md 참고, 지금 수정하세요:"
    echo "$OUT" | grep -E '^\s+[0-9]+:[0-9]+' | head -30
  } >&2
  exit 2
elif [ $RC -ne 0 ]; then
  # 설정 오류 등은 편집을 막지 않고 사용자에게만 표시
  echo "ESLint 실행 실패(${FILE#"$ROOT"/}): $(echo "$OUT" | head -3)" >&2
  exit 1
fi
exit 0
