---
id: windows-control
name: Windows 데스크탑 제어
description: 마우스, 키보드, 스크린샷, 창 관리 등 Windows 데스크탑 전체를 자동화합니다. 모든 Windows 애플리케이션과 사람처럼 상호작용할 수 있습니다.
version: 1.0.0
triggers:
  - 윈도우 제어
  - 데스크탑 자동화
  - 마우스 클릭
  - 키보드 입력
  - 창 관리
  - 화면 캡처
  - windows control
  - desktop automation
  - mouse click
  - keyboard input
  - window management
  - screenshot desktop
metadata:
  emoji: "🖥️"
  category: automation
  source: "openclaw"
  license: "Apache-2.0"
---

# Windows 데스크탑 제어 스킬

Windows 데스크탑 전체 자동화. 마우스, 키보드, 화면을 사람처럼 제어합니다.

## 빠른 시작

모든 스크립트는 `skills/windows-control/scripts/`에 있습니다.

### 스크린샷
```bash
py screenshot.py > output.b64
```
전체 화면의 base64 PNG를 반환합니다.

### 클릭
```bash
py click.py 500 300              # (500, 300)에서 좌클릭
py click.py 500 300 right        # 우클릭
py click.py 500 300 left 2       # 더블 클릭
```

### 텍스트 입력
```bash
py type_text.py "Hello World"
```
현재 커서 위치에서 텍스트를 입력합니다 (키 사이 10ms 딜레이).

### 키 누르기
```bash
py key_press.py "enter"
py key_press.py "ctrl+s"
py key_press.py "alt+tab"
py key_press.py "ctrl+shift+esc"
```

### 마우스 이동
```bash
py mouse_move.py 500 300
```
좌표로 마우스를 이동합니다 (부드러운 0.2초 애니메이션).

### 스크롤
```bash
py scroll.py up 5      # 위로 5 노치 스크롤
py scroll.py down 10   # 아래로 10 노치 스크롤
```

### 창 관리
```bash
py focus_window.py "Chrome"           # 창을 앞으로 가져오기
py minimize_window.py "Notepad"       # 창 최소화
py maximize_window.py "VS Code"       # 창 최대화
py close_window.py "Calculator"       # 창 닫기
py get_active_window.py               # 활성 창 제목 가져오기
```

### 고급 작업
```bash
# 텍스트로 클릭 (좌표 불필요!)
py click_text.py "Save"               # 화면 어디에서든 "Save" 버튼 클릭
py click_text.py "Submit" "Chrome"    # Chrome에서만 "Submit" 클릭

# 드래그 앤 드롭
py drag.py 100 100 500 300            # (100,100)에서 (500,300)으로 드래그

# 안정적 자동화 (대기/찾기)
py wait_for_text.py "Ready" "App" 30  # 텍스트가 나타날 때까지 최대 30초 대기
py wait_for_window.py "Notepad" 10    # 창이 나타날 때까지 대기
py find_text.py "Login" "Chrome"      # 텍스트의 좌표 가져오기
py list_windows.py                    # 모든 열린 창 목록
```

### 창 텍스트 읽기
```bash
py read_window.py "Notepad"           # 메모장의 모든 텍스트 읽기
py read_window.py "Visual Studio"     # VS Code의 텍스트 읽기
py read_window.py "Chrome"            # 브라우저의 텍스트 읽기
```
Windows UI Automation을 사용하여 실제 텍스트를 추출합니다 (OCR이 아님). 스크린샷보다 훨씬 빠르고 정확합니다.

### UI 요소 읽기
```bash
py read_ui_elements.py "Chrome"               # 모든 인터랙티브 요소
py read_ui_elements.py "Chrome" --buttons-only  # 버튼만
py read_ui_elements.py "Chrome" --links-only    # 링크만
py read_ui_elements.py "Chrome" --json          # JSON 출력
```
버튼, 링크, 탭, 체크박스, 드롭다운과 클릭 좌표를 반환합니다.

### 웹페이지 콘텐츠 읽기
```bash
py read_webpage.py                     # 활성 브라우저 읽기
py read_webpage.py "Chrome"            # Chrome 지정
py read_webpage.py "Chrome" --buttons  # 버튼 포함
py read_webpage.py "Chrome" --links    # 좌표 포함 링크
py read_webpage.py "Chrome" --full     # 모든 요소 (입력, 이미지)
py read_webpage.py "Chrome" --json     # JSON 출력
```
제목, 텍스트, 버튼, 링크를 포함한 향상된 브라우저 콘텐츠 추출.

