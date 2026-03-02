---
id: naver-search
name: 네이버 검색
description: 네이버에서 정보를 검색합니다
triggers: [네이버 검색, 네이버에서 찾아, 네이버 뉴스, 네이버 지식인, 네이버 블로그]
tools: [browser_open, browser_type, browser_click, browser_read, browser_screenshot]
category: information
metadata: {"emoji":"🔍","examples":["네이버에서 검색해줘","네이버 뉴스 보여줘"]}
---

## 절차

1. `browser_open`으로 `https://search.naver.com/search.naver?query=검색어`를 엽니다
2. 검색 결과 페이지가 로드되면 `browser_read`로 내용을 읽습니다
3. 결과를 한국어로 요약합니다
4. 더 자세한 정보가 필요하면 관련 링크를 클릭하여 내용을 읽습니다

## 카테고리별 검색
- **뉴스**: `https://search.naver.com/search.naver?where=news&query=검색어`
- **블로그**: `https://search.naver.com/search.naver?where=post&query=검색어`
- **지식인**: `https://search.naver.com/search.naver?where=kin&query=검색어`
