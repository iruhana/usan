---
id: system-optimize
name: 시스템 최적화
description: 임시 파일 정리 및 시작 프로그램 관리로 컴퓨터를 빠르게 합니다
version: 1.0.0
triggers:
  - 시스템 최적화
  - 컴퓨터 정리
  - 임시 파일 삭제
  - 시작 프로그램
  - cleanup
  - optimize
metadata:
  emoji: "⚡"
  category: computer-use
  dangerous: false
---

# 시스템 최적화

## 임시 파일 정리
- `clean_temp_files`: 7일 이상 된 .tmp/.log/.bak/.old/.cache/.dmp 파일 삭제
- 먼저 스캔 결과를 보여주고 사용자 확인 후 삭제 진행

## 시작 프로그램 관리
- `list_startup_programs`: 자동 시작 프로그램 목록 표시
- `toggle_startup_program`: 시작 프로그램 활성화/비활성화
- 시스템 보호 프로그램(Windows Defender 등)은 변경 불가