### 대화상자 처리
```bash
# 모든 열린 대화상자 목록
py handle_dialog.py list

# 현재 대화상자 내용 읽기
py handle_dialog.py read
py handle_dialog.py read --json

# 대화상자에서 버튼 클릭
py handle_dialog.py click "OK"
py handle_dialog.py click "Save"
py handle_dialog.py click "Yes"

# 대화상자 텍스트 필드에 입력
py handle_dialog.py type "myfile.txt"
py handle_dialog.py type "C:\path\to\file" --field 0

# 대화상자 닫기 (OK/Close/Cancel 자동 찾기)
py handle_dialog.py dismiss

# 대화상자 나타날 때까지 대기
py handle_dialog.py wait --timeout 10
py handle_dialog.py wait "Save As" --timeout 5
```
저장/열기 대화상자, 메시지 박스, 경고, 확인 등을 처리합니다.

### 이름으로 요소 클릭
```bash
py click_element.py "Save"                    # 어디서든 "Save" 클릭
py click_element.py "OK" --window "Notepad"   # 특정 창에서
py click_element.py "Submit" --type Button    # 버튼만
py click_element.py "File" --type MenuItem    # 메뉴 항목
py click_element.py --list                    # 클릭 가능 요소 목록
py click_element.py --list --window "Chrome"  # 특정 창에서 목록
```
좌표 없이 이름으로 버튼, 링크, 메뉴 항목을 클릭합니다.

### 화면 영역 읽기 (OCR - 선택 사항)
```bash
py read_region.py 100 100 500 300     # 좌표 영역의 텍스트 읽기
```
참고: Tesseract OCR 설치가 필요합니다. 더 나은 결과를 위해 read_window.py를 대신 사용하세요.

## 워크플로우 패턴

1. **창 읽기** - 특정 창에서 텍스트 추출 (빠르고 정확)
2. **UI 요소 읽기** - 좌표 포함 버튼, 링크 가져오기
3. **스크린샷** (필요시) - 시각적 레이아웃 확인
4. **실행** - 이름 또는 좌표로 요소 클릭
5. **대화상자 처리** - 팝업/저장 대화상자와 상호작용
6. **창 읽기** - 변경 사항 확인

## 화면 좌표

- 원점 (0, 0)은 좌측 상단
- 화면 해상도: 2560x1440 (스크린샷으로 확인)
- 스크린샷 분석에서 얻은 좌표 사용

## 예제

### 메모장 열고 입력
```bash
# Windows 키 누르기
py key_press.py "win"

# "notepad" 입력
py type_text.py "notepad"

# Enter 누르기
py key_press.py "enter"

# 잠시 후 입력
py type_text.py "Hello from Usan!"

# 저장
py key_press.py "ctrl+s"
```

### VS Code에서 클릭
```bash
# 현재 VS Code 내용 읽기
py read_window.py "Visual Studio Code"

# 특정 위치 클릭 (예: 파일 탐색기)
py click.py 50 100

# 파일명 입력
py type_text.py "test.js"

# Enter 누르기
py key_press.py "enter"

# 새 파일이 열렸는지 확인
py read_window.py "Visual Studio Code"
```

### 메모장 변경 사항 모니터링
```bash
# 현재 내용 읽기
py read_window.py "Notepad"

# 사용자가 무언가를 입력...

# 업데이트된 내용 읽기 (스크린샷 불필요!)
py read_window.py "Notepad"
```

## 텍스트 읽기 방법

**방법 1: Windows UI Automation (최적)**
- 모든 창에 `read_window.py` 사용
- 좌표 포함 버튼/링크에 `read_ui_elements.py` 사용
- 구조화된 브라우저 콘텐츠에 `read_webpage.py` 사용
- 실제 텍스트 데이터 가져오기 (이미지 기반 아님)

**방법 2: 이름으로 클릭**
- `click_element.py`로 이름으로 버튼/링크 클릭
- 좌표 불필요 - 요소를 자동으로 찾음
- 모든 창 또는 특정 창 대상 가능

**방법 3: 대화상자 처리**
- `handle_dialog.py`로 팝업, 저장 대화상자, 경고 처리
- 대화상자 내용 읽기, 버튼 클릭, 텍스트 입력
- 공통 버튼으로 자동 닫기 (OK, Cancel 등)

**방법 4: 스크린샷 + 비전 (폴백)**
- 전체 스크린샷 촬영
- AI가 시각적으로 텍스트 읽기
- 느리지만 모든 콘텐츠에 작동

**방법 5: OCR (선택 사항)**
- Tesseract와 함께 `read_region.py` 사용
- 추가 설치 필요
- 텍스트가 포함된 이미지/PDF에 적합

## 안전 기능

- `pyautogui.FAILSAFE = True` (마우스를 좌측 상단으로 이동하면 중단)
- 작업 간 짧은 딜레이
- 부드러운 마우스 이동 (즉시 점프 아님)

## 요구 사항

- Python 3.11+
- pyautogui
- pillow

## 팁

- 현재 상태를 보려면 항상 먼저 스크린샷을 찍으세요
- 좌표는 절대 좌표입니다 (창 기준 아님)
- 클릭 후 UI가 업데이트될 때까지 잠시 대기하세요
- 가능하면 `ctrl+z`로 되돌릴 수 있는 작업을 수행하세요
