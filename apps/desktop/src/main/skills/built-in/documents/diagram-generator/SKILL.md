---
id: diagram-generator
name: 다이어그램 생성기
description: draw.io, Mermaid, Excalidraw 형식으로 다양한 다이어그램(플로차트, 시퀀스, 클래스, ER, 마인드맵, 아키텍처, 네트워크 토폴로지)을 생성하고 편집하는 도구
version: 1.0.0
triggers:
  - 다이어그램 만들어줘
  - 플로차트 생성
  - 시퀀스 다이어그램
  - 클래스 다이어그램
  - ER 다이어그램
  - 마인드맵 그려줘
  - 아키텍처 다이어그램
  - 네트워크 토폴로지
  - Mermaid 다이어그램
  - create diagram
  - generate flowchart
  - sequence diagram
  - class diagram
  - network topology
  - architecture diagram
  - mermaid diagram
metadata:
  emoji: "📐"
  category: documents
  source: "openclaw"
  license: "Apache-2.0"
---

# 다이어그램 생성기

## 개요

draw.io, Mermaid, Excalidraw 형식으로 다이어그램을 생성하고 편집한다. 구조화된 JSON 설명을 만들어 MCP 서버(mcp-diagram-generator)에 위임하는 방식으로 동작한다.

## 사전 요구사항

이 스킬은 `mcp-diagram-generator` MCP 서버가 설치되어 있어야 한다.

### 확인 방법

다음 도구에 접근 가능한지 확인한다:
- `mcp__mcp-diagram-generator__get_config`
- `mcp__mcp-diagram-generator__generate_diagram`
- `mcp__mcp-diagram-generator__init_config`

### 설치 및 설정

**방법 1: npx 사용 (권장)**

Usan 설정 파일에 다음을 추가한다:

```json
{
  "mcpServers": {
    "mcp-diagram-generator": {
      "command": "npx",
      "args": ["-y", "mcp-diagram-generator"]
    }
  }
}
```

설정 후 Usan을 재시작하면 첫 사용 시 자동 다운로드된다.

**방법 2: 로컬 개발용**

```json
{
  "mcpServers": {
    "mcp-diagram-generator": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-diagram-generator/dist/index.js"]
    }
  }
}
```

## 빠른 시작

첫 사용 시 MCP 서버가 자동으로:
1. 기본 설정 파일(`.diagram-config.json`)을 생성한다.
2. 기본 출력 디렉터리가 없으면 생성한다.
3. 기본 경로 `diagrams/{format}/`을 사용한다.

### 기본 사용법

```
사용자: "로그인 흐름 플로차트 만들어줘"
```

Usan이 수행하는 단계:
1. JSON 스펙 생성
2. `generate_diagram`에 `diagram_spec` 파라미터만 전달
3. 서버가 디렉터리를 자동 생성하고 `diagrams/{format}/{title}-{date}.{ext}`에 저장

## 워크플로

### 1단계: 요구사항 파악

사용자의 자연어에서 추출할 내용:
- **다이어그램 유형**: 플로차트, 시퀀스, 클래스, ER, 마인드맵, 아키텍처, 네트워크 토폴로지
- **콘텐츠**: 노드, 관계, 중첩 구조
- **스타일/테마**: 언급이 있는 경우
- **출력 설정**: 특정 파일명이나 커스텀 경로 여부

### 2단계: 형식 선택

| 형식 | 적합한 용도 |
|------|------------|
| **drawio** | 복잡한 다이어그램, 중첩 컨테이너가 있는 네트워크 토폴로지, 세밀한 스타일링, 수동 편집 |
| **mermaid** | 빠른 생성, 코드 친화적, 버전 관리, 문서화 |
| **excalidraw** | 손그림 스타일, 창의적/비공식 스케치 |

### 3단계: 구조화된 JSON 생성

```json
{
  "format": "drawio",
  "title": "다이어그램 이름",
  "elements": [
    {
      "id": "unique-id",
      "type": "container|node|edge",
      "name": "표시 이름",
      "level": "environment|datacenter|zone|device",
      "style": {},
      "geometry": {},
      "children": []
    }
  ]
}
```

모든 요소에 고유 ID를 사용한다. 중첩 구조에서는 부모-자식 관계를 유지한다.

### 4단계: MCP 서버 호출

**옵션 A: 기본값 사용 (권장)**

```json
{
  "diagram_spec": "<위에서 만든 JSON>"
}
```

MCP 서버가 JSON 스키마 검증, 적절한 XML/JSON/마크다운 생성, 출력 디렉터리 자동 생성, 기본 경로에 저장을 수행한다.

**옵션 B: 커스텀 경로 지정**

```json
{
  "diagram_spec": "<JSON>",
  "output_path": "custom/path/to/diagram.drawio",
  "filename": "my-custom-name"
}
```

**옵션 C: 파일명만 지정, 기본 디렉터리 사용**

```json
{
  "diagram_spec": "<JSON>",
  "filename": "my-diagram.drawio"
}
```

### 5단계: 기존 다이어그램 편집

1. 기존 파일을 읽어 구조를 파악한다.
2. 다이어그램을 파싱한다.
3. 사용자의 변경 요청에 따라 JSON 설명을 수정한다.
4. 새 다이어그램을 생성한다(덮어쓰기 또는 새 파일).

## 지원 다이어그램 유형

