---
id: file-organize
name: 파일 정리
description: 파일과 폴더를 정리합니다
triggers: [파일 정리, 폴더 정리, 파일 찾기, 파일 이동, 파일 삭제, 파일 복사, 바탕화면 정리]
tools: [list_directory, run_command, read_file, write_file, delete_file]
category: file
metadata: {"emoji":"📁","examples":["바탕화면 정리해줘","파일 찾아줘"]}
---

## 절차

1. `list_directory`로 대상 폴더의 파일 목록을 확인합니다
2. 파일 종류별로 분류합니다 (문서, 이미지, 동영상, 음악, 압축 등)
3. 사용자에게 정리 계획을 설명합니다
4. 확인을 받은 후 `run_command`로 파일을 이동합니다

## 주의사항
- 삭제 전에 반드시 사용자에게 확인합니다
- 시스템 파일은 절대 건드리지 않습니다
- 바탕화면 정리 시 바로가기(.lnk)는 보존합니다
