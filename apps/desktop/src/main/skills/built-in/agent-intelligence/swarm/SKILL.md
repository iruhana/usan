---
id: swarm
name: "스웜 병렬 실행"
description: "저비용 모델을 활용한 병렬, 배치, 리서치 작업 오프로딩으로 LLM 비용을 최대 200배 절감합니다. 체인, 스켈레톤, 투표, 구조화 출력 등 다양한 실행 모드를 지원합니다."
version: 1.0.0
triggers:
  - "스웜"
  - "병렬 실행"
  - "비용 절감"
  - "배치 처리"
  - "저비용 모델"
  - "다중 프롬프트"
  - "리서치 병렬"
  - "체인 파이프라인"
  - "swarm"
  - "parallel execution"
  - "cost saving"
  - "batch processing"
  - "cheap model offload"
metadata:
  emoji: "🐝"
  category: "agent-intelligence"
  source: "openclaw"
  license: "Apache-2.0"
---

# 스웜 -- LLM 비용을 200배 절감하세요

**비싼 모델을 저렴한 일상 도구로 전환합니다. 병렬, 배치, 리서치 같은 작업을 Gemini Flash 워커에 오프로딩하여 비용을 대폭 절감합니다.**

## 한눈에 보기

| 30개 태스크 수행 방식 | 시간 | 비용 |
|----------------------|------|------|
| 고비용 모델 (순차) | ~30초 | ~$0.50 |
| Usan 스웜 (병렬) | ~1초 | ~$0.003 |

## 사용 시점

스웜은 다음에 적합합니다:
- **3개 이상의 독립적 태스크** (리서치, 요약, 비교)
- **여러 주제의 비교 또는 조사**
- **여러 URL** 가져오기/분석
- **배치 처리** (문서, 엔티티, 팩트)
- **복합 분석** 다중 관점 필요 시 체인 사용

## 빠른 참조

```bash
# 데몬 상태 확인 (매 세션마다 수행)
swarm status

# 실행 중이 아니면 시작
swarm start

# 병렬 프롬프트
swarm parallel "X는 무엇?" "Y는 무엇?" "Z는 무엇?"

# 여러 주제 리서치
swarm research "OpenAI" "Anthropic" "Mistral" --topic "AI 안전"

# 기능 확인
swarm capabilities
```

## 실행 모드

### 병렬 (Parallel)
N개 프롬프트를 N개 워커에서 동시 실행. 독립적 태스크에 최적.

```bash
swarm parallel "프롬프트1" "프롬프트2" "프롬프트3"
```

### 리서치 (Research)
다단계: 검색 -> 가져오기 -> 분석. Google Search 그라운딩 사용.

```bash
swarm research "회사A" "회사B" --topic "2026 가격 정책"
```

### 체인 (Chain) -- 정제 파이프라인
데이터가 여러 단계를 거치며, 각 단계는 다른 관점/필터를 적용합니다. 단계는 순차 실행; 단계 내 태스크는 병렬 실행.

**단계 모드:**
- `parallel` -- N 입력 -> N 워커 (같은 관점)
- `single` -- 병합된 입력 -> 1 워커
- `fan-out` -- 1 입력 -> 다른 관점의 N 워커
- `reduce` -- N 입력 -> 1개 종합 출력

**자동 체인** -- 원하는 것을 설명하면 최적 파이프라인 생성:
```bash
curl -X POST http://localhost:9999/chain/auto \
  -d '{"task":"비즈니스 기회 찾기","data":"...시장 데이터...","depth":"standard"}'
```

**수동 체인:**
```bash
swarm chain pipeline.json
# 또는
echo '{"stages":[...]}' | swarm chain --stdin
```

**깊이 프리셋:** `quick` (2단계), `standard` (4), `deep` (6), `exhaustive` (8)

**내장 관점:** extractor, filter, enricher, analyst, synthesizer, challenger, optimizer, strategist, researcher, critic

**실행 없이 미리보기:**
```bash
curl -X POST http://localhost:9999/chain/preview \
  -d '{"task":"...","depth":"standard"}'
```

### 벤치마크 (Benchmark)
동일 태스크에서 단일 vs 병렬 vs 체인을 LLM 심사 점수로 비교.

```bash
curl -X POST http://localhost:9999/benchmark \
  -d '{"task":"X 분석","data":"...","depth":"standard"}'
```

6개 FLASK 차원 평가: 정확도 (2x 가중치), 깊이 (1.5x), 완전성, 일관성, 실행 가능성 (1.5x), 뉘앙스.

### 기능 탐색 (Capabilities Discovery)
사용 가능한 실행 모드를 확인:
```bash
swarm capabilities
# 또는
curl http://localhost:9999/capabilities
```

## 프롬프트 캐시

