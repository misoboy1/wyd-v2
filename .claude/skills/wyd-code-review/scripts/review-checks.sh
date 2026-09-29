#!/usr/bin/env bash
# 코드리뷰 자동 검사 실행기 — 실패해도 끝까지 돌고 요약만 출력(리뷰어가 해석)
# 사용: review-checks.sh --all | --changed | <파일·폴더…>
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

MODE="${1:---changed}"
if [ "$MODE" = "--all" ]; then
  SCOPE=(.)
  echo "## 범위: 전체"
elif [ "$MODE" = "--changed" ]; then
  SCOPE=()  # macOS 기본 bash 3.2 호환(mapfile 없음)
  while IFS= read -r f; do [ -f "$f" ] && SCOPE+=("$f"); done < <( { git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | sort -u | grep -E '\.(ts|tsx|js|mjs|json|css)$' )
  if [ ${#SCOPE[@]} -eq 0 ]; then echo "## 범위: 변경된 코드 파일 없음 (git diff HEAD 기준) — --all 또는 경로를 지정하세요"; exit 0; fi
  echo "## 범위: 변경 파일 ${#SCOPE[@]}개"; printf -- '- %s\n' "${SCOPE[@]}"
else
  SCOPE=("$@")
  echo "## 범위: $*"
fi
echo

status() { [ "$1" -eq 0 ] && echo "✅ 통과" || echo "❌ 실패"; }

# 1) Prettier
npx --no-install prettier --check "${SCOPE[@]}" --log-level warn > "$TMP/fmt.txt" 2>&1; FMT=$?
FMT_N=$(grep '^\[warn\] ' "$TMP/fmt.txt" | grep -vc 'Code style issues' | tr -d ' ')

# 2) ESLint (JSON → 규칙별·파일별 요약)
npx --no-install eslint "${SCOPE[@]}" --format json -o "$TMP/lint.json" --no-error-on-unmatched-pattern > "$TMP/lint.err" 2>&1; LINT=$?
node - "$TMP/lint.json" "$ROOT" > "$TMP/lint.md" <<'NODE'
const fs = require("fs"); const [file, root] = process.argv.slice(2);
let r = []; try { r = JSON.parse(fs.readFileSync(file, "utf8")); } catch { console.log("(ESLint JSON 없음 — 설정 오류일 수 있음)"); process.exit(0); }
const byRule = {}; let e = 0, w = 0; const lines = [];
for (const f of r) for (const m of f.messages) {
  const id = m.ruleId || "parse-error"; byRule[id] = byRule[id] || { e: 0, w: 0 };
  if (m.severity === 2) { e++; byRule[id].e++; } else { w++; byRule[id].w++; }
  lines.push(`${m.severity === 2 ? "E" : "W"} ${f.filePath.replace(root + "/", "")}:${m.line}:${m.column} [${id}] ${m.message.replace(/\s+/g, " ").slice(0, 180)}`);
}
console.log(`오류 ${e} · 경고 ${w}`);
if (e + w) {
  console.log("\n| 규칙 | 오류 | 경고 |\n|---|---|---|");
  Object.entries(byRule).sort((a, b) => b[1].e + b[1].w - (a[1].e + a[1].w)).forEach(([k, v]) => console.log(`| ${k} | ${v.e} | ${v.w} |`));
  console.log("\n```"); lines.slice(0, 300).forEach((l) => console.log(l)); if (lines.length > 300) console.log(`… 외 ${lines.length - 300}건`); console.log("```");
}
NODE

# 3) 타입 검사(프로젝트 전체 — 타입은 파일 간 영향이 있어 범위와 무관하게 전체)
npm run -s typecheck > "$TMP/tsc.txt" 2>&1; TSC=$?
TSC_N=$(grep -c 'error TS' "$TMP/tsc.txt" | tr -d ' ')

# 4) 단위 테스트
npm test -s > "$TMP/test.txt" 2>&1; TEST=$?

echo "## 자동 검사 요약"
echo "| 검사 | 결과 | 비고 |"
echo "|---|---|---|"
echo "| Prettier 포맷 | $(status $FMT) | 포맷 불일치 ${FMT_N:-0}개 파일 |"
echo "| ESLint | $(status $LINT) | $(head -1 "$TMP/lint.md") |"
echo "| TypeScript | $(status $TSC) | 오류 ${TSC_N}건 |"
echo "| 단위 테스트 | $(status $TEST) | $(grep -E 'Tests +[0-9]' "$TMP/test.txt" | tail -1 | sed 's/^ *//') |"
echo
if [ "$FMT" -ne 0 ]; then echo "### Prettier 불일치 파일"; grep '^\[warn\]' "$TMP/fmt.txt" | grep -v 'Code style issues' | sed 's/^\[warn\] /- /'; echo; fi
echo "### ESLint 상세"; tail -n +2 "$TMP/lint.md"; [ -s "$TMP/lint.err" ] && { echo; echo "ESLint 실행 메시지:"; head -20 "$TMP/lint.err"; }; echo
if [ "$TSC" -ne 0 ]; then echo "### TypeScript 오류"; grep 'error TS' "$TMP/tsc.txt" | head -50; echo; fi
if [ "$TEST" -ne 0 ]; then echo "### 테스트 실패"; tail -40 "$TMP/test.txt"; echo; fi
exit 0
