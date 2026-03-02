---
id: hwp-basic
name: 한글 문서 작업
description: 한컴오피스 한글(HWP)로 문서를 작업합니다
triggers: [한글 문서, HWP, 한글 열기, 한글 파일, 한컴, 아래아한글, hwp 파일]
tools: [run_command, focus_window, keyboard_type, keyboard_hotkey, screenshot, mouse_click]
category: app-control
metadata: {"emoji":"📝","os":["win32"],"examples":["한글 문서 열어줘","HWP 파일 편집해줘"]}
---

## 절차

### 파일 열기
1. `run_command`로 한글 실행: `start "" "C:\Program Files (x86)\HNC\Hwp\HwpApp.exe"` (경로는 버전에 따라 다를 수 있음)
2. 특정 파일 열기: `start "" "파일경로.hwp"`

### 새 문서 작성
1. 한글을 실행합니다
2. `keyboard_type`으로 텍스트를 입력합니다
3. Ctrl+S로 저장합니다

### 문서 편집
1. `screenshot`으로 현재 한글 화면을 확인합니다
2. 필요한 위치에 `mouse_click`으로 커서를 놓습니다
3. `keyboard_type`으로 텍스트를 입력합니다

## 주요 단축키
- **저장**: Ctrl+S
- **다른 이름으로 저장**: Ctrl+Shift+S
- **실행 취소**: Ctrl+Z
- **글꼴 크기**: Alt+Shift+E (크게), Alt+Shift+R (작게)
- **표 삽입**: Ctrl+N, T
- **인쇄**: Ctrl+P

한컴오피스 설치 필요.
