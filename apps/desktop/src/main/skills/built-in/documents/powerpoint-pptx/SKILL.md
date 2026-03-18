---
id: powerpoint-pptx
name: PowerPoint 프레젠테이션 (PPTX)
description: python-pptx를 활용하여 PowerPoint 프레젠테이션을 생성, 편집, 자동화하는 가이드. 슬라이드, 레이아웃, 차트, 일괄 처리를 지원한다.
version: 1.0.0
triggers:
  - PPT 만들어줘
  - 프레젠테이션 생성
  - 파워포인트 편집
  - 슬라이드 추가
  - PPT 차트 생성
  - 발표자료 만들기
  - create powerpoint
  - generate pptx
  - edit presentation
  - add slides
  - pptx chart
metadata:
  emoji: "📊"
  category: documents
  source: "openclaw"
  license: "Apache-2.0"
---

# PowerPoint 프레젠테이션 (PPTX) 가이드

## 활용 시점

사용자가 PowerPoint(.pptx) 파일을 프로그래밍 방식으로 생성하거나 수정해야 할 때 사용한다. 슬라이드 생성, 콘텐츠 채우기, 차트 생성, 템플릿 자동화를 처리한다.

## 핵심 규칙

### 1. python-pptx 라이브러리 사용
```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RgbColor
```

설치: `pip install python-pptx`

### 2. 프레젠테이션 구조
```python
# 새 프레젠테이션 생성
prs = Presentation()

# 기존 템플릿 로드
prs = Presentation('template.pptx')

# 레이아웃으로 슬라이드 추가
slide_layout = prs.slide_layouts[1]  # 제목 및 내용
slide = prs.slides.add_slide(slide_layout)

# 저장
prs.save('output.pptx')
```

### 3. 슬라이드 레이아웃 (기본 내장)
| 인덱스 | 레이아웃 이름 | 용도 |
|--------|-------------|------|
| 0 | 제목 슬라이드 | 시작 슬라이드 |
| 1 | 제목 및 내용 | 표준 콘텐츠 |
| 2 | 구역 머리글 | 챕터 구분 |
| 3 | 두 개의 내용 | 좌우 배치 |
| 4 | 비교 | 전후 비교 |
| 5 | 제목만 | 커스텀 콘텐츠 |
| 6 | 빈 화면 | 완전 자유 배치 |

### 4. 텍스트 처리
```python
# 제목 접근
title = slide.shapes.title
title.text = "슬라이드 제목"

# 본문 자리표시자 접근
body = slide.placeholders[1]
tf = body.text_frame
tf.text = "첫 번째 단락"

# 단락 추가
p = tf.add_paragraph()
p.text = "두 번째 단락"
p.level = 1  # 들여쓰기 수준
```

### 5. 출력 확인 필수
프레젠테이션 생성 후:
1. 슬라이드 수가 예상과 일치하는지 확인
2. 텍스트가 올바르게 채워졌는지 확인
3. 차트가 정상 렌더링되는지 확인
4. 사용자가 지정한 경로에 저장

## 슬라이드 패턴

### 제목 슬라이드
```python
slide_layout = prs.slide_layouts[0]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "프레젠테이션 제목"
subtitle = slide.placeholders[1]
subtitle.text = "부제 또는 저자"
```

### 글머리 기호 콘텐츠 슬라이드
```python
slide_layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "핵심 포인트"
body = slide.placeholders[1]
tf = body.text_frame
tf.text = "첫 번째 항목"

for point in ["두 번째 항목", "세 번째 항목"]:
    p = tf.add_paragraph()
    p.text = point
    p.level = 0
```

### 이미지가 포함된 슬라이드
```python
from pptx.util import Inches

slide_layout = prs.slide_layouts[5]  # 제목만
slide = prs.slides.add_slide(slide_layout)
left = Inches(1)
top = Inches(2)
width = Inches(4)
slide.shapes.add_picture('image.png', left, top, width=width)
```

### 2단 레이아웃
```python
slide_layout = prs.slide_layouts[3]  # 두 개의 내용
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "비교"
left_content = slide.placeholders[1]
left_content.text_frame.text = "왼쪽 열 내용"
right_content = slide.placeholders[2]
right_content.text_frame.text = "오른쪽 열 내용"
```

### 일괄 슬라이드 생성
```python
data = [
    {"title": "슬라이드 1", "content": ["항목 A", "항목 B"]},
    {"title": "슬라이드 2", "content": ["항목 C", "항목 D"]},
]

for item in data:
    slide = prs.slides.add_slide(prs.slide_layouts[1])
    slide.shapes.title.text = item["title"]
    body = slide.placeholders[1].text_frame
    body.text = item["content"][0]
    for point in item["content"][1:]:
        p = body.add_paragraph()
        p.text = point
```

## 차트와 표

### 막대 차트
```python
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE
from pptx.util import Inches

chart_data = CategoryChartData()
chart_data.categories = ['1분기', '2분기', '3분기', '4분기']
chart_data.add_series('매출', (19.2, 21.4, 16.7, 28.0))
chart_data.add_series('비용', (12.1, 14.3, 11.2, 18.5))

x, y, cx, cy = Inches(1), Inches(2), Inches(8), Inches(4.5)
chart = slide.shapes.add_chart(
    XL_CHART_TYPE.COLUMN_CLUSTERED, x, y, cx, cy, chart_data
).chart

chart.has_title = True
chart.chart_title.text_frame.text = "분기별 실적"
```

