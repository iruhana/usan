---
id: stealth-browser
name: 스텔스 브라우저
description: 안티 디텍션, Cloudflare 우회, CAPTCHA 풀이, 영구 세션, 사일런트 작동을 지원하는 스텔스 브라우저 자동화 스킬. 봇 탐지 회피, 로그인 유지, 헤드리스 브라우징, 보안 조치 우회가 필요한 모든 웹 자동화에 사용합니다.
version: 1.0.0
triggers:
  - 스텔스 브라우저
  - 클라우드플레어 우회
  - 캡차 풀기
  - 안티 디텍션
  - 사일런트 자동화
  - 로그인 유지
  - 봇 탐지 우회
  - stealth browser
  - bypass cloudflare
  - solve captcha
  - anti-detection
  - silent automation
  - persistent login
metadata:
  emoji: "🕵️"
  category: automation
  source: "openclaw"
  license: "Apache-2.0"
---

# 스텔스 브라우저 자동화

사일런트, 탐지 불가능한 웹 자동화. 다중 안티 디텍션 레이어를 결합합니다.

## 빠른 로그인 워크플로우 (중요)

사용자가 웹사이트에 로그인을 요청할 때:

1. **headed 모드로 열기** (수동 로그인을 위한 가시적 브라우저):
```bash
python scripts/stealth_session.py -u "https://target.com/login" -s sitename --headed
```

2. **사용자가 가시적 브라우저에서 수동 로그인**

3. **로그인 확인 후 세션 저장**:
```bash
python scripts/stealth_session.py -u "https://target.com" -s sitename --headed --save
```

4. **이후 사용** - 저장된 세션 로드 (headless):
```bash
python scripts/stealth_session.py -u "https://target.com" -s sitename --load
```

세션 저장 위치: `~/.usan/browser-sessions/<sitename>.json`

## 실행 전략 (중요)

### 1. 사일런트 우선, 필요시 표시
- headless 모드로 먼저 사일런트 시도
- 실패하거나 CAPTCHA가 필요하면 headed 표시 모드로 전환
- 사용자 작업 방해 최소화

### 2. 중단점 이어하기
장기 작업은 `task_runner.py`로 상태 관리:
```python
from task_runner import TaskRunner
task = TaskRunner('my_task')
task.set_total(100)
for i in items:
    if task.is_completed(i):
        continue  # 완료된 항목 건너뛰기
    # 처리...
    task.mark_completed(i)
task.finish()
```

### 3. 타임아웃 처리
- 기본 단일 페이지 타임아웃: 30초
- 장기 작업은 50건마다 진행 상황 저장
- 실패 시 자동 3회 재시도

### 4. 시도 기록
모든 로그인 시도 기록 위치: `~/.usan/browser-sessions/attempts.json`

## 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                  Stealth Browser                     │
├─────────────────────────────────────────────────────┤
│  Layer 1: 안티 디텍션 엔진                           │
│  - puppeteer-extra-plugin-stealth                   │
│  - 브라우저 핑거프린트 스푸핑                         │
│  - WebGL/Canvas/Audio 핑거프린트 마스킹              │
├─────────────────────────────────────────────────────┤
│  Layer 2: 챌린지 우회                                │
│  - Cloudflare Turnstile/JS Challenge               │
│  - hCaptcha / reCAPTCHA 통합                        │
│  - 2Captcha / Anti-Captcha API                     │
├─────────────────────────────────────────────────────┤
│  Layer 3: 세션 영속성                                │
│  - 쿠키 저장 (JSON/SQLite)                          │
│  - localStorage 동기화                              │
│  - 멀티 프로필 관리                                  │
├─────────────────────────────────────────────────────┤
│  Layer 4: 프록시 & 아이덴티티                        │
│  - 로테이팅 레지덴셜 프록시                          │
│  - User-Agent 로테이션                              │
│  - 타임존/로케일 스푸핑                              │
└─────────────────────────────────────────────────────┘
```

## 설정

### 핵심 의존성 설치

```bash
npm install -g puppeteer-extra puppeteer-extra-plugin-stealth
npm install -g playwright
pip install undetected-chromedriver DrissionPage
```

### 선택 사항: CAPTCHA 솔버

API 키를 `~/.usan/secrets/captcha.json`에 저장:
```json
{
  "2captcha": "YOUR_2CAPTCHA_KEY",
  "anticaptcha": "YOUR_ANTICAPTCHA_KEY",
  "capsolver": "YOUR_CAPSOLVER_KEY"
}
```

### 선택 사항: 프록시 구성

`~/.usan/secrets/proxies.json`에 저장:
```json
{
  "rotating": "http://user:pass@proxy.provider.com:port",
  "residential": ["socks5://ip1:port", "socks5://ip2:port"],
  "datacenter": "http://dc-proxy:port"
}
```

## 빠른 시작

### 1. 스텔스 세션 (Python - 권장)

```python
# scripts/stealth_session.py - 최대 호환성을 위해 사용
import undetected_chromedriver as uc
from DrissionPage import ChromiumPage

