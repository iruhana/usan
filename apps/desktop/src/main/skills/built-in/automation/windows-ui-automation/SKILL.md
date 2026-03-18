---
id: windows-ui-automation
name: Windows UI 자동화
description: PowerShell을 사용한 Windows GUI 자동화. 마우스, 키보드, 창 관리 등 데스크탑 사용자 입력을 시뮬레이션합니다. 비웹 애플리케이션의 커서 이동, 버튼 클릭, 텍스트 입력, 창 상태 관리에 사용합니다.
version: 1.0.0
triggers:
  - UI 자동화
  - 파워쉘 자동화
  - 윈도우 GUI 제어
  - 데스크탑 입력 시뮬레이션
  - 창 상태 관리
  - windows ui automation
  - powershell automation
  - gui control
  - desktop input simulation
  - window state management
metadata:
  emoji: "⚙️"
  category: automation
  source: "openclaw"
  license: "Apache-2.0"
---

# Windows UI 자동화

PowerShell을 사용하여 Windows 데스크탑 환경을 프로그래밍 방식으로 제어합니다.

## 핵심 기능

- **마우스**: 이동, 클릭 (좌클릭/우클릭/더블 클릭), 드래그
- **키보드**: 텍스트 전송, 특수 키 입력 (Enter, Tab, Alt 등)
- **창 관리**: 찾기, 포커스, 최소화/최대화, 스크린샷

## 사용 가이드

### 마우스 제어

제공된 PowerShell 스크립트 `mouse_control.ps1.txt` 사용:

```powershell
# X, Y로 이동
powershell -File skills/windows-ui-automation/mouse_control.ps1.txt -Action move -X 500 -Y 500

# 현재 위치에서 클릭
powershell -File skills/windows-ui-automation/mouse_control.ps1.txt -Action click

# 우클릭
powershell -File skills/windows-ui-automation/mouse_control.ps1.txt -Action rightclick
```

### 키보드 제어

`keyboard_control.ps1.txt` 사용:

```powershell
# 텍스트 입력
powershell -File skills/windows-ui-automation/keyboard_control.ps1.txt -Text "Hello World"

# Enter 키 누르기
powershell -File skills/windows-ui-automation/keyboard_control.ps1.txt -Key "{ENTER}"
```

### 창 관리

제목으로 창에 포커스:
```powershell
$wshell = New-Object -ComObject WScript.Shell; $wshell.AppActivate("Notepad")
```

## 모범 사례

1. **안전**: 항상 마우스를 천천히 이동하거나 작업 간 딜레이를 포함하세요.
2. **검증**: 복잡한 UI 작업 전후에 스크린샷을 찍어 상태를 확인하세요.
3. **좌표**: 좌표 (0,0)은 기본 모니터의 좌측 상단입니다.
