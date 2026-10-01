# GCP 서버에 올리고 인터넷에 공개하기 — 따라 하기 가이드

이 가이드를 **위에서부터 순서대로** 따라 하면, 지금 내 컴퓨터에서만 보이던 WYD 관리 프로그램을
**어디서나 접속할 수 있는 인터넷 주소**(예: `https://jungye-wyd.ngrok-free.app`)로 열 수 있어요.

- 걸리는 시간: 처음이면 **약 1시간 30분**(기다리는 시간 포함)
- 비용: 구글 클라우드 **무료 등급** 안에서 쓰도록 설정해요(주의사항은 [부록 C](#부록-c-요금이-나오지-않게-하려면))
- 명령어는 **복사해서 붙여 넣기**만 하면 돼요. 직접 타이핑하지 않아도 됩니다.

---

## 0. 먼저 전체 그림 이해하기

학교 축제에서 부스를 운영한다고 생각해 볼게요.

| 실제 | 비유 | 하는 일 |
|---|---|---|
| **GCP VM**(가상 컴퓨터) | 축제용으로 **빌린 교실** | 24시간 켜져 있는 구글의 컴퓨터 한 대를 빌려요 |
| **Docker**(도커) | 교실에 들여놓는 **정리함 5개** | 프로그램을 칸칸이 나눠 담아 서로 섞이지 않게 해요 |
| **ngrok**(엔그록) | 교실로 이어지는 **전용 출입문** | 교실 문을 활짝 열지 않고도, 이 문 하나로만 손님이 들어와요 |

도커 정리함 5개는 이렇게 생겼어요(`docker-compose.yml`에 이미 다 적혀 있어요).

```
 손님(브라우저) ──https──▶ [ngrok 문] ──▶ [web: 화면]  ──▶ [api: 두뇌] ──▶ [db: 장부]
                                                                     [backup: 매일 새벽 장부 복사]
```

- **web** — 화면(웹페이지)을 보여 줘요 (Nginx)
- **api** — 저장·배정 같은 일을 처리하는 두뇌예요 (NestJS)
- **db** — 모든 데이터를 적어 두는 장부예요 (PostgreSQL)
- **ngrok** — 바깥 인터넷과 연결하는 문이에요
- **backup** — 매일 새벽 3시 30분에 장부를 복사해 둬요(7일치 보관)

우리가 할 일은 딱 네 가지예요.

1. 구글에서 **교실(VM)을 빌리고**
2. 교실에 **Docker를 설치하고**
3. **프로그램 파일을 옮긴 다음**
4. **ngrok 문 열쇠**를 넣고 실행 버튼을 누르기

---

## 준비물 체크리스트

- [ ] 구글 계정(Gmail)
- [ ] **신용카드 또는 체크카드**(해외 결제 가능) — 구글이 본인 확인용으로 요구해요. 무료 등급만 쓰면 요금이 나가지 않아요
- [ ] 이 프로그램이 들어 있는 **내 Mac**(지금 쓰는 컴퓨터)
- [ ] 이메일 주소(ngrok 가입용)

---

## 1단계. 내 Mac에서 프로그램 꾸러미 만들기 (5분)

서버로 옮길 파일을 **압축 파일 하나**로 묶을 거예요.
이 방법은 비밀번호 파일(`.env`)이나 무거운 `node_modules` 폴더는 **자동으로 빼고** 필요한 것만 묶어 줘요.

1. Mac에서 **터미널** 앱을 열어요 (`⌘ + 스페이스` → "터미널" 입력 → 엔터)
2. 아래 두 줄을 복사해서 붙여 넣고 엔터를 눌러요.

```bash
cd ~/Downloads/WYD/v2
git archive --format=tar.gz -o ~/Desktop/wyd-v2.tar.gz HEAD
```

3. **바탕화면에 `wyd-v2.tar.gz` 파일**이 생겼는지 확인해요. 이게 우리 프로그램 꾸러미예요.

> 💡 `git archive`는 **마지막으로 커밋한 내용**만 묶어요. 코드를 고쳤다면 먼저 커밋한 다음 꾸러미를 만드세요.

---

## 2단계. 구글 클라우드(GCP) 가입하기 (10분)

1. https://console.cloud.google.com 에 구글 계정으로 들어가요.
2. 처음이면 **"무료로 시작하기"** 버튼이 보여요. 누르고 국가(대한민국)·약관 동의·카드 정보를 입력해요.
   - 처음 가입하면 **체험 크레딧**을 주고, 체험이 끝나도 **무료 등급(Free Tier)** 은 계속 쓸 수 있어요.
3. 화면 맨 위에 **프로젝트 이름**(예: `My First Project`)이 보이면 준비 완료예요.
   - 원하면 새 프로젝트를 만들어 `wyd2027`처럼 이름을 붙여도 좋아요.
4. **프로젝트에 결제 계정 연결하기** — 새 프로젝트를 만들었다면 꼭 해야 해요.
   이걸 안 하면 3단계에서 **"결제 필요 — Compute Engine API에는 결제 계정이 있는 프로젝트가 필요합니다."** 창이 떠요.
   - ☰ 메뉴 → **결제** → "이 프로젝트에는 결제 계정이 없습니다" → **결제 계정 연결**(또는 3단계에서 뜬 창의 **결제 사용 설정**)
   - 목록에 결제 계정(예: "내 결제 계정")이 있으면 골라서 **계정 설정**. 없으면 **결제 계정 만들기**로 카드 정보를 입력해요.
   - 연결만으로는 돈이 나가지 않아요. 3단계 무료 조건만 지키면 돼요. 이 김에 [부록 C](#부록-c-요금이-나오지-않게-하려면)의 **예산 알림**도 걸어 두세요.

---

## 3단계. 가상 컴퓨터(VM) 빌리기 (10분)

> ⚠️ **이 단계가 가장 중요해요.** 아래 값과 **정확히 똑같이** 골라야 무료예요. 하나라도 다르면 요금이 나올 수 있어요.

1. 왼쪽 위 **☰ 메뉴** → **Compute Engine** → **VM 인스턴스**를 눌러요.
   - 처음이면 "Compute Engine API 사용" 버튼이 나와요. 누르고 1~2분 기다려요.
2. **인스턴스 만들기** 버튼을 눌러요.
3. 아래 표대로 채워요.

| 항목 | 이렇게 고르세요 | 왜? |
|---|---|---|
| 이름 | `wyd-server` | 아무 이름이나 괜찮아요 |
| 리전 | **`us-west1 (오리건)`** | 무료 지역(us-west1·us-central1·us-east1) 중 한국에서 가장 가까워요 |
| 영역 | 아무거나(예: `us-west1-b`) | |
| 머신 구성 | **E2** 시리즈 → 머신 유형 **`e2-micro`** | 무료인 크기는 이것뿐이에요 |
| 부팅 디스크 → **변경** | 운영체제 **Ubuntu**, 버전 **Ubuntu 24.04 LTS (x86/64)** | |
| 　디스크 유형 | **표준 영구 디스크**(Standard persistent disk) | "균형(Balanced)"은 유료예요 |
| 　크기 | **30** GB | 무료 한도가 30GB예요 |
| 방화벽 | HTTP·HTTPS 허용 **체크하지 않기** | ngrok 문을 쓰니까 교실 문은 닫아 둬요(더 안전) |

4. 맨 아래 **만들기**를 눌러요. 1분쯤 지나면 목록에 초록색 ✅ 표시와 함께 `wyd-server`가 나타나요.

---

## 4단계. 빌린 컴퓨터에 접속하기 (2분)

1. VM 목록에서 `wyd-server` 줄의 오른쪽 **SSH** 버튼을 눌러요.
2. 새 창이 열리고 "권한 승인" 같은 안내가 나오면 **승인**을 눌러요.
3. 까만 화면에 아래처럼 보이면 성공이에요. 이제 이 창이 **구글 컴퓨터의 터미널**이에요.

```
사용자이름@wyd-server:~$
```

> 💡 이 까만 창에 명령어를 붙여 넣을 때는 **`Ctrl + V`**(Mac도 `⌘ + V`)를 쓰면 돼요.
> 앞으로 나오는 명령어는 모두 **이 SSH 창**에 붙여 넣어요(1단계만 내 Mac이었어요).

---

## 5단계. 메모리 늘리기 — "스왑" 만들기 (2분)

e2-micro는 메모리(RAM)가 **1GB**뿐이라, 프로그램을 만들다(빌드) 보면 모자라서 멈출 수 있어요.
그래서 디스크 일부를 **보조 메모리(스왑)** 로 2GB 빌려 쓸게요. 책상이 좁을 때 옆에 보조 책상을 붙이는 것과 같아요.

아래를 **통째로** 복사해서 붙여 넣으세요.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

마지막 줄 결과에서 **`Swap:` 옆에 `2.0Gi`** 가 보이면 성공이에요.

```
               total        used        free   ...
Mem:           958Mi       ...
Swap:          2.0Gi          0B       2.0Gi
```

> 💡 `sudo`는 "관리자 권한으로 실행해 줘"라는 뜻이에요. 비밀번호를 묻지 않으니 걱정하지 마세요.

### 5-1. 서버 시계를 한국 시간으로 맞추기 (1분)

GCP 서버의 시계는 어느 지역에 만들든 기본이 **UTC(세계 표준시)** 예요. 한국보다 **9시간 느리게** 보여요.
그대로 두면 배포 기록(`~/wyd-deploy.log`)의 시각이 오전 11시인데 `02:00`처럼 찍혀서 헷갈려요.

```bash
sudo timedatectl set-timezone Asia/Seoul
date
```

결과 끝이 **`KST`** 이고 지금 한국 시각이 나오면 성공이에요.

> 💡 프로그램 안의 시간(DB·매일 새벽 3시 30분 백업)은 `docker-compose.yml`에서 이미 한국 시간으로 정해 둬서, 이 설정과 관계없이 맞게 돌아가요.
> 이미 서버를 다 올린 뒤라면 위 명령 다음에 `sudo systemctl restart cron`도 해 주세요. 알람 프로그램(cron)은 켜질 때 시간대를 읽어요.

---

## 6단계. Docker 설치하기 (5분)

1. 아래 두 줄을 붙여 넣어요. 설치하는 데 2~3분 걸려요.

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

2. **SSH 창을 닫고, 4단계처럼 SSH 버튼을 다시 눌러** 새로 접속해요.
   (방금 준 "도커 사용 권한"은 다시 접속해야 적용돼요.)
3. 잘 설치됐는지 확인해요.

```bash
docker run --rm hello-world
```

`Hello from Docker!` 문장이 보이면 성공이에요. 🎉

> ❗ `permission denied`가 나오면 SSH 창을 닫고 다시 접속하지 않은 거예요. 2번을 다시 해 주세요.

---

## 7단계. ngrok 가입하고 "열쇠"와 "주소" 받기 (5분)

ngrok 문을 열려면 **열쇠(Authtoken)** 와 **고정 주소(Domain)** 두 가지가 필요해요.
이 단계는 **내 Mac의 웹 브라우저**에서 해요.

1. https://dashboard.ngrok.com/signup 에서 가입해요(구글 계정으로 가입해도 돼요).
2. **열쇠 복사하기**: 왼쪽 메뉴 **Your Authtoken**(또는 Getting Started → Your Authtoken)에서 긴 글자를 **Copy**해요.
   - `2abc...XYZ` 처럼 생긴 50글자 정도의 문자열이에요.
   - 📝 메모장에 잠깐 붙여 두세요.
3. **고정 주소 받기**: 왼쪽 메뉴 **Domains**(또는 Universal Gateway → Domains)로 가요.
   - 무료 계정은 주소 **1개**를 받을 수 있어요. 이미 하나 만들어져 있으면 그걸 쓰고, 없으면 **+ New Domain**을 눌러요.
   - `something-something-1234.ngrok-free.app` 같은 주소가 나와요.
   - 📝 이 주소도 메모장에 붙여 두세요. (앞의 `https://`는 빼고 적어요)

> ⚠️ Authtoken은 **집 열쇠**와 같아요. 다른 사람에게 보여 주거나 카톡·메일에 올리지 마세요.

---

## 8단계. 프로그램 꾸러미를 서버로 옮기기 (5분)

1. SSH 창 **오른쪽 위**에서 **⬆ 파일 업로드**(UPLOAD FILE) 버튼을 눌러요.
   - 버튼이 안 보이면 톱니바퀴(⚙) 모양 메뉴 안에 있어요.
2. 1단계에서 만든 **바탕화면의 `wyd-v2.tar.gz`** 를 골라요. 오른쪽 아래에 "업로드 완료"가 뜰 때까지 기다려요.
3. 업로드한 꾸러미를 `wyd` 폴더에 풀어요.

```bash
mkdir -p ~/wyd
tar xzf ~/wyd-v2.tar.gz -C ~/wyd
cd ~/wyd
ls
```

`apps  docker-compose.yml  nginx  packages  README.md ...` 처럼 파일 목록이 보이면 성공이에요.

---

## 9단계. 비밀 설정 파일(.env) 만들기 (10분)

`.env`는 **비밀번호와 열쇠를 적어 두는 쪽지**예요. 서버에만 있고, 절대 다른 곳에 올리지 않아요.

### 9-1. 예시 쪽지 복사하기

```bash
cd ~/wyd
cp .env.example .env
```

### 9-2. 무작위 비밀값 두 개 만들기

아래를 붙여 넣으면 **서로 다른 긴 무작위 글자 두 줄**이 나와요.

```bash
openssl rand -base64 24 | tr -d '/+='
openssl rand -base64 32 | tr -d '/+='
```

- 첫째 줄 → **DB 비밀번호**로 쓸 거예요
- 둘째 줄 → **JWT_SECRET**(로그인 도장용 비밀값)으로 쓸 거예요
- 📝 둘 다 메모장에 복사해 두세요.

### 9-3. 쪽지 편집하기

```bash
nano .env
```

> ❗ `nano: command not found`가 나오면 nano가 설치되지 않은 거예요. 아래로 설치한 뒤 `nano .env`를 다시 실행해요.
>
> ```bash
> sudo apt-get update && sudo apt-get install -y nano
> ```

`nano`라는 간단한 글쓰기 프로그램이 열려요. **마우스는 안 되고 방향키(↑↓←→)** 로 움직여요.
아래 표의 줄들을 찾아서 `=` 뒤의 글자를 지우고 새 값을 적어요.

| 줄 | 바꿀 값 |
|---|---|
| `DB_PASSWORD=` | 9-2의 **첫째 줄** |
| `JWT_SECRET=` | 9-2의 **둘째 줄** |
| `ADMIN_USERNAME=` | `admin` 그대로 둬도 돼요 |
| `ADMIN_PASSWORD=` | **처음 로그인할 관리자 비밀번호**(12자 이상 추천). 로그인 후 바로 바꿀 거예요 |
| `NGROK_AUTHTOKEN=` | 7단계에서 복사한 **열쇠** |
| `NGROK_DOMAIN=` | 7단계에서 받은 **주소**(`https://` 없이, 예: `jungye-wyd.ngrok-free.app`) |

나머지 줄(`WYD_SYNC_ENABLED`, `SEED_CONTENT`, `COOKIE_SECURE`)은 **그대로** 두세요.

다 고친 모습은 대략 이래요.

```ini
DB_PASSWORD=k3Jd9sLqX0aP2mVn8RtY4wZe
JWT_SECRET=Qm7xT2pL9vB4nR8sK1dF6hJ3gW5yZ0cE2aU7iO9
ADMIN_USERNAME=admin
ADMIN_PASSWORD=MyFirstPass2027!
NGROK_AUTHTOKEN=2abcDEF...(긴 열쇠)
NGROK_DOMAIN=jungye-wyd.ngrok-free.app
```

**저장하고 나가기**:
1. `Ctrl + O` (저장) → 아래에 파일 이름이 나오면 **엔터**
2. `Ctrl + X` (나가기)

> 💡 Mac에서도 `⌘`가 아니라 **`Ctrl`** 키예요.

### 9-4. 쪽지를 나만 볼 수 있게 잠그기

```bash
chmod 600 .env
```

---

## 10단계. 실행! 🚀 (15~20분, 대부분 기다리는 시간)

```bash
cd ~/wyd
docker compose up -d --build
```

- `--build`: 프로그램을 조립(빌드)해요. **처음에는 10~20분** 걸려요. 글자가 많이 올라가도 정상이에요.
- `-d`: 다 되면 뒤에서 조용히 돌아가게 해요(SSH 창을 닫아도 계속 돌아가요).

끝나면 상태를 확인해요.

```bash
docker compose ps
```

아래처럼 5개가 모두 `Up`이고, `db`·`api`·`web`에 **`(healthy)`** 가 붙어 있으면 성공이에요.
(방금 켰다면 `(health: starting)`일 수 있어요. 1분 뒤 다시 확인하세요.)

```
NAME          SERVICE   STATUS
wyd-api-1     api       Up 2 minutes (healthy)
wyd-backup-1  backup    Up 2 minutes
wyd-db-1      db        Up 2 minutes (healthy)
wyd-ngrok-1   ngrok     Up 2 minutes
wyd-web-1     web       Up 2 minutes (healthy)
```

관리자 계정이 만들어졌는지도 확인해요.

```bash
docker compose logs api | grep 관리자
```

`관리자 계정 생성: admin` 비슷한 문장이 보이면 준비 끝이에요.

---

## 11단계. 접속하고 첫 설정하기 (5분)

1. 휴대폰이나 다른 컴퓨터 브라우저에서 **`https://내-ngrok-주소`** 로 들어가요.
2. 처음 한 번은 ngrok **안내 페이지**(You are about to visit…)가 나와요. **Visit Site** 버튼을 누르면 돼요.
   (무료 플랜이라 방문자마다 처음 한 번씩 나와요.)
3. WYD 화면이 뜨면 **로그인** → 아이디 `admin`, 비밀번호는 9-3의 `ADMIN_PASSWORD`.
4. **바로 비밀번호 바꾸기**: 오른쪽 위 메뉴 → **비밀번호 변경**.
5. 봉사자들 계정 만들기: **관리 → 계정 관리**에서 분과 책임자·홈스테이 가정 계정을 만들어 알려 주세요.
   (각자 개인 계정을 쓰기 때문에 공용 비밀번호를 돌리지 않아도 돼요.)

🎉 **축하해요! 이제 인터넷 어디서나 접속할 수 있어요.**

---

## 12단계. 새 버전으로 업데이트하기 (나중에 코드를 고쳤을 때)

> 💡 매번 손으로 올리기 번거롭다면 **[자동 배포(docs/CICD.md)](CICD.md)** 를 켜세요. `git push`만 하면 서버에 저절로 반영돼요.
> 자동 배포를 켠 뒤에는 아래 방법을 쓰지 마세요(서버에서 직접 빌드하게 돼요).

1. **내 Mac**: 고친 내용을 커밋한 뒤 꾸러미를 다시 만들어요.

```bash
cd ~/Downloads/WYD/v2
git archive --format=tar.gz -o ~/Desktop/wyd-v2.tar.gz HEAD
```

2. **SSH 창**: 8단계처럼 **파일 업로드**로 새 `wyd-v2.tar.gz`를 올려요(같은 이름이면 덮어써져요).
3. **SSH 창**: 풀고 다시 조립해요.

```bash
cd ~/wyd
tar xzf ~/wyd-v2.tar.gz -C ~/wyd
docker compose up -d --build
```

- `.env`는 꾸러미에 들어 있지 않아서 **덮어써지지 않아요**. 데이터(DB)도 그대로 남아요.
- DB 구조가 바뀌었다면 api가 켜질 때 **자동으로 반영**해요.

---

## 부록 A. 자주 쓰는 명령어

모두 `cd ~/wyd` 한 다음에 써요.

| 하고 싶은 일 | 명령어 |
|---|---|
| 상태 보기 | `docker compose ps` |
| 두뇌(api) 기록 보기 (끄기: `Ctrl + C`) | `docker compose logs -f api` |
| ngrok 문 기록 보기 | `docker compose logs -f ngrok` |
| 전부 다시 켜기 | `docker compose restart` |
| 전부 끄기 (데이터는 남아요) | `docker compose down` |
| 다시 켜기 | `docker compose up -d` |
| 메모리 사용량 보기 (끄기: `Ctrl + C`) | `docker stats` |
| 관리자 비밀번호를 잊었을 때 | `docker compose exec api node dist/cli/seed-admin.js admin '새비밀번호'` |
| 지금 바로 백업 | `docker compose exec backup sh /backup.sh` |

> ⚠️ [자동 배포](CICD.md)를 켠 서버에서는 `--build`가 붙은 명령과 `docker compose pull`을 쓰지 마세요. 새 버전은 `git push`로만 올려요.

> ⚠️ **`docker compose down -v`는 절대 쓰지 마세요.** 끝의 `-v`가 **모든 데이터(DB·사진)를 지워요.**

**구글 VM을 껐다 켜도** 도커가 알아서 5개를 다시 실행해요(`restart: unless-stopped` 설정 덕분).

### 백업 파일을 내 Mac으로 받아 두기

서버 안의 백업은 VM이 망가지면 같이 사라져요. **일주일에 한 번쯤** 내 Mac으로도 받아 두세요.

1. SSH 창에서 가장 최근 백업 파일 이름을 확인해요.

```bash
ls -t ~/wyd/backups | head -3
```

2. SSH 창 오른쪽 위 **⬇ 파일 다운로드**를 누르고, 경로에 `/home/사용자이름/wyd/backups/파일이름` 을 적어요.
   (`사용자이름`은 프롬프트 `사용자이름@wyd-server` 의 앞부분이에요. `pwd` 명령으로도 볼 수 있어요.)

---

## 부록 B. 문제가 생겼어요!

| 증상 | 원인과 해결 |
|---|---|
| 빌드 중 `Killed` 또는 `exit code 137` | 메모리 부족이에요. `free -h`로 **Swap 2.0Gi**가 있는지 확인하고, 없으면 5단계를 다시 한 뒤 `docker compose up -d --build`를 다시 실행해요 |
| `permission denied ... docker.sock` | 6단계 2번(SSH 창 닫고 다시 접속)을 안 했어요 |
| `DB_PASSWORD 를 .env 에 설정하세요` 같은 오류 | `.env`에 그 값이 비어 있어요. `nano .env`로 채워요 |
| `docker compose ps`에서 ngrok이 계속 `Restarting` | 열쇠나 주소가 틀렸어요. `docker compose logs ngrok`에서 `ERR_NGROK_...` 문구를 확인해요. `.env`의 `NGROK_AUTHTOKEN`·`NGROK_DOMAIN`을 다시 복사해서 넣고(`https://` 빼기), `docker compose up -d`를 실행해요 |
| 주소에 들어가면 `ERR_NGROK_3200` / offline | ngrok 칸이 꺼져 있어요. `docker compose ps`로 확인하고 `docker compose up -d` |
| 화면은 뜨는데 **로그인이 안 돼요** | ① 아이디·비밀번호 확인. ② 여러 번 틀리면 잠시 막혀요(아래 참고). ③ `http://`가 아니라 **`https://`** 주소로 들어왔는지 확인해요 |
| "로그인 시도가 너무 많습니다" | 보안 기능이에요. 같은 곳에서 여러 번 틀리면 **최대 15분** 막혀요. 기다리거나 급하면 `docker compose restart api` |
| 성당 Wi-Fi에서 여러 명이 동시에 로그인하면 일부가 "너무 많습니다" | 한 인터넷 주소(IP)당 **1분에 10번**으로 로그인을 제한하고 있어요. 1분 뒤 다시 시도하면 돼요. 행사 날 자주 생기면 개발 담당에게 `nginx/nginx.conf`의 `rate=10r/m`을 늘려 달라고 하세요 |
| 화면이 흰색으로만 나와요 | `docker compose logs web`, `docker compose logs api`를 보고 빨간 오류 문장을 개발 담당에게 보내 주세요 |

---

## 부록 C. 요금이 나오지 않게 하려면

구글 무료 등급은 **조건 안에서만** 무료예요. 아래를 꼭 지켜 주세요.

- VM은 **e2-micro 딱 1대**, 지역은 **us-west1 / us-central1 / us-east1** 중 하나
- 디스크는 **표준 영구 디스크 30GB 이하**
- 바깥으로 나가는 데이터는 **한 달 1GB까지** 무료예요. 사진을 많이 보거나 방문자가 아주 많으면 넘을 수 있어요.
- 외부 IP 주소 같은 항목에 따로 요금이 붙는지는 구글 정책에 따라 달라질 수 있어요.

그래서 **예산 알림**을 꼭 걸어 두세요. 요금이 생기면 바로 메일이 와요.

1. ☰ 메뉴 → **결제** → **예산 및 알림** → **예산 만들기**
2. 금액: **1,000원**(또는 1달러), 알림 기준: 50% · 90% · 100%
3. 저장

한 달 뒤 **결제 → 보고서**에서 실제 사용 금액이 0원인지 한 번 확인해 보세요.

---

## 부록 D. 알아 두면 좋은 것

- **ngrok 무료 플랜의 한계**: 방문자에게 처음 한 번 안내 페이지가 뜨고, 한 달 전송량 한도가 있어요.
  순례자·신자처럼 외부 방문이 많아지면 `docker-compose.yml` 아래쪽 주석에 있는 **Cloudflare Tunnel**(무료, 안내 페이지 없음)로 바꾸는 걸 추천해요.
- **기존 구글 시트 데이터 옮기기**: [README의 "2. 기존 Google Sheets 데이터 이관"](../README.md#2-기존-google-sheets-데이터-이관)을 따라 해요.
- **서버 안에서만 화면 확인하기**: `curl -I http://127.0.0.1:8080` 에 `200 OK`가 나오면 web 칸은 정상이에요.
  (문제가 ngrok 쪽인지 프로그램 쪽인지 가를 때 써요.)
