---
id: agent-orchestrator
name: "에이전트 오케스트레이터"
description: "복잡한 태스크를 자율적 서브 에이전트로 분해, 생성, 조율하고 결과를 통합하는 멀티 에이전트 오케스트레이션 스킬입니다."
version: 1.0.0
triggers:
  - "오케스트레이션"
  - "멀티 에이전트"
  - "태스크 분해"
  - "에이전트 생성"
  - "서브 에이전트"
  - "병렬 에이전트"
  - "에이전트 조율"
  - "태스크 분할"
  - "메타 에이전트"
  - "작업 위임"
  - "orchestrate"
  - "multi-agent"
  - "decompose task"
  - "spawn agents"
  - "sub-agents"
  - "parallel agents"
  - "agent coordination"
  - "task breakdown"
  - "delegate tasks"
metadata:
  emoji: "🎛️"
  category: "agent-intelligence"
  source: "openclaw"
  license: "Apache-2.0"
---

# 에이전트 오케스트레이터

복잡한 태스크를 서브태스크로 분해하고, 자율적 서브 에이전트를 생성하여 작업을 조율하고 결과를 통합합니다.

## 핵심 워크플로우

### 1단계: 태스크 분해

매크로 태스크를 분석하여 독립적이고 병렬화 가능한 서브태스크로 분해합니다:

```
1. 최종 목표와 성공 기준을 식별합니다
2. 필요한 모든 주요 구성 요소/산출물을 나열합니다
3. 구성 요소 간 의존성을 결정합니다
4. 독립적인 작업을 병렬 서브태스크로 그룹화합니다
5. 순차 작업을 위한 의존성 그래프를 생성합니다
```

**분해 원칙:**
- 각 서브태스크는 독립적으로 완료 가능해야 합니다
- 에이전트 간 의존성을 최소화합니다
- 좁고 상호의존적인 태스크보다 넓고 자율적인 태스크를 선호합니다
- 각 서브태스크에 명확한 성공 기준을 포함합니다

### 2단계: 에이전트 생성

각 서브태스크에 대해 서브 에이전트 워크스페이스를 생성합니다:

```
<workspace>/<agent-name>/
├── SKILL.md          # 에이전트를 위해 생성된 스킬 파일
├── inbox/            # 입력 파일과 지시사항 수신
├── outbox/           # 완료된 작업 전달
├── workspace/        # 에이전트의 작업 영역
└── status.json       # 에이전트 상태 추적
```

**SKILL.md를 동적으로 생성**하며 포함하는 내용:
- 에이전트의 구체적 역할과 목표
- 필요한 도구와 기능
- 입력/출력 사양
- 성공 기준
- 통신 프로토콜

### 3단계: 에이전트 디스패치

각 에이전트를 초기화합니다:

1. `inbox/instructions.md`에 태스크 지시사항 기록
2. 필요한 입력 파일을 `inbox/`에 복사
3. `status.json`을 `{"state": "pending", "started": null}`로 설정
4. Task 도구를 사용하여 에이전트 생성:

```python
# 생성된 스킬로 에이전트 생성
Task(
    description=f"{agent_name}: {brief_description}",
    prompt=f"""
    {agent_path}/SKILL.md의 스킬을 읽고 지시사항을 따르세요.
    작업 공간은 {agent_path}/workspace/입니다.
    {agent_path}/inbox/instructions.md에서 태스크를 읽으세요.
    모든 출력을 {agent_path}/outbox/에 기록하세요.
    완료 시 {agent_path}/status.json을 업데이트하세요.
    """,
    subagent_type="general-purpose"
)
```

### 4단계: 모니터링 (체크포인트 기반)

완전 자율 에이전트의 경우 최소한의 모니터링이 필요합니다:

```python
# 에이전트 완료 확인
def check_agent_status(agent_path):
    status = read_json(f"{agent_path}/status.json")
    return status.get("state") == "completed"
```

각 에이전트의 `status.json`을 주기적으로 확인합니다. 에이전트는 완료 시 이 파일을 업데이트합니다.

### 5단계: 통합

모든 에이전트가 완료되면:

1. **출력 수집** -- 각 에이전트의 `outbox/`에서 수집
2. **산출물 검증** -- 성공 기준 대비 검증
3. **병합/통합** -- 필요에 따라 출력을 통합
4. **충돌 해결** -- 여러 에이전트가 공유 관심사를 다룬 경우
5. **요약 생성** -- 완료된 모든 작업의 요약

```python
# 통합 패턴
for agent in agents:
    outputs = glob(f"{agent.path}/outbox/*")
    validate_outputs(outputs, agent.success_criteria)
    consolidated_results.extend(outputs)
```

### 6단계: 해체 및 요약

통합 후:

1. **에이전트 워크스페이스 아카이브** (선택사항)
2. **임시 파일 정리**
3. **최종 요약 생성**:
   - 에이전트별 달성 사항
   - 발생한 문제
   - 최종 산출물 위치
   - 시간/자원 메트릭

## 파일 기반 통신 프로토콜

**빠른 참조:**
- `inbox/` - 에이전트는 읽기 전용, 오케스트레이터가 기록
- `outbox/` - 에이전트는 쓰기 전용, 오케스트레이터가 읽기
- `status.json` - 에이전트가 상태 업데이트: `pending` -> `running` -> `completed` | `failed`

## 예시: 리서치 보고서 태스크

```
매크로 태스크: "종합 시장 분석 보고서 작성"

분해:
├── 에이전트: data-collector
│   └── 시장 데이터, 경쟁사 정보, 트렌드 수집
├── 에이전트: analyst
│   └── 수집된 데이터 분석, 패턴 식별
├── 에이전트: writer
│   └── 분석에서 보고서 섹션 초안 작성
└── 에이전트: reviewer
    └── 보고서 검토, 편집, 최종화

의존성: data-collector -> analyst -> writer -> reviewer
```

## 서브 에이전트 템플릿

일반적인 에이전트 유형의 미리 구축된 템플릿:

- **리서치 에이전트** - 웹 검색, 데이터 수집
- **코드 에이전트** - 구현, 테스트
- **분석 에이전트** - 데이터 처리, 패턴 발견
- **작성 에이전트** - 콘텐츠 생성, 문서화
- **검토 에이전트** - 품질 보증, 편집
- **통합 에이전트** - 출력 병합, 충돌 해결

## 모범 사례

1. **작게 시작** - 2-3개 에이전트로 시작하고, 패턴이 나타나면 확장합니다
2. **명확한 경계** - 각 에이전트가 특정 산출물을 소유합니다
3. **명시적 인수인계** - 에이전트 통신에 구조화된 파일을 사용합니다
4. **우아한 실패** - 에이전트가 실패를 보고하고 오케스트레이터가 복구를 처리합니다
5. **모든 것을 기록** - 상태 파일이 디버깅을 위한 진행 상황을 추적합니다
