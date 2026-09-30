# 자동 배포 켜기 — 고친 코드가 서버에 저절로 반영되게 하기

[DEPLOY-GCP.md](DEPLOY-GCP.md)로 서버를 한 번 올린 다음 보는 가이드예요.
이걸 설정해 두면, 앞으로는 **내 Mac에서 `git push` 한 번**으로 끝나요. 나머지는 자동이에요.

- 걸리는 시간: 처음 설정만 **약 1시간**. 그다음부터는 push하고 **10분쯤 기다리면** 반영돼요.
- 비용: GitHub **무료 플랜** 안에서 동작해요([7단계](#7단계-비용과-한도) 참고).
- 1~3단계는 **내 Mac**에서, 4단계는 **서버(SSH 창)** 에서 해요. 단계마다 어디서 하는지 적어 뒀어요.

---

## 0. 전체 그림

빵집에 비유해 볼게요.

| 실제 | 비유 | 하는 일 |
|---|---|---|
| **GitHub 저장소** | 레시피 보관함 | 고친 코드를 올려 두는 곳 |
| **GitHub Actions** | 빵 공장 | 코드가 올라오면 검사하고, 프로그램(이미지)을 조립해요 |
| **GHCR**(GitHub 이미지 창고) | 빵 창고 | 다 만든 프로그램을 보관해요 |
| **서버의 자동 확인(cron)** | 5분마다 창고를 보러 오는 배달원 | 새 빵이 있으면 가져와서 진열대(서버)를 바꿔요 |

```
 내 Mac: 고치기 → 코드리뷰 → 커밋 → git push
        │
        ▼
 GitHub Actions(공장): ① 검사(npm run check) ② api·web 조립 ③ 창고(GHCR)에 넣기   … 약 5~8분
        │
        ▼
 GCP 서버(배달원, 5분마다): 새 버전 있나? → 있으면 받아서 교체                     … 최대 5분
```

**좋아지는 점**

- 서버에서 조립(빌드)하지 않아요. 약한 e2-micro가 10~20분씩 힘들어하거나 메모리 부족으로 멈추는 일이 없어져요.
- 검사에 떨어진 코드는 창고에 들어가지 않아요. 그래서 **서버에도 반영되지 않아요**(안전장치).
- 서버는 **화면(web)과 두뇌(api)가 둘 다 준비된 버전**만 가져가요. 둘이 서로 다른 버전으로 섞여 뜨는 일이 없어요.
- 서버 문(SSH)을 열거나 서버 열쇠를 GitHub에 맡기지 않아요. 서버가 **스스로 가져가는** 방식이라 더 안전해요.

---

## 1단계. GitHub 가입하고 비공개 저장소 만들기 (10분, 브라우저)

1. https://github.com 에서 **Sign up**으로 가입해요. 이미 계정이 있으면 로그인해요.
   - 📝 **내 GitHub 아이디**(Username)를 메모해 두세요. 앞으로 여러 번 써요.
2. 오른쪽 위 **+** → **New repository**를 눌러요.
3. 아래처럼 채워요.

| 항목 | 값 |
|---|---|
| Repository name | `wyd-v2` |
| 공개 범위 | **Private** ⚠️ 꼭 비공개! (주소·연락처를 다루는 프로그램이에요) |
| Add a README file | **체크하지 않기** |
| .gitignore / license | **None** 그대로 |

4. **Create repository**를 눌러요. 저장소 주소는 `https://github.com/내아이디/wyd-v2` 예요.

---

## 2단계. Mac에서 코드 올리기 (10분, Mac 터미널)

### 2-1. GitHub 로그인 도구 설치

```bash
brew install gh
gh auth login
```

`gh auth login`은 질문을 몇 개 해요. 방향키로 고르고 엔터를 누르세요.

| 질문 | 고를 것 |
|---|---|
| Where do you use GitHub? | **GitHub.com** |
| Preferred protocol | **HTTPS** |
| Authenticate Git with your GitHub credentials? | **Yes** |
| How would you like to authenticate? | **Login with a web browser** |

화면에 나온 **8자리 코드**를 복사하고 엔터를 누르면 브라우저가 열려요. 코드를 붙여 넣고 **Authorize**를 누르면 끝이에요.

### 2-2. 저장소 연결하고 올리기

`내아이디`를 1단계에서 메모한 아이디로 바꿔서 붙여 넣으세요.

```bash
cd ~/Downloads/WYD/v2
git remote add origin https://github.com/내아이디/wyd-v2.git
git push -u origin main
```

브라우저에서 저장소 페이지를 새로고침했을 때 파일 목록(`apps`, `docs`, `docker-compose.yml` …)이 보이면 성공이에요.

---

## 3단계. 공장(Actions)이 잘 돌았는지 확인 (10분 기다리기, 브라우저)

1. 저장소 페이지 위쪽 **Actions** 탭을 눌러요.
2. **deploy**라는 작업이 돌고 있어요. 🟡 노란 원은 진행 중, ✅ 초록 체크는 성공, ❌ 빨간 X는 실패예요.
3. 처음에는 **5~10분** 걸려요. ✅가 뜰 때까지 기다려요.
4. 저장소 첫 화면 오른쪽 **Packages**에 **`wyd-api`**, **`wyd-web`** 두 개가 생겼는지 확인해요. 이게 창고에 들어간 프로그램이에요.

> ❌가 떴다면 눌러서 빨간 줄의 오류 문장을 확인하세요. **check** 단계 실패는 코드 검사에 떨어진 거예요.
> Mac에서 `npm run check`를 돌려 고친 뒤 다시 커밋하고 push하면 돼요.

---

## 4단계. 서버가 스스로 가져가게 설정하기 (30분, SSH 창)

여기부터는 **GCP의 SSH 창**에서 해요. 서버에 **열쇠 두 개**를 만들어 줄 거예요.

| 열쇠 | 용도 | 권한 |
|---|---|---|
| **배포 키**(Deploy key) | 저장소의 설정 파일(`docker-compose.yml` 등) 읽기 | 이 저장소 하나만, **읽기만** |
| **창고 토큰**(PAT) | GHCR 창고에서 프로그램 꺼내기 | 창고 **읽기만** |

둘 다 "읽기만" 할 수 있어서, 서버가 해킹당해도 코드를 망가뜨릴 수는 없어요.

### 4-1. 배포 키 만들기

```bash
ssh-keygen -t ed25519 -f ~/.ssh/wyd_deploy -N "" -C wyd-server
cat ~/.ssh/wyd_deploy.pub
```

마지막 줄에 `ssh-ed25519 AAAA... wyd-server`처럼 한 줄이 나와요. **그 한 줄 전체**를 복사해요.

브라우저에서 등록해요.

1. 저장소 → **Settings** → 왼쪽 **Deploy keys** → **Add deploy key**
2. Title: `wyd-server`, Key: 방금 복사한 한 줄
3. **Allow write access는 체크하지 않기** → **Add key**

다시 SSH 창으로 돌아와서, GitHub에 접속할 때 이 열쇠를 쓰라고 알려 줘요.

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/wyd_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
ssh -T git@github.com
```

`Are you sure you want to continue connecting (yes/no)?`가 나오면 **`yes`** 를 입력하고 엔터를 눌러요.
`Hi 내아이디/wyd-v2! You've successfully authenticated...`가 나오면 성공이에요. (뒤에 나오는 "does not provide shell access"는 정상이에요.)

### 4-2. 창고 토큰 만들고 로그인하기

먼저 브라우저에서 토큰을 만들어요.

1. GitHub 오른쪽 위 내 사진 → **Settings** → 맨 아래 **Developer settings**
2. **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
3. Note: `wyd-server-ghcr`, Expiration: **No expiration**(또는 1년. 만료되면 다시 만들어야 해요)
4. 권한은 **`read:packages` 하나만** 체크 → **Generate token**
5. `ghp_...`로 시작하는 토큰을 **바로 복사**해요. 이 화면을 벗어나면 다시 볼 수 없어요.

SSH 창에서 로그인해요. 먼저 아래 첫 줄을 붙여 넣고 엔터를 누른 뒤, **토큰을 붙여 넣고 엔터**를 눌러요.
(화면에 아무것도 안 보여도 입력된 거예요. 토큰이 명령 기록에 남지 않게 하려는 방법이에요.)
그다음 둘째 줄의 `내아이디`를 바꿔서 붙여 넣으세요.

```bash
read -rs T
echo "$T" | docker login ghcr.io -u 내아이디 --password-stdin; unset T
```

`Login Succeeded`가 나오면 성공이에요.
("unencrypted" 경고는 서버에 로그인 정보를 저장했다는 안내라 괜찮아요. 토큰이 읽기 전용이라 안전해요.)

### 4-3. 서버 폴더를 저장소와 연결하기

지금 서버의 `~/wyd`는 압축을 푼 폴더예요. 이걸 GitHub 저장소와 연결된 폴더로 바꿔요.
`.env`(비밀 쪽지)와 `backups`(백업)는 저장소에 없는 파일이라 **그대로 남아요**.

```bash
cd ~/wyd
git init -q -b main
git remote add origin git@github.com:내아이디/wyd-v2.git
git fetch -q origin
git checkout -f -B main --track origin/main
git status
```

마지막에 `Your branch is up to date with 'origin/main'`과 `nothing to commit`이 보이면 성공이에요.

> ❗ `git: command not found`가 나오면 `sudo apt-get install -y git`으로 설치한 뒤 다시 해요.

### 4-4. .env에 창고 주소 적기

`내아이디`는 **소문자로** 적어야 해요(예: `Jinxiangxiu911` → `jinxiangxiu911`).

```bash
echo 'IMAGE_REPO=ghcr.io/내아이디/wyd' >> ~/wyd/.env
tail -2 ~/wyd/.env
```

### 4-5. 창고 버전으로 처음 바꿔 끼우기

지금 돌고 있는 프로그램은 서버에서 직접 조립한 거예요. 자동 배포 스크립트를 한 번 직접 실행해서 창고 버전으로 바꿔요.
(3단계에서 Actions가 ✅여야 해요.)

```bash
~/wyd/scripts/auto-deploy.sh
docker compose -f ~/wyd/docker-compose.yml ps
```

- `배포 완료: abc1234 → abc1234` 같은 줄이 나오면 성공이에요.
- `대기: abc1234 이미지 준비 전`이 나오면 Actions가 아직 안 끝난 거예요. ✅가 뜬 뒤 다시 실행하세요.
- `docker compose ps`에서 5개가 모두 `Up`이고, `db`·`api`·`web`은 `(healthy)`면 정상이에요(ngrok·backup에는 healthy 표시가 없어요).
- `중단: ...`이 나오면 [문제 해결](#8단계-문제가-생겼어요)을 보세요.

브라우저로 ngrok 주소에 들어가서 화면이 잘 나오는지 확인하세요. 데이터(DB·사진)는 그대로예요.

예전에 서버에서 조립하며 쌓인 찌꺼기를 치워 디스크 공간을 확보해요.

```bash
docker image prune -af
docker builder prune -af
```

### 4-6. 5분마다 자동 확인 켜기

4-5에서 한 번 실행해 봤으니, 이제 5분마다 자동으로 돌도록 등록해요.

```bash
(crontab -l 2>/dev/null; echo '*/5 * * * * $HOME/wyd/scripts/auto-deploy.sh >> $HOME/wyd-deploy.log 2>&1') | crontab -
crontab -l
```

마지막 줄에 `*/5 * * * * $HOME/wyd/scripts/auto-deploy.sh ...`가 보이면 설정 끝이에요. 🎉

---

## 5단계. 이제부터 평소에 고칠 때

**내 Mac에서** 이것만 하면 돼요.

1. 코드 고치기
2. 코드리뷰 받기(Claude Code에서 "코드리뷰 해줘" → 🔴 0건 확인)
3. 커밋하기
4. 올리기:

```bash
cd ~/Downloads/WYD/v2
git push
```

5. GitHub **Actions** 탭에서 ✅를 확인해요(5~8분).
6. ✅ 뒤 **최대 5분** 안에 서버가 새 버전으로 바뀌어요. 브라우저를 새로고침해서 확인하세요.

**서버에 반영됐는지 확실히 보고 싶으면** SSH 창에서:

```bash
tail -20 ~/wyd-deploy.log
```

| 로그 | 뜻 |
|---|---|
| `대기: def5678 이미지 준비 전` | push는 들어왔고 Actions가 아직 조립 중이에요. 기다리면 돼요 |
| `배포 완료: abc1234 → def5678` | 새 버전으로 바뀌었어요 ✅ |
| (아무 줄도 없음) | 바뀐 게 없어서 조용히 넘어갔어요 |

> 💡 Actions가 ❌로 실패한 커밋은 계속 `대기`로 남고 서버에 반영되지 않아요. 고쳐서 다시 push하면 새 커밋이 반영돼요.
>
> 로그 파일이 너무 커지면 `: > ~/wyd-deploy.log`로 비울 수 있어요.

> ⚠️ 이제부터 **서버(SSH 창)에서 파일을 직접 고치지 마세요.** 고칠 건 Mac에서 고쳐서 push하세요.
> 서버에서 직접 고치면 자동 반영이 멈춰요(`코드 갱신 실패`). 예외는 `.env`뿐이에요. 저장소에 없는 파일이라 괜찮아요.
> 단, `.env`의 `IMAGE_TAG` 줄은 스크립트가 **지금 돌고 있는 버전**을 자동으로 적어 두는 칸이니 건드리지 마세요.
> 덕분에 `docker compose up -d`나 `docker compose restart`를 손으로 해도 같은 버전으로 켜져요.
> 반대로 `docker compose up -d --build`나 `docker compose pull`은 쓰지 마세요.

---

## 6단계. 새 버전에 문제가 있어서 되돌리고 싶을 때

창고에는 버전마다 **커밋 번호(SHA)** 가 붙어 보관돼 있어요. 이전 버전으로 바로 되돌릴 수 있어요.

1. GitHub 저장소 → **Actions** 탭에서 **문제없던 때의 ✅ 실행**(check·images·promote가 모두 성공)을 눌러요.
   위쪽에 보이는 커밋 번호를 누르면 커밋 화면이 열리고, 주소창 끝의 **40글자 번호**가 그 커밋의 SHA예요. 복사해요.
   (❌였던 실행의 커밋은 창고에 이미지가 없어서 되돌릴 수 없어요.)
2. SSH 창에서 붙여 넣어요(`복사한40글자번호`를 바꿔서).

```bash
~/wyd/scripts/auto-deploy.sh --pin 복사한40글자번호
```

`고정: abc1234 (자동 배포 멈춤 …)`이 나오면 되돌리기 완료예요.
고정해 둔 동안은 **자동 배포가 멈춰요**. 새로 push해도 반영되지 않아요.
(이미지가 없는 번호를 넣으면 `중단: 이미지 받기 실패`가 나오고 아무것도 바뀌지 않아요. 번호를 다시 확인하세요.)

3. 문제를 고친 새 버전을 push한 **다음에** 고정을 풀어요.

```bash
~/wyd/scripts/auto-deploy.sh --unpin
```

> ⚠️ 고친 버전을 push하기 **전에** 풀면, 문제 있던 최신 버전이 다시 배포돼요.
> (push 직후라 Actions가 아직 조립 중이면 `대기`가 나오고, 다 되면 5분 안에 자동으로 바뀌어요.)

> 💡 되돌릴 때 **DB 구조가 바뀐 버전**(새 표·칸 추가)을 넘나들면 문제가 생길 수 있어요. 그럴 땐 개발 담당과 상의하세요.
> 고정은 프로그램(이미지)만 옛 버전으로 돌려요. `docker-compose.yml` 같은 설정 파일은 최신 그대로예요.

---

## 7단계. 비용과 한도

- **GitHub Actions**: 비공개 저장소도 무료 플랜에서 한 달에 일정 시간(현재 약 2,000분)까지 무료예요. 한 번 배포에 5~10분 쓰니 하루 여러 번 push해도 충분해요.
- **GHCR 창고**: 비공개 이미지는 저장 용량 무료 한도가 있어요. 버전마다 쌓이니, 한도에 가까워지면 오래된 버전을 지우세요.
  (저장소 → Packages → `wyd-api` → Package settings / Manage versions)
- 무료 한도와 요금 정책은 바뀔 수 있어요. GitHub → Settings → **Billing and plans**에서 사용량을 가끔 확인하세요.

---

## 8단계. 문제가 생겼어요!

| 증상 | 원인과 해결 |
|---|---|
| Actions에 ❌, **check** 단계에서 실패 | 코드 검사에 떨어졌어요. Mac에서 `npm run check`로 오류를 확인하고 고쳐서 다시 push |
| Actions에 ❌, **images** 단계에서 `denied` / `permission` | 같은 이름의 패키지를 예전에 손으로 만든 적이 있으면 생겨요. 내 프로필 → Packages → 해당 패키지 → Package settings → **Manage Actions access**에 이 저장소를 추가(Write) |
| 로그에 `중단: .env에 IMAGE_REPO가 없습니다` | 4-4단계를 안 했어요 |
| 로그에 `중단: 이미지 확인 실패` 또는 `이미지 받기 실패` | 창고 토큰 문제예요. 4-2단계 `docker login`을 다시 해요. 토큰이 만료됐으면 새로 만들어요. `IMAGE_REPO`의 아이디가 **소문자**인지도 확인 |
| 로그에 `중단: git fetch 실패` | 배포 키 문제예요. `ssh -T git@github.com`으로 확인(4-1단계) |
| 로그에 `중단: 코드 갱신 실패` | 서버에서 파일을 직접 고쳤어요. `cd ~/wyd && git status`로 확인하고, 고친 걸 버려도 되면 `git checkout -- .` 후 다시 실행 |
| `대기: …` 한 줄 뒤로 아무 로그도 없고 안 바뀜 | 그 커밋의 Actions가 ❌예요. Actions 탭에서 원인을 보고 고쳐서 다시 push |
| push해도 아무 로그가 없음 | 되돌리기 고정 중일 수 있어요. `ls ~/wyd/.deploy-pin`이 보이면 6단계 3번(`--unpin`) |
| `ssh -T git@github.com`이 `Permission denied (publickey)` | 배포 키 등록이 안 됐어요. 4-1단계를 다시 하고, 붙여 넣은 키가 `.pub` 파일 내용인지 확인 |
| push했는데 10분이 지나도 안 바뀜 | ① Actions가 ✅인지 ② `tail ~/wyd-deploy.log`에 오류가 있는지 ③ `crontab -l`에 등록돼 있는지 확인 |
| 디스크가 꽉 찼어요(`no space left`) | `docker image prune -af && docker builder prune -af` |
| 급하게 **지금 바로** 반영하고 싶어요 | Actions ✅ 뒤 SSH 창에서 `~/wyd/scripts/auto-deploy.sh` |

---

## 부록. 무엇이 어디에 있나 (개발 담당용)

| 파일 | 역할 |
|---|---|
| `.github/workflows/deploy.yml` | main push → `npm run check` → api·web 이미지를 `ghcr.io/<owner>/wyd-{api,web}:<sha>`로 푸시 → 둘 다 성공하면 `promote`가 `latest`를 함께 옮김. 수동 실행은 main에서만 이미지 생성 |
| `scripts/auto-deploy.sh` | 서버 cron. `git fetch` → origin/main SHA의 api·web 이미지가 **둘 다** GHCR에 있을 때만 `docker pull` → `merge --ff-only` → `IMAGE_TAG=<sha> up -d --no-build` → `.env`의 `IMAGE_TAG`에 배포 SHA 기록(수동 `compose up`도 같은 버전) → 이전 이미지 정리. 이미 그 SHA로 돌고 있으면 종료. `--pin <sha>`/`--unpin`으로 되돌리기 고정(`.deploy-pin`). `flock`(저장소 안 `.deploy.lock`)으로 중복 실행 방지 |
| `docker-compose.yml` | api·web에 `image: ${IMAGE_REPO:-local/wyd}-{api,web}:${IMAGE_TAG:-latest}`. 로컬은 `IMAGE_REPO` 없이 `--build` |
| 서버 `.env` | `IMAGE_REPO`(필수, 손으로 적음), `IMAGE_TAG`(스크립트가 자동 기록) |

- DB 마이그레이션은 api가 켜질 때 자동으로 적용돼요(기존과 같아요).
- `docker-compose.yml`, `scripts/backup.sh`, `.env` 외의 서버 파일은 쓰이지 않아요. nginx 설정은 web 이미지 안에 들어 있어요.