LLM 응답의 LRU 캐시. **캐시 히트 시 212배 속도 향상** (병렬), **체인 514배**.

- instruction + input + perspective 해시로 키 생성
- 최대 500개 항목, 1시간 TTL
- 웹 검색 태스크는 건너뜀 (최신 데이터 필요)
- 디스크에 영속화하여 데몬 재시작 시에도 유지
- 태스크별 우회: `task.cache = false` 설정

```bash
# 캐시 통계 보기
curl http://localhost:9999/cache

# 캐시 지우기
curl -X DELETE http://localhost:9999/cache
```

## 단계 재시도 (Stage Retry)

체인 단계 내에서 태스크가 실패하면 전체 단계가 아닌 실패한 태스크만 재시도. 기본: 1회 재시도. `phase.retries` 또는 `options.stageRetries`로 설정 가능.

## 비용 추적

모든 엔드포인트는 `complete` 이벤트에 비용 데이터를 반환:
- `session` -- 현재 데몬 세션 누적
- `daily` -- 재시작 간 영속화, 하루 누적

```bash
swarm status        # 세션 + 일일 비용 표시
swarm savings       # 월별 절감 보고서
```

## 웹 검색

워커가 Google Search 그라운딩을 통해 라이브 웹 검색 (Gemini 전용, 추가 비용 없음).

```bash
# 리서치는 기본적으로 웹 검색 사용
swarm research "주제" --topic "각도"

# 웹 검색 포함 병렬
curl -X POST http://localhost:9999/parallel \
  -d '{"prompts":["X의 현재 가격?"],"options":{"webSearch":true}}'
```

## JavaScript API

```javascript
const { parallel, research } = require('./lib');
const { SwarmClient } = require('./lib/client');

// 간단한 병렬
const result = await parallel(['프롬프트1', '프롬프트2', '프롬프트3']);

// 스트리밍 클라이언트
const client = new SwarmClient();
for await (const event of client.parallel(prompts)) { ... }
for await (const event of client.research(subjects, topic)) { ... }

// 체인
const result = await client.chainSync({ task, data, depth });
```

## 데몬 관리

```bash
swarm start              # 데몬 시작 (백그라운드)
swarm stop               # 데몬 정지
swarm status             # 상태, 비용, 캐시 통계
swarm restart            # 데몬 재시작
swarm savings            # 월별 절감 보고서
swarm logs [N]           # 데몬 로그 마지막 N줄
```

## 성능

| 모드 | 태스크 수 | 시간 | 비고 |
|------|----------|------|------|
| 병렬 (단순) | 5 | ~700ms | 태스크당 유효 142ms |
| 병렬 (스트레스) | 10 | ~1.2s | 태스크당 유효 123ms |
| 체인 (standard) | 5 | ~14s | 3단계 다관점 |
| 체인 (quick) | 2 | ~3s | 2단계 추출+종합 |
| 캐시 히트 | 무관 | ~3-5ms | 200-500x 속도 향상 |
| 리서치 (웹) | 2 | ~15s | Google 그라운딩 지연 |

## 설정

위치: `~/.config/usan/swarm.yaml`

```yaml
swarm:
  enabled: true
  limits:
    max_nodes: 16
    max_concurrent_api: 16
  provider:
    name: gemini
    model: gemini-2.0-flash
  web_search:
    enabled: true
    parallel_default: false
  cost:
    max_daily_spend: 10.00
```

## 문제 해결

| 문제 | 해결 |
|------|------|
| 데몬이 실행 중이 아님 | `swarm start` |
| API 키 없음 | `GEMINI_API_KEY` 설정 또는 `npm run setup` 실행 |
| 속도 제한 | 설정에서 `max_concurrent_api` 낮추기 |
| 웹 검색 작동 안 함 | provider가 gemini이고 web_search.enabled 확인 |
| 캐시 오래된 결과 | `curl -X DELETE http://localhost:9999/cache` |
| 체인이 너무 느림 | `depth: "quick"` 사용 또는 컨텍스트 크기 확인 |

## 구조화 출력 (Structured Output)

스키마 검증이 포함된 JSON 출력 강제 -- 구조화 태스크에서 파싱 실패 제로.

```bash
# 내장 스키마 사용
curl -X POST http://localhost:9999/structured \
  -d '{"prompt":"엔티티 추출: Tim Cook이 iPhone 17을 발표했다","schema":"entities"}'

# 커스텀 스키마 사용
curl -X POST http://localhost:9999/structured \
  -d '{"prompt":"이 텍스트 분류","data":"...","schema":{"type":"object","properties":{"category":{"type":"string"}}}}'

# JSON 모드 (스키마 없이 JSON 강제)
curl -X POST http://localhost:9999/structured \
  -d '{"prompt":"가상 인물의 이름, 나이, 도시를 JSON으로 반환"}'

# 사용 가능한 스키마 목록
curl http://localhost:9999/structured/schemas
```