# Option A: undetected-chromedriver (Selenium 기반)
driver = uc.Chrome(headless=True, use_subprocess=True)
driver.get("https://nowsecure.nl")  # 안티 디텍션 테스트

# Option B: DrissionPage (더 빠름, 네이티브 Python)
page = ChromiumPage()
page.get("https://cloudflare-protected-site.com")
```

### 2. 스텔스 세션 (Node.js)

```javascript
// scripts/stealth.mjs
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox'
  ]
});

const page = await browser.newPage();
await page.goto('https://bot.sannysoft.com'); // 스텔스 검증
```

## 핵심 작업

### 스텔스 페이지 열기

```bash
# agent-browser에 스텔스 프로필 사용
agent-browser --profile ~/.stealth-profile open https://target.com

# 또는 스크립트 사용
python scripts/stealth_open.py --url "https://target.com" --headless
```

### Cloudflare 우회

```python
# DrissionPage로 자동 CF 우회
from DrissionPage import ChromiumPage

page = ChromiumPage()
page.get("https://cloudflare-site.com")
# DrissionPage가 CF 챌린지를 자동으로 대기

# 필요시 수동 대기
page.wait.ele_displayed("main-content", timeout=30)
```

완강한 Cloudflare 사이트의 경우 FlareSolverr 사용:

```bash
# FlareSolverr 컨테이너 시작
docker run -d --name flaresolverr -p 8191:8191 ghcr.io/flaresolverr/flaresolverr

# 클리어런스 요청
curl -X POST http://localhost:8191/v1 \
  -H "Content-Type: application/json" \
  -d '{"cmd":"request.get","url":"https://cf-protected.com","maxTimeout":60000}'
```

### CAPTCHA 풀기

```python
# scripts/solve_captcha.py
import requests
import json
import time

def solve_recaptcha(site_key, page_url, api_key):
    """2Captcha를 통한 reCAPTCHA v2/v3 풀기"""
    # 작업 제출
    resp = requests.post("http://2captcha.com/in.php", data={
        "key": api_key,
        "method": "userrecaptcha",
        "googlekey": site_key,
        "pageurl": page_url,
        "json": 1
    }).json()

    task_id = resp["request"]

    # 결과 폴링
    for _ in range(60):
        time.sleep(3)
        result = requests.get(f"http://2captcha.com/res.php?key={api_key}&action=get&id={task_id}&json=1").json()
        if result["status"] == 1:
            return result["request"]  # 토큰
    return None

def solve_hcaptcha(site_key, page_url, api_key):
    """Anti-Captcha를 통한 hCaptcha 풀기"""
    resp = requests.post("https://api.anti-captcha.com/createTask", json={
        "clientKey": api_key,
        "task": {
            "type": "HCaptchaTaskProxyless",
            "websiteURL": page_url,
            "websiteKey": site_key
        }
    }).json()

    task_id = resp["taskId"]

    for _ in range(60):
        time.sleep(3)
        result = requests.post("https://api.anti-captcha.com/getTaskResult", json={
            "clientKey": api_key,
            "taskId": task_id
        }).json()
        if result["status"] == "ready":
            return result["solution"]["gRecaptchaResponse"]
    return None
```

### 영구 세션

```python
# scripts/session_manager.py
import json
import os
from pathlib import Path

SESSIONS_DIR = Path.home() / ".usan" / "browser-sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

def save_cookies(driver, session_name):
    """쿠키를 JSON으로 저장"""
    cookies = driver.get_cookies()
    path = SESSIONS_DIR / f"{session_name}_cookies.json"
    path.write_text(json.dumps(cookies, indent=2))
    return path

def load_cookies(driver, session_name):
    """저장된 세션에서 쿠키 로드"""
    path = SESSIONS_DIR / f"{session_name}_cookies.json"
    if path.exists():
        cookies = json.loads(path.read_text())
        for cookie in cookies:
            driver.add_cookie(cookie)
        return True
    return False

