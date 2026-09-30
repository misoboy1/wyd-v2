#!/usr/bin/env bash
# 자동 배포 2단계(서버 cron, 5분마다): origin/main의 커밋 중 api·web 이미지가 "둘 다" 준비된 것만 받아 교체
#   등록: crontab -e → */5 * * * * $HOME/wyd/scripts/auto-deploy.sh >> $HOME/wyd-deploy.log 2>&1
#   되돌리기: auto-deploy.sh --pin <커밋 SHA>  (고정 중에는 자동 배포 멈춤) / 해제: auto-deploy.sh --unpin
# - 이미지가 준비되기 전에는 git도 움직이지 않음 → compose·backup.sh와 이미지가 같은 커밋(검사 실패 커밋은 반영 안 됨)
# - 배포한 태그는 .env의 IMAGE_TAG에 기록 → 손으로 `docker compose up -d` 해도 같은 버전(latest·서버 빌드로 새지 않음)
set -uo pipefail
PATH="/usr/local/bin:/usr/bin:/bin:/snap/bin:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
log() { echo "$(date '+%F %T') $*"; }
envval() { sed -n "s/^$1=//p" .env 2>/dev/null | tail -1 | cut -d'#' -f1 | tr -d '[:space:]"'"'"; }
setenv() {
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}

# 이전 실행이 아직 이미지를 받는 중이면 이번 차례는 건너뜀(잠금 파일은 저장소 안 — sudo 실행으로 /tmp 파일 권한이 꼬이는 일 방지)
exec 9>"$ROOT/.deploy.lock"
flock -n 9 || { [ $# -eq 0 ] || echo "다른 배포가 진행 중입니다. 잠시 후 다시 실행하세요."; exit 0; }

command -v docker >/dev/null || { log "중단: docker 명령을 찾을 수 없습니다."; exit 1; }
REPO="$(envval IMAGE_REPO)"
# IMAGE_REPO가 없으면 compose가 e2-micro에서 직접 빌드하려 들므로 중단
if [ -z "$REPO" ]; then
  log "중단: .env에 IMAGE_REPO가 없습니다. docs/CICD.md 4-4단계를 확인하세요."
  exit 1
fi

# 두 이미지를 받음. compose pull은 build:가 있는 서비스의 실패를 경고로만 넘길 수 있어 docker pull로 직접(종료 코드 확실)
pull_both() {
  for a in api web; do
    docker pull -q "$REPO-$a:$1" >/dev/null || { log "중단: 이미지 받기 실패($REPO-$a:$1)."; return 1; }
  done
}
# 셸 환경 변수가 .env보다 우선. --no-build: 서버에서는 절대 빌드하지 않음
up_tag() {
  local out
  if ! out="$(IMAGE_TAG="$1" docker compose up -d --no-build --remove-orphans 2>&1)"; then
    log "실패: docker compose up (${1:0:7})"
    echo "$out"
    return 1
  fi
  setenv IMAGE_TAG "$1"
  # 이전 버전 이미지(태그가 남아 있어 -f만으로는 안 지워짐)까지 정리 — 되돌릴 때는 다시 받아 옴
  docker image prune -af >/dev/null
}

case "${1:-}" in
  --pin)
    sha="${2:-}"
    [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "사용법: $0 --pin <40글자 커밋 SHA>"; exit 1; }
    pull_both "$sha" || exit 1
    up_tag "$sha" || exit 1
    echo "$sha" > "$ROOT/.deploy-pin"
    log "고정: ${sha:0:7} (자동 배포 멈춤 — 해제: $0 --unpin)"
    exit 0
    ;;
  --unpin)
    rm -f "$ROOT/.deploy-pin" "$ROOT/.deploy-wait"
    log "고정 해제 — 최신 버전으로 배포를 시도합니다."
    ;;
  "") ;;
  *)
    echo "사용법: $0 [--pin <커밋 SHA> | --unpin]"
    exit 1
    ;;
esac
[ -f "$ROOT/.deploy-pin" ] && exit 0

if ! git fetch -q origin main; then
  log "중단: git fetch 실패(배포 키·네트워크 확인: ssh -T git@github.com)."
  exit 1
fi
target="$(git rev-parse origin/main)"

# 이미 이 커밋으로 돌고 있으면 끝
running() { docker inspect -f '{{.Config.Image}}' "$(docker compose ps -q "$1" 2>/dev/null)" 2>/dev/null; }
if [ "$(running api)" = "$REPO-api:$target" ] && [ "$(running web)" = "$REPO-web:$target" ]; then
  rm -f "$ROOT/.deploy-wait"
  exit 0
fi

# 두 이미지가 모두 창고에 있는지 확인. 없으면 Actions가 아직 조립 중(또는 검사 실패) — 대기 로그는 커밋당 한 번만
for a in api web; do
  if ! err="$(docker manifest inspect "$REPO-$a:$target" 2>&1 >/dev/null)"; then
    if echo "$err" | grep -qiE 'no such manifest|manifest unknown'; then
      if [ "$(cat "$ROOT/.deploy-wait" 2>/dev/null)" != "$target" ]; then
        log "대기: ${target:0:7} 이미지 준비 전(Actions 진행 중이거나 실패)."
        echo "$target" > "$ROOT/.deploy-wait"
      fi
      exit 0
    fi
    log "중단: 이미지 확인 실패($REPO-$a) — docker login ghcr.io·IMAGE_REPO(소문자) 확인. $err"
    exit 1
  fi
done

# 이미지를 먼저 받고 나서 코드를 옮김 — 받기 실패 시 코드와 이미지가 어긋나지 않게
pull_both "$target" || exit 1
before="$(git rev-parse HEAD)"
if ! git merge --ff-only -q "$target"; then
  log "중단: 코드 갱신 실패(서버에서 파일을 직접 고쳤나요? git status로 확인하세요)."
  exit 1
fi
up_tag "$target" || exit 1
rm -f "$ROOT/.deploy-wait"
log "배포 완료: ${before:0:7} → ${target:0:7}"