**내장 스키마:** `entities`, `summary`, `comparison`, `actions`, `classification`, `qa`

## 다수결 투표 (Majority Voting)

같은 프롬프트를 N번 병렬 실행하고 최선의 답변을 선택. 사실적/분석적 태스크에서 높은 정확도.

```bash
# 심사 전략 (LLM이 최선을 선택 -- 가장 신뢰성 높음)
curl -X POST http://localhost:9999/vote \
  -d '{"prompt":"SaaS 가격 책정의 핵심 요소는?","n":3,"strategy":"judge"}'

# 유사성 전략 (합의 -- 추가 비용 제로)
curl -X POST http://localhost:9999/vote \
  -d '{"prompt":"Python이 출시된 연도는?","n":3,"strategy":"similarity"}'

# 최장 전략 (휴리스틱 -- 추가 비용 제로)
curl -X POST http://localhost:9999/vote \
  -d '{"prompt":"재귀를 설명하세요","n":3,"strategy":"longest"}'
```

**전략:**
- `judge` -- LLM이 정확도/완전성/명확성/실행가능성으로 모든 후보를 평가, 우승자 선택 (N+1 호출)
- `similarity` -- Jaccard 단어 세트 유사성, 합의 답변 선택 (N 호출, 추가 비용 없음)
- `longest` -- 가장 긴 응답을 철저함의 휴리스틱으로 선택 (N 호출, 추가 비용 없음)

**사용 시점:** 사실 확인, 중요 결정, 정확도 > 속도인 모든 태스크.

## 자기 성찰 (Self-Reflection)

체인/스켈레톤 출력 후 선택적 비평 패스. 5개 차원을 평가하고 임계값 미만이면 자동 정제.

```bash
# 체인 또는 스켈레톤 요청에 reflect:true 추가
curl -X POST http://localhost:9999/chain/auto \
  -d '{"task":"AI 칩 시장 분석","data":"...","reflect":true}'
```

## 스켈레톤 오브 쏘트 (Skeleton-of-Thought)

개요 생성 -> 각 섹션을 병렬 확장 -> 일관된 문서로 병합. 장문 콘텐츠에 최적.

```bash
curl -X POST http://localhost:9999/skeleton \
  -d '{"task":"SaaS 가격 책정 종합 가이드 작성","maxSections":6,"reflect":true}'
```

**성능:** 21초에 14,478자 (675자/초) -- 체인 대비 5.1배 더 많은 콘텐츠, 2.9배 높은 처리량.

**언제 무엇을 사용:**
- **SoT** -> 장문 콘텐츠, 보고서, 가이드, 문서 (자연스러운 섹션이 있는 모든 것)
- **체인** -> 분석, 리서치, 적대적 검토 (다중 관점이 필요한 모든 것)
- **병렬** -> 독립 태스크, 배치 처리
- **구조화** -> 엔티티 추출, 분류, 신뢰할 수 있는 JSON이 필요한 모든 태스크
- **투표** -> 사실 정확도, 중요 결정, 합의 구축

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /health | 상태 확인 |
| GET | /status | 상세 상태 + 비용 + 캐시 |
| GET | /capabilities | 실행 모드 탐색 |
| POST | /parallel | N개 프롬프트 병렬 실행 |
| POST | /research | 다단계 웹 리서치 |
| POST | /skeleton | 스켈레톤 오브 쏘트 (개요 -> 확장 -> 병합) |
| POST | /chain | 수동 체인 파이프라인 |
| POST | /chain/auto | 자동 체인 빌드 + 실행 |
| POST | /chain/preview | 실행 없이 체인 미리보기 |
| POST | /chain/template | 미리 구축된 템플릿 실행 |
| POST | /structured | 스키마 검증 포함 강제 JSON |
| GET | /structured/schemas | 내장 스키마 목록 |
| POST | /vote | 다수결 투표 (best-of-N) |
| POST | /benchmark | 품질 비교 테스트 |
| GET | /templates | 체인 템플릿 목록 |
| GET | /cache | 캐시 통계 |
| DELETE | /cache | 캐시 지우기 |

## 비용 비교

| 모델 | 1M 토큰당 비용 | 상대 비용 |
|------|----------------|-----------|
| Claude Opus 4 | ~$15 입력 / $75 출력 | 1x |
| GPT-4o | ~$2.50 입력 / $10 출력 | ~7x 저렴 |
| Gemini Flash | ~$0.075 입력 / $0.30 출력 | **200x 저렴** |

캐시 히트는 사실상 무료 (~3-5ms, API 호출 없음).