### 원형 차트
```python
chart_data = CategoryChartData()
chart_data.categories = ['제품 A', '제품 B', '제품 C']
chart_data.add_series('시장 점유율', (35, 45, 20))

chart = slide.shapes.add_chart(
    XL_CHART_TYPE.PIE, Inches(2), Inches(2), Inches(6), Inches(4), chart_data
).chart

plot = chart.plots[0]
plot.has_data_labels = True
data_labels = plot.data_labels
data_labels.show_percentage = True
data_labels.show_value = False
```

### 표 생성
```python
from pptx.util import Inches, Pt

rows, cols = 4, 3
left, top = Inches(1), Inches(2)
width, height = Inches(8), Inches(2)
table = slide.shapes.add_table(rows, cols, left, top, width, height).table

table.columns[0].width = Inches(2)
table.columns[1].width = Inches(3)
table.columns[2].width = Inches(3)

headers = ['이름', '부서', '매출']
for i, header in enumerate(headers):
    cell = table.cell(0, i)
    cell.text = header
    cell.text_frame.paragraphs[0].font.bold = True

data = [
    ['김철수', '영업', '125000'],
    ['이영희', '마케팅', '98000'],
    ['박민수', '개발', '156000'],
]

for row_idx, row_data in enumerate(data, start=1):
    for col_idx, value in enumerate(row_data):
        table.cell(row_idx, col_idx).text = value
```

### 차트 유형 참조
| 유형 | 상수 | 용도 |
|------|------|------|
| 세로 막대 | `XL_CHART_TYPE.COLUMN_CLUSTERED` | 범주 비교 |
| 가로 막대 | `XL_CHART_TYPE.BAR_CLUSTERED` | 수평 비교 |
| 꺾은선 | `XL_CHART_TYPE.LINE` | 시간별 추세 |
| 원형 | `XL_CHART_TYPE.PIE` | 전체 대비 비율 |
| 영역 | `XL_CHART_TYPE.AREA` | 시간별 볼륨 |
| 분산 | `XL_CHART_TYPE.XY_SCATTER` | 상관관계 |
| 도넛 | `XL_CHART_TYPE.DOUGHNUT` | 중심이 빈 원형 |

## 디자인 가이드라인

### 슬라이드 크기
```python
from pptx.util import Inches

# 표준 16:9 (기본값)
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

# 표준 4:3
prs.slide_width = Inches(10)
prs.slide_height = Inches(7.5)
```

### 글꼴 크기 가이드
| 요소 | 크기 범위 | 권장 |
|------|----------|------|
| 제목 | 36-44 pt | 40 pt |
| 부제 | 24-32 pt | 28 pt |
| 본문 | 18-24 pt | 20 pt |
| 글머리 기호 | 16-20 pt | 18 pt |
| 캡션 | 12-14 pt | 12 pt |

### 색상 팔레트 (프로페셔널 블루)
```python
primary = RgbColor(0x1F, 0x77, 0xB4)    # 메인 블루
secondary = RgbColor(0xAE, 0xC7, 0xE8)  # 라이트 블루
accent = RgbColor(0xFF, 0x7F, 0x0E)     # 오렌지 액센트
text = RgbColor(0x33, 0x33, 0x33)       # 다크 그레이
```

### 일반적인 프레젠테이션 구조

**비즈니스 프레젠테이션:**
1. 제목 슬라이드
2. 목차/개요
3. 문제 정의
4. 솔루션
5. 이점/기능 (2-3장)
6. 구현/타임라인
7. CTA (행동 촉구)
8. Q&A/연락처

**기술 프레젠테이션:**
1. 제목 슬라이드
2. 배경/맥락
3. 아키텍처 개요
4. 상세 섹션
5. 데모/예시
6. 요약
7. 질문

## 흔한 함정

- **레이아웃 인덱스 가정**: 레이아웃 인덱스는 템플릿마다 다르다. 항상 `prs.slide_layouts`를 먼저 확인하라.
- **자리표시자 누락**: 모든 레이아웃에 본문 자리표시자가 있는 것은 아니다. `slide.shapes`를 순회하여 셰이프를 찾아라.
- **폰트 미임베디드**: python-pptx는 시스템 폰트를 사용한다. 이식성을 위해 일반 폰트(Arial, Calibri, 맑은 고딕)를 사용하라.
- **이미지 크기 지정**: 항상 `Inches()` 또는 `Pt()`로 크기를 지정하라. 기본 크기 조정은 예측 불가능하다.
- **차트 데이터 불일치**: 범주 수와 데이터 시리즈 길이가 정확히 일치해야 한다.

## 범위

이 스킬은 로컬 .pptx 파일만 생성하고 수정한다. python-pptx 라이브러리를 사용하며, 로컬 파일시스템의 템플릿을 읽는다. 클라우드 서비스에 업로드하거나 네트워크 요청을 하지 않는다.