def save_local_storage(page, session_name):
    """localStorage 저장"""
    ls = page.evaluate("() => JSON.stringify(localStorage)")
    path = SESSIONS_DIR / f"{session_name}_localStorage.json"
    path.write_text(ls)
    return path

def load_local_storage(page, session_name):
    """localStorage 복원"""
    path = SESSIONS_DIR / f"{session_name}_localStorage.json"
    if path.exists():
        data = path.read_text()
        page.evaluate(f"(data) => {{ Object.entries(JSON.parse(data)).forEach(([k,v]) => localStorage.setItem(k,v)) }}", data)
        return True
    return False
```

### 사일런트 자동화 워크플로우

```python
# 완전한 사일런트 자동화 예제
from DrissionPage import ChromiumPage, ChromiumOptions

# 스텔스 구성
options = ChromiumOptions()
options.headless()
options.set_argument('--disable-blink-features=AutomationControlled')
options.set_argument('--disable-dev-shm-usage')
options.set_user_agent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

page = ChromiumPage(options)

# CF 우회와 함께 탐색
page.get("https://target-site.com")

# 챌린지 대기
page.wait.doc_loaded()

# 사일런트 상호작용
page.ele("@id=username").input("user@email.com")
page.ele("@id=password").input("password123")
page.ele("@type=submit").click()

# 재사용을 위한 세션 저장
page.cookies.save("~/.usan/browser-sessions/target-site.json")
```

## 프록시 로테이션

```python
# scripts/proxy_rotate.py
import random
import json
from pathlib import Path

def get_proxy():
    """풀에서 랜덤 프록시 가져오기"""
    config = json.loads((Path.home() / ".usan/secrets/proxies.json").read_text())
    proxies = config.get("residential", [])
    return random.choice(proxies) if proxies else config.get("rotating")

# DrissionPage와 함께 사용
options = ChromiumOptions()
options.set_proxy(get_proxy())
page = ChromiumPage(options)
```

## 사용자 입력 필요 항목

이 스킬을 완성하려면 다음을 제공하세요:

1. **CAPTCHA API 키** (선택 사항이지만 권장):
   - 2Captcha 키: https://2captcha.com
   - Anti-Captcha 키: https://anti-captcha.com
   - CapSolver 키: https://capsolver.com

2. **프록시 구성** (선택 사항):
   - 레지덴셜 프록시 제공자 자격 증명
   - 또는 SOCKS5/HTTP 프록시 목록

3. **대상 사이트** (사전 구성된 세션용):
   - 어떤 사이트에 로그인 유지가 필요한가?
   - 어떤 자격 증명을 저장해야 하는가?

## 파일 구조

```
stealth-browser/
├── SKILL.md
├── scripts/
│   ├── stealth_session.py      # 메인 스텔스 브라우저 래퍼
│   ├── solve_captcha.py        # CAPTCHA 풀이 유틸리티
│   ├── session_manager.py      # 쿠키/localStorage 영속성
│   ├── proxy_rotate.py         # 프록시 로테이션
│   └── cf_bypass.py            # Cloudflare 전용 우회
└── references/
    ├── fingerprints.md         # 브라우저 핑거프린트 상세
    └── detection-tests.md      # 안티 디텍션 테스트 사이트
```

## 안티 디텍션 테스트

```bash
# 스텔스가 작동하는지 확인:
python scripts/stealth_open.py --url "https://bot.sannysoft.com"
python scripts/stealth_open.py --url "https://nowsecure.nl"
python scripts/stealth_open.py --url "https://arh.antoinevastel.com/bots/areyouheadless"
python scripts/stealth_open.py --url "https://pixelscan.net"
```

## agent-browser 연동

간단한 작업에는 영구 프로필과 함께 agent-browser 사용:

```bash
# 스텔스 프로필 한 번 생성
agent-browser --profile ~/.stealth-profile --headed open https://login-site.com
# 수동 로그인 후 닫기

# 인증된 세션 재사용 (headless)
agent-browser --profile ~/.stealth-profile snapshot
agent-browser --profile ~/.stealth-profile click @e5
```

Cloudflare 또는 CAPTCHA가 많은 사이트에는 Python 스크립트를 대신 사용하세요.

## 모범 사례

1. **항상 `headless: 'new'`을 사용** (`headless: true`보다 탐지가 어려움)
2. **User-Agent를 브라우저 버전에 맞게 로테이션**
3. **작업 간 랜덤 지연 추가** (100-500ms)
4. **민감한 대상에는 레지덴셜 프록시 사용**
5. **로그인 성공 후 세션 저장**
6. **프로덕션 사용 전 bot.sannysoft.com에서 테스트**
