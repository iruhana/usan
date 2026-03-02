---
id: data-shred
name: 안전 삭제
description: 파일을 복구할 수 없도록 완전히 삭제합니다
version: 1.0.0
triggers:
  - 안전 삭제
  - 파일 파쇄
  - 데이터 소각
  - secure delete
  - shred
metadata:
  emoji: "🔥"
  category: security
  dangerous: true
---

# 안전 삭제 (Data Shred)

파일을 3-pass 덮어쓰기(0 → 랜덤 → 0) 후 삭제합니다.
일반 삭제와 달리 복구 도구로도 내용을 되살릴 수 없습니다.

## 사용법

1. 사용자에게 삭제할 파일 경로를 확인합니다
2. **반드시** 사용자 확인을 받은 후 진행합니다
3. `secure_delete` 도구를 호출합니다

## 제한사항

- 최대 100MB 파일
- 디렉토리 직접 삭제 불가 (파일 단위로 처리)
- 시스템 파일 보호 (validatePath 적용)
