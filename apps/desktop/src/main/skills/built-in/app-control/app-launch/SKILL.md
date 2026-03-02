---
id: app-launch
name: 앱 실행
description: 프로그램을 찾아서 실행합니다
triggers: [실행해줘, 열어줘, 앱 실행, 프로그램 열기, 켜줘, 시작해줘]
tools: [run_command, list_windows, focus_window]
category: app-control
metadata: {"emoji":"🚀","os":["win32"],"examples":["메모장 열어줘","계산기 실행해줘","크롬 켜줘"]}
---

## 절차

1. 사용자가 원하는 프로그램을 파악합니다
2. `list_windows`로 이미 열려있는지 확인합니다
3. 이미 열려있으면 `focus_window`로 앞으로 가져옵니다
4. 열려있지 않으면 `run_command`로 실행합니다

## 일반 프로그램 명령어
- 메모장: `start notepad`
- 계산기: `start calc`
- 탐색기: `start explorer`
- 그림판: `start mspaint`
- 설정: `start ms-settings:`
