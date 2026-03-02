---
id: text-write
name: 문서 작성
description: 텍스트 문서를 작성하고 저장합니다
triggers: [문서 작성, 글 써줘, 편지 써줘, 이메일 작성, 보고서 작성, 메모 작성, 텍스트 작성]
tools: [write_file, read_file, clipboard_write]
category: notes
metadata: {"emoji":"✍️","examples":["보고서 작성해줘","메모 써줘"]}
---

## 절차

1. 사용자의 요청을 파악합니다 (어떤 종류의 문서인지)
2. 문서의 목적, 대상, 톤을 확인합니다
3. 초안을 작성하여 보여줍니다
4. 사용자의 피드백을 반영합니다
5. 최종본을 `write_file`로 저장하거나 `clipboard_write`로 클립보드에 복사합니다

## 문서 종류별 안내
- **편지/이메일**: 받는 사람, 용건을 물어봅니다
- **보고서**: 주제, 포함할 내용을 물어봅니다
- **메모**: 간단히 내용을 받아 저장합니다
