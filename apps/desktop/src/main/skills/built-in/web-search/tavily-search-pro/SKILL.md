---
id: tavily-search-pro
name: Tavily 통합 검색
description: "Tavily AI 검색 플랫폼 5가지 모드: Search(웹/뉴스/금융), Extract(URL 콘텐츠 추출), Crawl(웹사이트 크롤링), Map(사이트맵 탐색), Research(심층 리서치). LLM 답변 포함 검색, 콘텐츠 추출, 사이트 크롤링, 딥 리서치에 활용합니다."
version: 1.0.0
triggers:
  - Tavily 검색
  - 타빌리 검색
  - 웹 크롤링
  - 사이트맵
  - URL 추출
  - 콘텐츠 추출
  - tavily search
  - web crawl
  - site map
  - extract url
metadata:
  emoji: "🔎"
  category: web-search
  source: "openclaw"
  license: "Apache-2.0"
---

# Tavily 통합 검색

AI 기반 웹 검색 플랫폼으로 5가지 모드를 지원합니다: Search, Extract, Crawl, Map, Research.

## 사전 요구사항

- `TAVILY_API_KEY` 환경변수
- Python 3
- `tavily-python` 패키지 (`pip install tavily-python`)

## 스크립트 위치

```bash
python3 lib/tavily_search.py <명령> "쿼리" [옵션]
```

---

## 명령어

### search -- 웹 검색 (기본)

범용 웹 검색. 선택적으로 LLM 합성 답변을 포함할 수 있습니다.

```bash
python3 lib/tavily_search.py search "쿼리" [옵션]
```

**예시:**
```bash
# 기본 검색
python3 lib/tavily_search.py search "최신 AI 뉴스"

# LLM 답변 포함
python3 lib/tavily_search.py search "양자 컴퓨팅이란" --answer

# 고급 깊이 (더 나은 결과, 2 크레딧)
python3 lib/tavily_search.py search "기후 변화 해결책" --depth advanced

# 시간 필터링
python3 lib/tavily_search.py search "OpenAI 발표" --time week

# 도메인 필터링
python3 lib/tavily_search.py search "머신러닝" --include-domains arxiv.org,nature.com

# 국가 부스트
python3 lib/tavily_search.py search "tech startups" --country US

# 원시 콘텐츠 및 이미지 포함
python3 lib/tavily_search.py search "태양 에너지" --raw --images -n 10

# JSON 출력
python3 lib/tavily_search.py search "비트코인 가격" --json
```

---

### news -- 뉴스 검색

뉴스 기사에 최적화된 검색입니다. `topic=news`로 설정됩니다.

```bash
python3 lib/tavily_search.py news "쿼리" [옵션]
```

**예시:**
```bash
python3 lib/tavily_search.py news "AI 규제"
python3 lib/tavily_search.py news "한국 기술 산업" --time day --answer
python3 lib/tavily_search.py news "주식 시장" --time week -n 10
```

---

### finance -- 금융 검색

금융 데이터 및 뉴스에 최적화된 검색입니다. `topic=finance`로 설정됩니다.

```bash
python3 lib/tavily_search.py finance "쿼리" [옵션]
```

**예시:**
```bash
python3 lib/tavily_search.py finance "NVIDIA 주식 분석"
python3 lib/tavily_search.py finance "암호화폐 시장 동향" --time month
python3 lib/tavily_search.py finance "S&P 500 2026 전망" --answer
```

---

### extract -- URL에서 콘텐츠 추출

하나 이상의 URL에서 읽을 수 있는 콘텐츠를 추출합니다.

```bash
python3 lib/tavily_search.py extract URL [URL...] [옵션]
```

**매개변수:**
- `urls`: 추출할 URL (위치 인수)
- `--depth basic|advanced`: 추출 깊이
- `--format markdown|text`: 출력 형식 (기본: markdown)
- `--query "텍스트"`: 쿼리 관련성에 따라 추출 청크 재정렬

**예시:**
```bash
# 단일 URL 추출
python3 lib/tavily_search.py extract "https://example.com/article"

# 복수 URL 추출
python3 lib/tavily_search.py extract "https://url1.com" "https://url2.com"

# 고급 추출 + 관련성 재정렬
python3 lib/tavily_search.py extract "https://arxiv.org/paper" --depth advanced --query "트랜스포머 아키텍처"

# 텍스트 형식 출력
python3 lib/tavily_search.py extract "https://example.com" --format text
```

---

### crawl -- 웹사이트 크롤링

루트 URL에서 시작하여 링크를 따라가며 웹사이트를 크롤링합니다.

```bash
python3 lib/tavily_search.py crawl URL [옵션]
```

**매개변수:**
- `url`: 크롤링 시작 URL
- `--depth basic|advanced`: 크롤링 깊이
- `--max-depth N`: 최대 링크 깊이 (기본: 2)
- `--max-breadth N`: 깊이 단계별 최대 페이지 (기본: 10)
- `--limit N`: 최대 총 페이지 (기본: 10)
- `--instructions "텍스트"`: 자연어 크롤링 지시사항
- `--select-paths p1,p2`: 이 경로 패턴만 크롤링
- `--exclude-paths p1,p2`: 이 경로 패턴 제외
- `--format markdown|text`: 출력 형식

