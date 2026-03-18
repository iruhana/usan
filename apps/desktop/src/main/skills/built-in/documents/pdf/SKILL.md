---
id: pdf
name: PDF 처리
description: PDF 문서의 텍스트/표 추출, 생성, 병합/분할, 양식 처리 등 종합 PDF 조작 도구
version: 1.0.0
triggers:
  - PDF 만들어줘
  - PDF 합치기
  - PDF 분할
  - PDF 텍스트 추출
  - PDF 표 추출
  - PDF 양식 작성
  - PDF 워터마크
  - PDF 비밀번호
  - create pdf
  - merge pdf
  - split pdf
  - extract text from pdf
  - extract tables from pdf
  - fill pdf form
metadata:
  emoji: "📄"
  category: documents
  source: "openclaw"
  license: "Apache-2.0"
---

# PDF 처리 가이드

## 개요

Python 라이브러리와 CLI 도구를 활용한 PDF 처리 작업 가이드. Usan이 PDF 양식 작성, 프로그래밍 방식 처리, 생성, 분석을 수행할 때 참고한다.

## 빠른 시작

```python
from pypdf import PdfReader, PdfWriter

# PDF 읽기
reader = PdfReader("document.pdf")
print(f"페이지 수: {len(reader.pages)}")

# 텍스트 추출
text = ""
for page in reader.pages:
    text += page.extract_text()
```

## Python 라이브러리

### pypdf - 기본 조작

#### PDF 병합
```python
from pypdf import PdfWriter, PdfReader

writer = PdfWriter()
for pdf_file in ["doc1.pdf", "doc2.pdf", "doc3.pdf"]:
    reader = PdfReader(pdf_file)
    for page in reader.pages:
        writer.add_page(page)

with open("merged.pdf", "wb") as output:
    writer.write(output)
```

#### PDF 분할
```python
reader = PdfReader("input.pdf")
for i, page in enumerate(reader.pages):
    writer = PdfWriter()
    writer.add_page(page)
    with open(f"page_{i+1}.pdf", "wb") as output:
        writer.write(output)
```

#### 메타데이터 추출
```python
reader = PdfReader("document.pdf")
meta = reader.metadata
print(f"제목: {meta.title}")
print(f"저자: {meta.author}")
print(f"주제: {meta.subject}")
print(f"작성 도구: {meta.creator}")
```

#### 페이지 회전
```python
reader = PdfReader("input.pdf")
writer = PdfWriter()

page = reader.pages[0]
page.rotate(90)  # 시계방향 90도 회전
writer.add_page(page)

with open("rotated.pdf", "wb") as output:
    writer.write(output)
```

### pdfplumber - 텍스트/표 추출

#### 레이아웃 보존 텍스트 추출
```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        print(text)
```

#### 표 추출
```python
with pdfplumber.open("document.pdf") as pdf:
    for i, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        for j, table in enumerate(tables):
            print(f"페이지 {i+1}의 표 {j+1}:")
            for row in table:
                print(row)
```

#### 고급 표 추출 (pandas 연동)
```python
import pandas as pd

with pdfplumber.open("document.pdf") as pdf:
    all_tables = []
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            if table:
                df = pd.DataFrame(table[1:], columns=table[0])
                all_tables.append(df)

if all_tables:
    combined_df = pd.concat(all_tables, ignore_index=True)
    combined_df.to_excel("extracted_tables.xlsx", index=False)
```

### reportlab - PDF 생성

#### 기본 PDF 생성
```python
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

c = canvas.Canvas("hello.pdf", pagesize=letter)
width, height = letter

c.drawString(100, height - 100, "Hello World!")
c.drawString(100, height - 120, "reportlab으로 생성한 PDF입니다")
c.line(100, height - 140, 400, height - 140)
c.save()
```

#### 다중 페이지 PDF 생성
```python
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet

doc = SimpleDocTemplate("report.pdf", pagesize=letter)
styles = getSampleStyleSheet()
story = []

title = Paragraph("보고서 제목", styles['Title'])
story.append(title)
story.append(Spacer(1, 12))

body = Paragraph("보고서 본문 내용입니다. " * 20, styles['Normal'])
story.append(body)
story.append(PageBreak())

story.append(Paragraph("2페이지", styles['Heading1']))
story.append(Paragraph("2페이지 내용", styles['Normal']))

doc.build(story)
```

## CLI 도구

### pdftotext (poppler-utils)
```bash
# 텍스트 추출
pdftotext input.pdf output.txt

# 레이아웃 보존 추출
pdftotext -layout input.pdf output.txt

# 특정 페이지 추출
pdftotext -f 1 -l 5 input.pdf output.txt  # 1~5페이지
```

### qpdf
```bash
# PDF 병합
qpdf --empty --pages file1.pdf file2.pdf -- merged.pdf

# 페이지 분할
qpdf input.pdf --pages . 1-5 -- pages1-5.pdf
qpdf input.pdf --pages . 6-10 -- pages6-10.pdf

# 페이지 회전
qpdf input.pdf output.pdf --rotate=+90:1  # 1페이지 90도 회전

# 암호 해제
qpdf --password=mypassword --decrypt encrypted.pdf decrypted.pdf
```

### pdftk
```bash
# 병합
pdftk file1.pdf file2.pdf cat output merged.pdf

# 분할
pdftk input.pdf burst

# 회전
pdftk input.pdf rotate 1east output rotated.pdf
```

## 주요 작업

### 스캔 PDF에서 텍스트 추출 (OCR)
```python
# 필요: pip install pytesseract pdf2image
import pytesseract
from pdf2image import convert_from_path

images = convert_from_path('scanned.pdf')

text = ""
for i, image in enumerate(images):
    text += f"페이지 {i+1}:\n"
    text += pytesseract.image_to_string(image)
    text += "\n\n"

print(text)
```

### 워터마크 추가
```python
from pypdf import PdfReader, PdfWriter

watermark = PdfReader("watermark.pdf").pages[0]
reader = PdfReader("document.pdf")
writer = PdfWriter()

for page in reader.pages:
    page.merge_page(watermark)
    writer.add_page(page)

with open("watermarked.pdf", "wb") as output:
    writer.write(output)
```

### 이미지 추출
```bash
# pdfimages 사용 (poppler-utils)
pdfimages -j input.pdf output_prefix
# output_prefix-000.jpg, output_prefix-001.jpg 등으로 추출
```

### 비밀번호 보호
```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("input.pdf")
writer = PdfWriter()

for page in reader.pages:
    writer.add_page(page)

writer.encrypt("userpassword", "ownerpassword")

with open("encrypted.pdf", "wb") as output:
    writer.write(output)
```

## 빠른 참조표

| 작업 | 추천 도구 | 비고 |
|------|-----------|------|
| PDF 병합 | pypdf | `writer.add_page(page)` |
| PDF 분할 | pypdf | 페이지별 파일 생성 |
| 텍스트 추출 | pdfplumber | `page.extract_text()` |
| 표 추출 | pdfplumber | `page.extract_tables()` |
| PDF 생성 | reportlab | Canvas 또는 Platypus |
| CLI 병합 | qpdf | `qpdf --empty --pages ...` |
| 스캔 OCR | pytesseract | 이미지 변환 후 처리 |
| 양식 작성 | pdf-lib 또는 pypdf | 양식 유형에 따라 선택 |
