---
id: weather
name: 날씨 확인
description: 현재 날씨와 예보를 확인합니다. API 키 불필요.
triggers: [날씨, 오늘 날씨, 비 오나, 우산 필요해, 기온, 날씨 어때, 일기예보]
tools: [run_command]
category: information
metadata: {"emoji":"🌤️","requires":{"bins":["curl"]},"examples":["오늘 서울 날씨 어때?","내일 비 오나요?","우산 가져가야 해?"]}
---

## 절차

1. 사용자에게 도시를 물어봅니다 (기본: 서울)
2. `run_command`로 날씨를 확인합니다:
   - 간단 요약: `curl -s "wttr.in/서울?format=3&lang=ko"`
   - 현재 상세: `curl -s "wttr.in/서울?lang=ko&0"`
   - 3일 예보: `curl -s "wttr.in/서울?lang=ko"`
3. 결과를 쉬운 말로 설명합니다:
   - "오늘은 따뜻하니 가벼운 옷을 입으세요"
   - "비가 올 수 있으니 우산을 챙기세요"
   - 기온, 강수 확률, 체감 온도를 알려줍니다
4. wttr.in 실패 시 Open-Meteo API 사용:
   - 서울: `curl -s "https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current_weather=true"`

## 주요 도시 좌표 (Open-Meteo 폴백용)
- 서울: 37.5665, 126.9780
- 부산: 35.1796, 129.0756
- 대구: 35.8714, 128.6014
- 인천: 37.4563, 126.7052
- 제주: 33.4996, 126.5312
