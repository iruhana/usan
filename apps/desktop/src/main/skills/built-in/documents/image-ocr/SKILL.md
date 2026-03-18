---
id: image-ocr
name: 이미지 OCR
description: Tesseract OCR을 사용하여 이미지에서 텍스트를 추출한다. PNG, JPEG, TIFF, BMP 형식을 지원하며 다국어 인식이 가능하다.
version: 1.0.0
triggers:
  - 이미지에서 텍스트 추출
  - OCR 해줘
  - 사진 텍스트 인식
  - 스크린샷 텍스트 읽기
  - 이미지 문자 인식
  - extract text from image
  - ocr image
  - read text from screenshot
  - image text recognition
metadata:
  emoji: "👁️"
  category: documents
  source: "openclaw"
  license: "Apache-2.0"
---

# 이미지 OCR

Tesseract OCR을 사용하여 이미지에서 텍스트를 추출한다. PNG, JPEG, TIFF, BMP를 포함한 다양한 이미지 형식을 지원하며 다국어 인식이 가능하다.

## 사전 요구사항

Tesseract OCR이 설치되어 있어야 한다.

### 설치

**Windows:**
```bash
# Chocolatey 사용
choco install tesseract

# 또는 공식 설치 프로그램 다운로드
# https://github.com/UB-Mannheim/tesseract/wiki
```

**macOS:**
```bash
brew install tesseract
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt install tesseract-ocr
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install tesseract
```

### 추가 언어 팩

```bash
# 한국어
sudo apt install tesseract-ocr-kor   # Debian/Ubuntu
brew install tesseract-lang           # macOS (모든 언어)

# 일본어
sudo apt install tesseract-ocr-jpn

# 중국어 (간체)
sudo apt install tesseract-ocr-chi-sim
```

## 사용법

### CLI 직접 사용

```bash
# 기본 텍스트 추출 (영어)
tesseract screenshot.png output

# 특정 언어로 추출
tesseract document.jpg output --lang kor

# 여러 언어 동시 사용
tesseract mixed.png output --lang kor+eng

# 표준 출력으로 결과 보기
tesseract image.png stdout
```

### Python에서 사용

```python
import pytesseract
from PIL import Image

# 기본 텍스트 추출
image = Image.open("screenshot.png")
text = pytesseract.image_to_string(image)
print(text)

# 한국어 텍스트 추출
text_kor = pytesseract.image_to_string(image, lang='kor')

# 여러 언어 동시 사용
text_multi = pytesseract.image_to_string(image, lang='kor+eng')
```

### 이미지 전처리로 정확도 향상

```python
from PIL import Image, ImageFilter, ImageEnhance
import pytesseract

image = Image.open("noisy_image.png")

# 그레이스케일 변환
image = image.convert('L')

# 대비 향상
enhancer = ImageEnhance.Contrast(image)
image = enhancer.enhance(2.0)

# 이진화 (임계값 처리)
image = image.point(lambda x: 0 if x < 128 else 255)

# OCR 실행
text = pytesseract.image_to_string(image, lang='kor')
```

## 지원 언어 (주요)

| 코드 | 언어 |
|------|------|
| `eng` | 영어 |
| `kor` | 한국어 |
| `jpn` | 일본어 |
| `chi_sim` | 중국어 (간체) |
| `chi_tra` | 중국어 (번체) |
| `deu` | 독일어 |
| `fra` | 프랑스어 |
| `spa` | 스페인어 |

설치된 언어 목록 확인:
```bash
tesseract --list-langs
```

## 팁

- **정확도 향상**: 입력 이미지의 해상도가 높을수록 결과가 좋다. 최소 300 DPI를 권장한다.
- **전처리**: 노이즈 제거, 대비 향상, 이진화를 적용하면 인식률이 크게 개선된다.
- **영역 지정**: 이미지의 특정 영역만 OCR 처리하면 속도와 정확도가 모두 향상된다.
- **PDF 스캔**: 스캔된 PDF의 경우 먼저 이미지로 변환한 후 OCR을 적용한다 (pdf 스킬의 OCR 섹션 참조).
