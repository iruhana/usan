---
id: causal-inference
name: "인과 추론"
description: "행동 로깅, 인과 그래프, 결과 예측을 통해 에이전트에 인과적 추론 능력을 추가합니다. 상관관계가 아닌 개입과 반사실을 모델링합니다."
version: 1.0.0
triggers:
  - "인과 추론"
  - "인과 분석"
  - "원인 분석"
  - "결과 예측"
  - "행동 로깅"
  - "인과 그래프"
  - "반사실 분석"
  - "왜 실패했지"
  - "이걸 하면 어떻게 될까"
  - "causal inference"
  - "causal analysis"
  - "outcome prediction"
  - "action logging"
  - "causal graph"
  - "counterfactual"
  - "what happens if"
  - "why did this fail"
metadata:
  emoji: "🔬"
  category: "agent-intelligence"
  source: "openclaw"
  license: "Apache-2.0"
---

# 인과 추론

행동 결과를 예측하기 위한 경량 인과 계층입니다. 상관관계 패턴 매칭이 아닌, 개입(intervention)과 반사실(counterfactual)을 모델링합니다.

## 핵심 불변량

**모든 행동은 인과 모델에 대한 명시적 개입으로 표현 가능해야 하며, 예측 효과 + 불확실성 + 반증 가능한 감사 추적을 포함해야 합니다.**

계획은 단순히 그럴듯한 것이 아니라 *인과적으로 유효*해야 합니다.

## 트리거 조건

**모든 고수준 행동에서 이 스킬을 트리거합니다:**

| 도메인 | 로깅 대상 행동 |
|--------|---------------|
| **커뮤니케이션** | 이메일 전송, 메시지 전송, 답장, 후속 조치, 알림, 멘션 |
| **캘린더** | 회의 생성/이동/취소, 리마인더 설정, RSVP |
| **태스크** | 태스크 생성/완료/연기, 우선순위 설정, 할당 |
| **파일** | 문서 생성/편집/공유, 코드 커밋, 배포 |
| **소셜** | 게시, 반응, 댓글, 공유, DM |
| **구매** | 주문, 구독, 취소, 환불 |
| **시스템** | 설정 변경, 권한 부여, 통합 설정 |

또한 다음 상황에서 트리거:
- **결과 검토** -- "그 이메일에 답장이 왔나?" -> 결과 기록, 추정치 업데이트
- **실패 디버깅** -- "왜 이게 안 됐지?" -> 인과 그래프 추적
- **히스토리 백필** -- "과거 이메일/캘린더 분석" -> 로그 파싱, 행동 재구성
- **계획 수립** -- "지금 보낼까 나중에 보낼까?" -> 인과 모델 쿼리

## 백필: 과거 데이터에서 부트스트랩

제로에서 시작하지 마세요. 기존 로그를 파싱하여 과거 행동 + 결과를 재구성합니다.

### 이메일 백필

```bash
# 답장 상태와 함께 보낸 이메일 추출
gog gmail list --sent --after 2024-01-01 --format json > /tmp/sent_emails.json

# 각 보낸 이메일에 대해 답장 존재 여부 확인
python3 scripts/backfill_email.py /tmp/sent_emails.json
```

### 캘린더 백필

```bash
# 참석 정보와 함께 과거 이벤트 추출
gog calendar list --after 2024-01-01 --format json > /tmp/events.json

# 재구성: 회의가 진행되었나? 이동되었나? 참석자 수?
python3 scripts/backfill_calendar.py /tmp/events.json
```

### 메시지 백필 (WhatsApp/Discord/Slack)

```bash
# 전송/답장 패턴에 대한 메시지 히스토리 파싱
wacli search --after 2024-01-01 --from me --format json > /tmp/wa_sent.json
python3 scripts/backfill_messages.py /tmp/wa_sent.json
```

### 범용 백필 패턴

```python
# 모든 과거 데이터 소스에 대해:
for record in historical_data:
    action_event = {
        "action": infer_action_type(record),
        "context": extract_context(record),
        "time": record["timestamp"],
        "pre_state": reconstruct_pre_state(record),
        "post_state": extract_post_state(record),
        "outcome": determine_outcome(record),
        "backfilled": True  # 재구성된 것으로 표시
    }
    append_to_log(action_event)
```

## 아키텍처

### A. 행동 로그 (필수)

실행된 모든 행동은 구조화된 이벤트를 생성합니다:

```json
{
  "action": "send_followup",
  "domain": "email",
  "context": {"recipient_type": "warm_lead", "prior_touches": 2},
  "time": "2025-01-26T10:00:00Z",
  "pre_state": {"days_since_last_contact": 7},
  "post_state": {"reply_received": true, "reply_delay_hours": 4},
  "outcome": "positive_reply",
  "outcome_observed_at": "2025-01-26T14:00:00Z",
  "backfilled": false
}
```

