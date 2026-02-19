# 🚀 GitHub Pages 배포 플랜 (DefectFlow)

본 문서는 `defect_manage` 프로젝트를 GitHub Pages를 통해 웹 서비스로 배포하기 위한 기술적 전략과 실행 단계를 정의합니다.

---

## 1. 아키텍처 전환 전략
GitHub Pages는 정적(Static) 호스팅만 지원하므로, 현재의 **Node.js(Express) + Local JSON 파일** 기반 아키텍처를 **Client-Side Persistence** 모델로 전환합니다.

### 🛠️ 데이터 저장 방식 변경
*   **Backend (Express)**: 제거 또는 데모용으로 유지.
*   **Database (JSON)**: `localStorage`로 대체.
*   **초기 데이터 로딩**: 기존 `defects.json`과 `users.json`을 정적 자산으로 포함하여, 사이트 최초 접속 시 `localStorage`에 초기화용으로 사용.
*   **이미지 처리**: 서버 파일 저장 방식 대신 **Base64 String** 형태로 `localStorage`에 직접 저장 (현재 `app.js`에서 이미 처리 중인 로직 활용).

---

## 2. 주요 수정 필요 사항

### ① 데이터 서비스 레이어 (StorageService) 개발
모든 API 호출(`fetch`) 로직을 `localStorage`를 직접 조작하는 서비스 객체로 캡슐화합니다.
*   `getAllDefects()`: `localStorage`에서 읽기 (없으면 static json fetch).
*   `saveDefect(item)`: `localStorage` 배열에 push/update.
*   `deleteDefect(id)`: `localStorage` 배열에서 filter.

### ② 경로 정규화 (Base Path)
GitHub Pages는 `https://[username].github.io/[repo-name]/` 경로를 사용합니다.
*   `index.html` 내의 `/css/style.css`, `/js/app.js` 등 절대 경로를 상대 경로(`./`)로 변경하거나 `<base href="/defect_manage/">` 태그 추가.

### ③ GitHub Actions 자동 배포 설정
수동 배포 대신 `.github/workflows/static.yml`을 작성하여 `main` 브랜치 푸시 시 자동 배포되도록 설정합니다.

---

## 3. 단계별 실행 로드맵

### Phase 1: 로컬 정적화 검증 (Step-by-Step)
1.  `public/js/app.js` 내의 `fetchData` 및 API 호출부 수정.
2.  `server.js` 없이 브라우저에서 `index.html`을 직접 열었을 때 모든 기능(등록, 수정, 조회)이 동작하는지 검증.
3.  이미지 업로드 및 대시보드 통계가 `localStorage` 기반으로 실시간 갱신되는지 확인.

### Phase 2: 배포 환경 최적화
1.  `index.html` 및 `app.js` 파일 내의 경로를 GitHub Pages 환경에 맞게 조정.
2.  SEO 태그 및 메타 설명 추가 (영문판 디자인 문서 내용 반영).

### Phase 3: GitHub 배포 실행
1.  `.github/workflows/deploy.yml` 생성.
2.  GitHub Repository 생성 및 Push.
3.  Settings -> Pages 설정에서 배포 소스를 GitHub Actions로 변경.

---

## 4. 기대 효과
*   **비용 영원히 0원**: 무료 호스팅 및 무제한 트래픽(제한 범위 내).
*   **빠른 접속 속도**: 전 세계 CDN을 통한 정적 파일 서비스.
*   **대화형 포트폴리오**: 서버 없이도 완벽하게 동작하는 결함 관리 시스템 시연 가능.
