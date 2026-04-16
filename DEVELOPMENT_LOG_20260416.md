# Development Log (2026.04.16)

## 개요
오늘 세션에서는 **AI Document Quizzer (ociquestion)** 프로젝트의 안정성, 반응형 레이아웃, 그리고 다운로드 환경을 크게 고도화했습니다. 로컬 저장소를 연동하여 사용자의 앱 경험을 매끄럽게 만들었고, 치명적인 PDF 다운로드 관련 버그를 근본적으로 수정했습니다. 

마지막으로 GitHub 저장소(`mylalaland/ociquestion`)와 연동을 마쳤으며, 향후 Vercel 등 플랫폼에 배포할 준비가 완전히 끝났습니다.

## 상세 변경 및 추가 사항

### 1. 사용자 경험 및 설정 구조 고도화 (Persistence)
* **Local Storage Storage 연동:** `numQuestions(문제 수)`, `selectedTypes(문제 유형)`, `difficulty(난이도)`, `quizFontSize(글자 크기)`, `retryMultipleChoice(재도전 모드)` 등 앱의 모든 상태가 조작 즉시 브라우저 `localStorage`에 자동 보존되도록 구현했습니다.
* **사용자 설정 UI:** 우측 상단의 톱니바퀴 모달을 통해 폰트 크기와 객관식 재도전 유무를 전역으로 세팅할 수 있게 개선했습니다.
* **모바일 반응형 탭(Tab) 레이아웃:** 모바일 같이 좁은 화면에서는 좌우 분할 스크롤 형식이 불편하므로, 모바일 해상도(lg 이하)에서는 `[📝 퀴즈 풀이]` 와 `[📖 원문 보기]` 두 개의 상단 탭으로 화면을 깔끔하게 나누어 즉각 전환할 수 있도록 대응했습니다 (`activeTab` state 도임).

### 2. 퀴즈 평가 시스템 및 UX 개선
* **수능형 / 서술형 자율 피드백:** 기존의 strict O/X 판별을 폐지하고, "제출된 답변"과 "AI의 모범 답안"을 동시에 상하 나란히 보여주어 자율적으로 성취도를 검토(Self-grading)할 수 있는 UI를 도입했습니다.
* **객관식 Second-Chance:** 사용자가 오답을 눌렀을 경우, 즉각 정답을 노출하는 대신 취소선 처리 후 1회 '재도전'을 안내하는 UX를 구현했습니다.

### 3. API 에러 핸들링 및 안정성 대책
* 단순히 '오류가 났습니다'라는 Alert 대신, 서버 혼잡(503), 할당량 초과(429), 키 오류(400) 등을 각각 세분화하여 한국어로 대응 방안과 함께 경고 메시지를 띄우는 예외 처리(Exception Catching)를 세밀하게 구축했습니다.

### 4. PDF 백지 출력/UNKNOWN 버그 해결 & TXT 내보내기 확장
* **PDF 원인 및 해결 로직:** CSS의 `max-height` 요소가 걸려있을 때 라이브러리(`html-to-image`)에서 숨겨진 컨텐츠들을 직렬화(Serialize)하지 못하고 빈 dataUrl 속성을 뱉어내는 현상. 
* **해결 기술 (Offscreen Clone Method):** 
  ```typescript
  // 화면 보이지 않는 영역(top: -9999px)에 임시로 노드를 100% clone하여,
  // 아무런 스타일 제약이 없는 상태로 이미지를 안전하게 구워낸 뒤 삭제 (PDF 오류 없음).
  ```
* **PDF 대체 텍스트 출력:** 클립보드에 활용하기 쉽도록 힌트와 해설, 정답 옵션을 포매팅 하여 `.txt` 파일로 다운로드 하는 기능을 추가했습니다.

### 5. 컴포넌트 마이너 버그 수정
* **원문 분석 뷰어 레이아웃:** 헤더 상단바 엘리먼트가(`FullTextHighlight.tsx`) Sticky 상태로 고정되어 글씨를 가리던 버그를, Sticky 속성을 제거하여 자연스럽게 스크롤과 함께 말려 올라가도록 수정했습니다. 좀 더 안정적인 문서 뷰잉 뷰가 확보되었습니다.

---

## 🚀 다음 작업 (Next Steps)
다음 구동 시에는 아래 사항들을 중심으로 프로젝트를 이어나갈 수 있습니다.

1. **Vercel 프로덕션 배포 체크:**
   - GitHub의 master 브랜치를 Vercel에 인볼브하여, Vercel Build Phase 중 Type Error나 ESLint 문제가 발생하는지 점검합니다.
2. **IndexedDB 또는 클라우드 DB 고도화 검토:**
   - 만일 브라우저가 꺼졌을 때 '단순 설정'뿐 아니라 사용자가 풀이했던 '퀴즈 결과 데이터 자체'까지 보존시켜야 한다면 IndexedDB를 활용해 앱을 PWA 수준으로 발전시킬 수 있습니다.
3. **Framer Motion Warning:**
   - 터미널에 노출되는 `[browser] You are trying to animate backgroundColor from "transparent"...` 경고 메시지 조치. (transparent 대신 rgb(0,0,0,0) 계열 초기 포맷을 적용하여 애니메이션 경고 해제.)