### 플로차트
- 단순 프로세스 흐름, 의사결정 트리
- 빠른 출력에는 **mermaid**, 복잡한 레이아웃에는 **drawio**

### 시퀀스 다이어그램
- 컴포넌트 간 시간순 상호작용
- **mermaid** 권장 (네이티브 지원), 커스텀 스타일링이 필요하면 **drawio**

### 클래스 다이어그램
- 클래스, 메서드, 관계 표현
- **mermaid** 권장 (간결, 표준 UML), 많은 클래스가 있으면 **drawio**

### ER 다이어그램
- 데이터베이스 스키마, 엔티티 관계
- **mermaid** 권장, 복잡한 스키마에는 **drawio**

### 마인드맵
- 계층적 아이디어, 브레인스토밍
- **mermaid** 권장 (네이티브 지원), 창의적 스타일에는 **excalidraw**

### 아키텍처 다이어그램
- 시스템 아키텍처, 컴포넌트 관계
- 복잡한 시스템에는 **drawio** 권장, 개요에는 **mermaid**

### 네트워크 토폴로지
- 네트워크 환경, 데이터센터, 존, 장비
- **drawio 필수** (4계층 중첩: environment -> datacenter -> zone -> device)

## 네트워크 토폴로지 참고사항

네트워크 토폴로지 다이어그램은 4계층 계층 구조가 필요하다:

```
Environment (level="environment")
  +-- Datacenter (level="datacenter")
        +-- Zone (level="zone")
              +-- Device (type="node")
```

**스타일 규약:**
- **Environment**: `fillColor: #e1d5e7`, `strokeColor: #9673a6` (보라)
- **Datacenter**: `fillColor: #d5e8d4`, `strokeColor: #82b366` (초록)
- **Zone**: `fillColor: #fff2cc`, `strokeColor: #d6b656` (노랑)
- **Device**: 장비 유형에 따라 다름

**장비 유형별 스타일:**
- 라우터: `strokeColor: #607D8B` (청회색)
- 스위치: `strokeColor: #4CAF50` (초록)
- 방화벽: `strokeColor: #F44336` (빨강)
- PC/서버: `strokeColor: #607D8B` (청회색)

## 설정 관리

### 설정 초기화
```
호출: init_config()
결과: 기본 경로로 .diagram-config.json 생성
```

### 커스텀 경로로 초기화
```
호출: init_config({
  paths: {
    drawio: "output/diagrams/drawio",
    mermaid: "output/diagrams/mermaid",
    excalidraw: "output/diagrams/excalidraw"
  }
})
```

### 현재 설정 확인
```
호출: get_config()
반환: 현재 경로 및 초기화 상태
```

## 예시 패턴

### 패턴 1: 간단한 플로차트 (Mermaid)

사용자: "사용자 로그인 흐름도 그려줘"

```json
{
  "format": "mermaid",
  "title": "사용자 로그인 흐름",
  "elements": [
    {"type": "node", "id": "start", "name": "시작", "geometry": {"x": 0, "y": 0}},
    {"type": "node", "id": "login", "name": "아이디/비밀번호 입력", "geometry": {"x": 0, "y": 100}},
    {"type": "node", "id": "validate", "name": "검증", "geometry": {"x": 0, "y": 200}},
    {"type": "node", "id": "success", "name": "로그인 성공", "geometry": {"x": -100, "y": 300}},
    {"type": "node", "id": "error", "name": "오류 표시", "geometry": {"x": 100, "y": 300}},
    {"type": "edge", "source": "start", "target": "login"},
    {"type": "edge", "source": "login", "target": "validate"},
    {"type": "edge", "source": "validate", "target": "success", "label": "성공"},
    {"type": "edge", "source": "validate", "target": "error", "label": "실패"}
  ]
}
```

### 패턴 2: 네트워크 토폴로지 (Drawio)

사용자: "데이터센터 네트워크 토폴로지 만들어줘"

중첩 컨테이너가 포함된 JSON을 생성하여 MCP 서버에 전달한다.

## 문제 해결

### MCP 서버를 찾을 수 없음
MCP 서버가 설정되지 않은 경우 위의 설치 단계를 따른다. 설정 후 Usan을 재시작한다.

### 잘못된 JSON 스키마
1. 모든 필수 필드가 있는지 확인한다.
2. 모든 ID가 고유한지 확인한다.
3. 부모-자식 관계를 점검한다.

### 디렉터리를 찾을 수 없음
디렉터리는 자동 생성된다. 그래도 오류가 발생하면:
1. 프로젝트 디렉터리의 쓰기 권한을 확인한다.
2. `get_config()`로 설정을 확인한다.
3. `init_config()`로 재초기화한다.

### 파일 확장자
서버가 형식에 따라 올바른 확장자를 자동 사용한다:
- drawio -> `.drawio`
- mermaid -> `.md`
- excalidraw -> `.excalidraw`

filename 파라미터에 확장자를 지정할 필요가 없다.

## 모범 사례

1. **기본 경로 사용**: 일관성을 위해 서버가 출력 경로를 관리하게 한다.
2. **설명적인 제목 제공**: 제목이 자동 생성 파일명에 사용된다.
3. **설정으로 커스텀 경로 관리**: 매번 output_path를 지정하지 말고 한 번 설정한다.
4. **문제 해결 시 설정 확인**: `get_config()`로 모든 경로와 상태를 확인한다.
