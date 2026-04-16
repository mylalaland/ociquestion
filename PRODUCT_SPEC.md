# OCI-Style Document Analysis & Quiz Generator (Multi-LLM)

## 1. 개요 (Overview)
다양한 문서(PDF, 이미지, OCI 추출 텍스트)를 분석하여 수능형, 객관식, 단답형 등 맞춤형 문제를 생성하는 학생용 학습 지원 앱입니다. 비용 효율적인 무료 티어 기반의 서비스와 유료 API 사용자를 모두 포괄하는 유연한 아키텍처를 지향합니다.

## 2. 주요 기능 (Core Features)
- **문서 업로드 및 분석**: 
  - PDF, 이미지 문서를 직접 읽어 텍스트 및 문맥 파악.
  - **제한**: 무료 티어 최적화를 위해 최대 10장(약 20페이지) 내외로## 3. Data Flow
1. **API Key 설정**: 장치 로컬 저장소에 안전하게 보관.
2. **문서 전처리**:
   - PDF/이미지 직접 전송(Gemini) 혹은 텍스트 추출.
   - **OCI 텍스트**: OCI에서 추출된 텍스트가 전달될 경우, 이를 원문 뷰어에 즉시 매핑.
3. **분석 및 중요 지점 추출**:
   - LLM이 원문을 읽고 요약 및 중요 문장(하이라이트 대상)을 JSON으로 반환.
4. **문제 생성 (Prompt Engineering)**:
   - 각 문제 객체에 `source_context`(정답 근거 문장) 정보를 포함하여 생성.
5. **결과 렌더링 & 오답 노트**:
   - 오답 시 `source_context`를 기반으로 원문 뷰어의 해당 위치로 포커싱 및 하이라이트.
6. **내보내기**: `jspdf`를 사용하여 현재 생성된 퀴즈 세트를 PDF로 변환하여 다운로드.

## 4. Key Strategies for "Free-tier" & "User API"
- **20-Page Limit Logic**: 클라이언트 단에서 PDF 페이지 수를 검사하여 초과 시 절취(Cut)하거나 경고 메시지 출력.
- **Gemini 1.5 Flash 최적화**: 
  - 20페이지는 약 1만~3만 토큰 수준으로, Gemini 1.5 Flash의 무료 티어(분당 15회, 100만 토큰 컨텍스트)에서 매우 쾌적하게 동작함.
- **Context-Referencing**: 틀린 문제에 대해 "원문의 OOO 부분을 다시 읽어보세요"라는 가이드를 주기 위해, 문제 생성 시 원문의 구절을 인용하도록 프롬프트 설계.

## 3. 기술 스택 (Technical Stack)
- **Frontend**: Next.js (App Router), React
- **LLM Integration**: 
  - Gemini 1.5 Flash (20페이지 분량 처리에 최적, 무료 티어 권장)
- **PDF/Text Processing**: 
  - `pdf-dist` (Client-side) 또는 API 기반 직접 전송
  - OCI OCR 텍스트 파서
- **Storage**: IndexedDB (문제 기록, 오답 노트, 로컬 하이라이트 정보 저장)
- **Export**: `jspdf`, `html2canvas` 등 브라우저 기반 다운로드 라이브러리

## 4. 논의 사항 (Discussion Points)
- [x] 최대 범위 설정: 10장 (20페이지).
- [x] 다운로드 기능 포함.
- [x] 오답 노트 및 원문 참조 기능 포함.
- [x] 전체 텍스트 뷰어 및 형광펜 효과 포함.
- [ ] 하이라이트 방식: AI가 추천한 문장 기반 vs 사용자가 직접 칠한 것 보관 여부.