`memory/causal/action_log.jsonl`에 저장합니다.

### B. 인과 그래프 (도메인별)

도메인당 10-30개의 관찰 가능한 변수로 시작합니다.

**이메일 도메인:**
```
send_time -> reply_prob
subject_style -> open_rate
recipient_type -> reply_prob
followup_count -> reply_prob (감소)
time_since_last -> reply_prob
```

**캘린더 도메인:**
```
meeting_time -> attendance_rate
attendee_count -> slip_risk
conflict_degree -> reschedule_prob
buffer_time -> focus_quality
```

**메시징 도메인:**
```
response_delay -> conversation_continuation
message_length -> response_length
time_of_day -> response_prob
platform -> response_delay
```

**태스크 도메인:**
```
due_date_proximity -> completion_prob
priority_level -> completion_speed
task_size -> deferral_risk
context_switches -> error_rate
```

그래프 정의를 `memory/causal/graphs/`에 저장합니다.

### C. 추정

각 "조절 변수"(개입 변수)에 대해 처리 효과를 추정합니다:

```python
# 의사 코드: 아침 vs 저녁 전송의 효과
effect = mean(reply_prob | send_time=morning) - mean(reply_prob | send_time=evening)
uncertainty = std_error(effect)
```

먼저 단순 회귀 또는 경향 점수 매칭을 사용합니다. 그래프가 명시적이고 식별이 필요할 때 do-calculus로 발전합니다.

### D. 결정 정책

행동 실행 전:

1. 개입 변수를 식별합니다
2. 인과 모델에 예상 결과 분포를 쿼리합니다
3. 기대 효용 + 불확실성 범위를 계산합니다
4. 불확실성 > 임계값 또는 예상 피해 > 임계값이면 -> 거부 또는 사용자에게 에스컬레이션
5. 나중 검증을 위해 예측을 기록합니다

## 워크플로우

### 모든 행동에서

```
실행 전:
1. pre_state 기록
2. 충분한 과거 데이터가 있으면: 예상 결과를 모델에 쿼리
3. 높은 불확실성이나 위험이면: 사용자에게 확인

실행 후:
1. action + context + time 기록
2. 결과가 즉각적이지 않으면 확인 리마인더 설정

결과 관찰 시:
1. post_state + outcome으로 행동 로그 업데이트
2. 충분한 새 데이터가 있으면 처리 효과 재추정
```

### 행동 계획

```
1. 사용자 요청 -> 후보 행동 식별
2. 각 행동에 대해:
   a. 인과 그래프의 개입에 매핑
   b. P(outcome | do(action)) 예측
   c. 불확실성 추정
   d. 기대 효용 계산
3. 기대 효용으로 순위화, 안전성으로 필터링
4. 최선의 행동 실행, 예측 기록
5. 결과 관찰, 모델 업데이트
```

### 실패 디버깅

```
1. 실패한 결과 식별
2. 인과 그래프를 역추적
3. 각 상류 노드에 대해:
   a. 값이 예상대로였는가?
   b. 인과 링크가 유지되었는가?
4. 끊어진 링크 식별
5. 실패를 방지했을 최소 개입 집합 계산
6. 학습을 위한 반사실 기록
```

## 빠른 시작: 오늘 부트스트랩

```bash
# 1. 인프라 생성
mkdir -p memory/causal/graphs memory/causal/estimates

# 2. 설정 초기화
cat > memory/causal/config.yaml << 'EOF'
domains:
  - email
  - calendar
  - messaging
  - tasks

thresholds:
  max_uncertainty: 0.3
  min_expected_utility: 0.1

protected_actions:
  - delete_email
  - cancel_meeting
  - send_to_new_contact
  - financial_transaction
EOF

# 3. 하나의 도메인 백필 (이메일부터 시작)
python3 scripts/backfill_email.py

# 4. 초기 효과 추정
python3 scripts/estimate_effect.py --treatment send_time --outcome reply_received --values morning,evening
```

## 안전 제약

사용자의 명시적 승인이 필요한 "보호 변수"를 정의합니다:

```yaml
protected:
  - delete_email
  - cancel_meeting
  - send_to_new_contact
  - financial_transaction

thresholds:
  max_uncertainty: 0.3  # P(outcome) 불확실성 > 30%이면 행동하지 않음
  min_expected_utility: 0.1  # 기대 이득 < 10%이면 행동하지 않음
```

## 파일 구조

- `memory/causal/action_log.jsonl` -- 결과가 포함된 모든 기록된 행동
- `memory/causal/graphs/` -- 도메인별 인과 그래프 정의
- `memory/causal/estimates/` -- 학습된 처리 효과
- `memory/causal/config.yaml` -- 안전 임계값 및 보호 변수
