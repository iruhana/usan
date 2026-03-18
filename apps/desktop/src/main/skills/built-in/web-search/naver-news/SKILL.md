---
id: naver-news
name: 네이버 뉴스 검색
description: 네이버 검색 API를 사용하여 한국 뉴스 기사를 검색합니다. 최신 뉴스, 특정 주제의 뉴스, 일일 뉴스 요약 등에 활용합니다.
version: 1.0.0
triggers:
  - 네이버 뉴스
  - 뉴스 검색
  - 최신 뉴스
  - 한국 뉴스
  - 뉴스 알려줘
  - naver news
  - korean news search
metadata:
  emoji: "📰"
  category: web-search
  source: "openclaw"
  license: "Apache-2.0"
---

# 네이버 뉴스 검색

네이버 검색 API를 통해 한국 뉴스 기사를 검색합니다.

## 사전 요구사항

- Python 3
- 환경변수: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`

### API 키 발급 방법

1. https://developers.naver.com/ 방문
2. 애플리케이션 등록
3. "검색" (Search) API 활성화
4. Client ID와 Client Secret 복사
5. Usan 설정에서 환경변수로 등록

## 사용법

검색 스크립트를 실행합니다:

```bash
python scripts/search_news.py "검색어" --display 10 --sort date
```

### 옵션

| 옵션 | 설명 | 기본값 |
|---|---|---|
| `--display N` | 페이지당 결과 수 (1-100) | 10 |
| `--start N` | 시작 위치 (1-1000) | 1 |
| `--sort sim\|date` | 정렬: 관련도(sim) 또는 날짜(date) | date |
| `--after DATETIME` | 이 시간 이후 뉴스만 표시 (ISO 8601) | 없음 |
| `--min-results N` | 최소 결과 수 (자동 페이지네이션) | 없음 |
| `--max-pages N` | 자동 페이지네이션 최대 페이지 수 | 5 |
| `--json` | JSON 형식으로 출력 | 꺼짐 |

## 절차

1. 사용자의 요청에서 검색 키워드를 추출합니다
2. 검색 스크립트를 실행하여 네이버 뉴스 API에서 결과를 가져옵니다
3. 결과를 한국어로 이해하기 쉽게 요약합니다

### 특정 주제의 최신 뉴스

```bash
python scripts/search_news.py "AI 인공지능" --display 20 --sort date
```

### 관련도 순 검색

```bash
python scripts/search_news.py "삼성전자" --sort sim
```

### 시간 필터링 (최근 뉴스만)

```bash
# 오늘 오전 9시 이후 뉴스
python scripts/search_news.py "경제" --display 50 --sort sim --after "2026-01-29T09:00:00+09:00"

# 최근 1시간 이내 뉴스
python scripts/search_news.py "속보" --after "$(date -u -d '1 hour ago' '+%Y-%m-%dT%H:%M:%S%z')"
```

### 자동 페이지네이션 (최소 결과 보장)

```bash
# 최소 30개 결과 확보
python scripts/search_news.py "AI" --sort sim --after "2026-01-29T09:00:00+09:00" --min-results 30 --display 50

# 최대 3페이지로 제한
python scripts/search_news.py "게임" --min-results 50 --max-pages 3
```

**자동 페이지네이션 동작 방식:**
1. 첫 페이지 조회 (예: 50개 결과)
2. 날짜 필터 적용 (예: 10개 남음)
3. `--min-results` 미달 시 자동으로 다음 페이지 조회
4. 최소 결과 수 도달 또는 `--max-pages` 한도 도달 시 중단

### 페이지네이션

```bash
# 처음 10개 결과
python scripts/search_news.py "경제" --display 10 --start 1

# 다음 10개 결과
python scripts/search_news.py "경제" --display 10 --start 11
```

## Python 코드에서 사용

```python
from scripts.search_news import search_news

result = search_news(
    query="경제 뉴스",
    display=10,
    sort="date"
)

for item in result["items"]:
    print(item["title"])
    print(item["description"])
    print(item["link"])
```

## 참고사항

- 검색어는 UTF-8 인코딩이어야 합니다
- 결과에 검색어 일치 부분에 `<b>` 태그가 포함됩니다 (필요 시 제거)
- 일일 제한: 애플리케이션당 25,000 API 호출
- `link` 필드는 네이버 뉴스 또는 원본 출처를 가리킬 수 있습니다
