---
id: kakaotalk-send
name: 카카오톡 메시지 전송
description: 카카오톡으로 메시지를 보냅니다
triggers: [카카오톡, 카톡 보내, 카톡 전송, 메시지 보내줘, 톡 보내]
tools: [focus_window, keyboard_type, keyboard_hotkey, screenshot, mouse_click]
category: app-control
metadata: {"emoji":"💬","os":["win32"],"examples":["엄마한테 카톡 보내줘","카카오톡으로 메시지 전송"]}
---

## 절차

1. `focus_window`로 카카오톡 창을 앞으로 가져옵니다
2. 카카오톡이 없으면 `run_command`로 실행합니다: `start "" "%LOCALAPPDATA%\Kakao\KakaoTalk\KakaoTalk.exe"`
3. `screenshot`으로 현재 카카오톡 화면을 확인합니다
4. 채팅방 찾기:
   - Ctrl+F로 검색창을 열고 상대방 이름을 입력합니다
   - 해당 채팅방을 클릭합니다
5. 메시지 입력 필드에 `keyboard_type`으로 텍스트를 입력합니다
6. Enter 키로 전송합니다

보내기 전 내용/받는사람 확인 필수.
