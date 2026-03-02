---
id: windows-helper
name: 윈도우 도우미
description: 프로그램 창의 텍스트를 읽거나, 버튼을 이름으로 클릭하거나, 팝업 대화상자를 처리합니다.
triggers: [창 내용, 버튼 클릭, 팝업, 대화상자, 화면 텍스트, 메뉴 클릭]
tools: [run_skill_script, screenshot, focus_window]
category: computer-use
metadata: {"emoji":"🖥️","os":["win32"],"examples":["메모장에 뭐라고 써있어?","'저장' 버튼 눌러줘","팝업 창 닫아줘"]}
---

## 절차

### 창 텍스트 읽기
1. `focus_window`로 대상 창을 앞으로 가져옵니다
2. `run_skill_script`로 `read_window.ps1`을 실행합니다:
   - `run_skill_script(skill_id: "windows-helper", script_name: "read_window.ps1", args: "메모장")`
3. 결과를 사용자에게 알려줍니다

### 버튼/요소 클릭
1. `run_skill_script`로 `click_element.ps1`을 실행합니다:
   - `run_skill_script(skill_id: "windows-helper", script_name: "click_element.ps1", args: "저장 -window 메모장")`
2. 클릭 성공 여부를 `screenshot`으로 확인합니다

### 팝업/대화상자 처리
1. `screenshot`으로 팝업 내용을 확인합니다
2. `run_skill_script`로 `handle_dialog.ps1`을 실행합니다:
   - `run_skill_script(skill_id: "windows-helper", script_name: "handle_dialog.ps1", args: "dismiss")`
3. 처리 결과를 알려줍니다

### UI 요소 목록
- `run_skill_script(skill_id: "windows-helper", script_name: "list_ui_elements.ps1", args: "크롬")`
