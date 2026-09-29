#!/usr/bin/env bash
# SubagentStop(code-reviewer) — 리뷰 보고서 저장 + 🔴/🟠 집계 + 리뷰 시점 코드 지문 기록
source "$(dirname "$0")/lib.sh"
INPUT="$(cat)"
printf '%s\n' "$INPUT" > "$STATE_DIR/last-subagent-stop.json"  # 입력 필드 확인용(디버그)
[ "$(jget agent_type)" = "code-reviewer" ] || exit 0
mkdir -p "$REVIEW_DIR"
AID="$(jget agent_id)"; REPORT="$REVIEW_DIR/$(date '+%Y%m%d-%H%M%S')${AID:+-${AID:0:8}}.md"

# 보고서 본문: last_assistant_message → agent_transcript_path → <세션>/subagents/agent-<id>.jsonl 순으로 탐색
RESULT="$(INPUT_JSON="$INPUT" node - "$REPORT" <<'NODE'
const fs = require("fs"), path = require("path");
const inp = JSON.parse(process.env.INPUT_JSON || "{}");
let text = typeof inp.last_assistant_message === "string" ? inp.last_assistant_message : "";
if (!text) {
  let tp = inp.agent_transcript_path;
  if (!tp && inp.transcript_path && inp.agent_id) tp = path.join(inp.transcript_path.replace(/\.jsonl$/, ""), "subagents", `agent-${inp.agent_id}.jsonl`);
  try {
    const lines = fs.readFileSync(tp, "utf8").trim().split("\n");
    for (let i = lines.length - 1; i >= 0 && !text; i--) {
      const l = JSON.parse(lines[i]);
      if (l.type !== "assistant" || !Array.isArray(l.message?.content)) continue;
      text = l.message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    }
  } catch {}
}
if (!text) { console.log("none"); process.exit(0); }
fs.writeFileSync(process.argv[2], text);
// 1순위: 기계 판독용 마지막 줄 "REVIEW_RESULT: red=N orange=N yellow=N"
const m = text.match(/REVIEW_RESULT:\s*red=(\d+)\s+orange=(\d+)(?:\s+yellow=(\d+))?/);
if (m) { console.log(`${m[1]} ${m[2]}`); process.exit(0); }
// 2순위: "### 🔴" 절의 번호 항목 수
const count = (emoji) => {
  const sec = text.split(/^#{2,4}\s/m).find((s) => s.startsWith(emoji));
  return sec ? (sec.match(/^\s*\d+\.\s/gm) || []).length : null;
};
const r = count("🔴"), o = count("🟠");
console.log(r == null ? "unparsed" : `${r} ${o ?? 0}`);
NODE
)"

case "$RESULT" in
  none)
    log "save-review: 보고서 본문을 찾지 못함"; exit 0 ;;
  unparsed)
    log "save-review: 🔴 집계 실패 ${REPORT}"
    # 리뷰어가 형식을 빠뜨렸으면 한 번만 되돌려 판독 줄을 추가하게 함
    [ "$(jget stop_hook_active)" = "true" ] && exit 0
    echo "보고서 마지막 줄에 'REVIEW_RESULT: red=<🔴 건수> orange=<🟠 건수> yellow=<🟡 건수>'를 추가해 보고서 전체를 다시 출력하세요." >&2
    exit 2 ;;
esac
RED="${RESULT% *}"; ORANGE="${RESULT#* }"
FP="$(fingerprint)"
FP="$FP" RED="$RED" ORANGE="$ORANGE" REPORT="${REPORT#"$ROOT"/}" node -e '
  const e = process.env;
  require("fs").writeFileSync(process.argv[1], JSON.stringify({ fingerprint: e.FP, red: +e.RED, orange: +e.ORANGE,
    reportPath: e.REPORT, reviewedAt: new Date().toISOString() }, null, 2) + "\n");' "$STATE"
log "save-review red=$RED orange=$ORANGE fp=${FP:0:12} ${REPORT#"$ROOT"/}"
exit 0
