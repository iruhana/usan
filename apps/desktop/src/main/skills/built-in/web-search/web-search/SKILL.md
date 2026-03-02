---
id: web-search
name: 웹 검색
description: 웹에서 정보를 검색하고 결과를 요약합니다
triggers: [웹 검색, 인터넷 검색, 검색해줘, 찾아줘, 알려줘, 궁금한거]
tools: [web_search, browser_open, browser_read]
category: information
metadata: {"emoji":"🌐","examples":["검색해줘","인터넷에서 찾아줘"]}
---

## 절차

1. 사용자의 질문에서 핵심 키워드를 추출합니다
2. `web_search` 도구로 검색합니다
3. 검색 결과가 부족하면 `browser_open`으로 관련 페이지를 열고 `browser_read`로 내용을 읽습니다
4. 결과를 한국어로 이해하기 쉽게 요약합니다
