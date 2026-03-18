---
id: table-image-generator
name: 표 이미지 생성기
description: JSON 데이터로 깔끔한 표 이미지(PNG)를 생성한다. Discord/Telegram 등에서 ASCII 표가 깨지는 문제를 해결하며, 다크/라이트 모드, 커스텀 스타일링, 자동 크기 조정을 지원한다.
version: 1.0.0
triggers:
  - 표 이미지 만들어줘
  - 테이블 이미지 생성
  - 표를 PNG로
  - 데이터 표 렌더링
  - 표 시각화
  - generate table image
  - table to png
  - render data table
  - table image dark mode
metadata:
  emoji: "📊"
  category: documents
  source: "openclaw"
  license: "Apache-2.0"
---

# 표 이미지 생성기

**ASCII 표 대신 항상 이미지를 사용하라.**

JSON 데이터에서 PNG 표 이미지를 생성한다. ASCII 표는 Discord, Telegram, WhatsApp 등 대부분의 메시징 플랫폼에서 깨진다. 이 스킬은 어디서나 깔끔하게 렌더링되는 이미지를 만든다.

## 장점

- ASCII 표(`| col | col |`)를 메시징 플랫폼에서 사용하지 않아도 된다
- Puppeteer 불필요 -- 순수 Node.js + Sharp, 경량
- 다크 모드 -- Discord 다크 테마에 맞춤
- 자동 크기 조정 -- 열이 콘텐츠에 맞게 조절
- 빠름 -- 100ms 미만으로 생성

## 설정 (최초 1회)

```bash
cd ~/usan-skills/table-image/scripts && npm install
```

## 사용법

**모범 사례: heredoc 또는 --data-file을 사용하여 셸 인용 오류를 방지한다.**

```bash
# 권장: JSON을 임시 파일에 먼저 저장 (셸 인용 문제 방지)
cat > /tmp/data.json << 'JSONEOF'
[{"이름":"김철수","점수":95},{"이름":"이영희","점수":87}]
JSONEOF
node ~/usan-skills/table-image/scripts/table.mjs \
  --data-file /tmp/data.json --dark --output table.png

# stdin 파이프도 가능
echo '[{"이름":"김철수","점수":95}]' | node ~/usan-skills/table-image/scripts/table.mjs \
  --dark --output table.png

# 간단한 경우 (데이터에 따옴표/특수문자가 있으면 깨질 수 있음):
node ~/usan-skills/table-image/scripts/table.mjs \
  --data '[{"이름":"김철수","점수":95}]' --output table.png
```

## 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--data` | 행 객체의 JSON 배열 | 필수 |
| `--output` | 출력 파일 경로 | table.png |
| `--title` | 표 제목 | 없음 |
| `--dark` | 다크 모드 (Discord 친화적) | false |
| `--columns` | 열 순서/부분집합 (쉼표 구분) | 모든 키 |
| `--headers` | 커스텀 헤더 이름 (쉼표 구분) | 필드 이름 |
| `--max-width` | 최대 표 너비 | 800 |
| `--font-size` | 글꼴 크기 (px) | 14 |
| `--header-color` | 헤더 배경색 | #e63946 |
| `--stripe` | 행 번갈아 색상 | true |
| `--align` | 열 정렬 (l,r,c 쉼표 구분) | 자동 |
| `--compact` | 패딩 줄이기 | false |

## 예시

### 기본 표
```bash
node table.mjs \
  --data '[{"이름":"김철수","나이":30,"도시":"서울"},{"이름":"이영희","나이":25,"도시":"부산"}]' \
  --output people.png
```

### 커스텀 열과 헤더
```bash
node table.mjs \
  --data '[{"first_name":"김철수","score":95,"date":"2024-01"}]' \
  --columns "first_name,score" \
  --headers "이름,점수" \
  --output scores.png
```

### 숫자 우측 정렬
```bash
node table.mjs \
  --data '[{"품목":"커피","가격":4500},{"품목":"차","가격":3000}]' \
  --align "l,r" \
  --output prices.png
```

### Discord용 다크 모드
```bash
node table.mjs \
  --data '[{"종목":"삼성전자","변동":"+2.5%"},{"종목":"카카오","변동":"-1.2%"}]' \
  --title "시장 동향" \
  --dark \
  --output stocks.png
```

### 컴팩트 모드
```bash
node table.mjs \
  --data '[...]' \
  --compact \
  --font-size 12 \
  --output small-table.png
```

## 입력 형식

### JSON 배열 (기본)
```bash
--data '[{"col1":"a","col2":"b"},{"col1":"c","col2":"d"}]'
```

### stdin 파이프
```bash
echo '[{"이름":"테스트"}]' | node table.mjs --output out.png
```

### 파일에서 읽기
```bash
cat data.json | node table.mjs --output out.png
```

## 팁

1. **Discord에는 `--dark` 사용** -- 다크 테마와 어울리며 자연스럽다.
2. **자동 정렬** -- 숫자는 기본적으로 우측 정렬된다.
3. **열 순서** -- `--columns`로 순서를 재배열하거나 부분집합을 선택한다.
4. **긴 텍스트** -- `--max-width`에 맞게 말줄임표로 잘린다.

## 기술 사항

- Sharp를 사용하여 PNG 생성 (chart-image와 동일)
- 내부적으로 SVG를 생성한 후 PNG로 변환
- 브라우저, Puppeteer, Canvas 네이티브 의존성 없음
- Fly.io, Docker, 모든 Node.js 환경에서 동작