**예시:**
```bash
# 기본 크롤링
python3 lib/tavily_search.py crawl "https://docs.example.com"

# 지시사항 포함 집중 크롤링
python3 lib/tavily_search.py crawl "https://docs.python.org" --instructions "asyncio 문서 전부 찾기" --limit 20

# 특정 경로만 크롤링
python3 lib/tavily_search.py crawl "https://example.com" --select-paths "/blog,/docs" --max-depth 3
```

---

### map -- 사이트맵 탐색

웹사이트의 모든 URL을 발견합니다 (사이트맵).

```bash
python3 lib/tavily_search.py map URL [옵션]
```

**매개변수:**
- `url`: 매핑할 루트 URL
- `--max-depth N`: 탐색 깊이 (기본: 2)
- `--max-breadth N`: 단계별 폭 (기본: 20)
- `--limit N`: 최대 URL 수 (기본: 50)

**예시:**
```bash
# 사이트 매핑
python3 lib/tavily_search.py map "https://example.com"

# 심층 매핑
python3 lib/tavily_search.py map "https://docs.python.org" --max-depth 3 --limit 100
```

---

### research -- 딥 리서치

출처가 포함된 포괄적인 AI 기반 주제 리서치입니다.

```bash
python3 lib/tavily_search.py research "쿼리" [옵션]
```

**매개변수:**
- `query`: 리서치 질문
- `--model mini|pro|auto`: 리서치 모델 (기본: auto)
  - `mini`: 빠르고 저렴
  - `pro`: 더 철저
  - `auto`: Tavily가 결정
- `--json`: JSON 출력

**예시:**
```bash
# 기본 리서치
python3 lib/tavily_search.py research "2026년 AI가 의료에 미치는 영향"

# Pro 모델로 철저한 리서치
python3 lib/tavily_search.py research "양자 컴퓨팅 접근법 비교" --model pro

# JSON 출력
python3 lib/tavily_search.py research "전기차 시장 분석" --json
```

---

## 옵션 참조

| 옵션 | 적용 대상 | 설명 | 기본값 |
|---|---|---|---|
| `--depth basic\|advanced` | search, news, finance, extract | 검색/추출 깊이 | basic |
| `--time day\|week\|month\|year` | search, news, finance | 시간 범위 필터 | 없음 |
| `-n NUM` | search, news, finance | 최대 결과 수 (0-20) | 5 |
| `--answer` | search, news, finance | LLM 답변 포함 | 꺼짐 |
| `--raw` | search, news, finance | 원시 페이지 콘텐츠 포함 | 꺼짐 |
| `--images` | search, news, finance | 이미지 URL 포함 | 꺼짐 |
| `--include-domains d1,d2` | search, news, finance | 이 도메인만 포함 | 없음 |
| `--exclude-domains d1,d2` | search, news, finance | 이 도메인 제외 | 없음 |
| `--country XX` | search, news, finance | 국가 결과 부스트 | 없음 |
| `--json` | 전체 | 구조화된 JSON 출력 | 꺼짐 |
| `--format markdown\|text` | extract, crawl | 콘텐츠 형식 | markdown |
| `--query "텍스트"` | extract | 관련성 재정렬 쿼리 | 없음 |
| `--model mini\|pro\|auto` | research | 리서치 모델 | auto |
| `--max-depth N` | crawl, map | 최대 링크 깊이 | 2 |
| `--max-breadth N` | crawl, map | 단계별 최대 페이지 | 10/20 |
| `--limit N` | crawl, map | 최대 총 페이지/URL | 10/50 |
| `--instructions "텍스트"` | crawl | 자연어 지시사항 | 없음 |
| `--select-paths p1,p2` | crawl | 포함 경로 패턴 | 없음 |
| `--exclude-paths p1,p2` | crawl | 제외 경로 패턴 | 없음 |

---

## 오류 처리

- **API 키 누락:** 설정 안내가 포함된 명확한 오류 메시지
- **401 Unauthorized:** 유효하지 않은 API 키
- **429 Rate Limit:** 요청 한도 초과, 나중에 재시도
- **네트워크 오류:** 원인이 포함된 설명적 오류
- **결과 없음:** "결과를 찾을 수 없습니다" 메시지
- **타임아웃:** 모든 HTTP 요청에 30초 타임아웃

---

## 크레딧 및 요금

| API | Basic | Advanced |
|---|---|---|
| Search | 1 크레딧 | 2 크레딧 |
| Extract | URL당 1 크레딧 | URL당 2 크레딧 |
| Crawl | 페이지당 1 크레딧 | 페이지당 2 크레딧 |
| Map | 1 크레딧 | 1 크레딧 |
| Research | 모델에 따라 상이 | - |
