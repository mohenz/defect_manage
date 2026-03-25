# DefectFlow 작업 환경 가이드

이 문서는 다른 PC에서 `defect_manage` 프로젝트를 이어서 작업할 때 필요한 준비 사항, 실행 방법, 점검 절차를 정리한 문서입니다.

## 1. 준비 사항

- Git 설치
- Node.js 20 이상 권장
- VS Code 또는 유사 IDE
- GitHub 저장소 접근 권한
- 인터넷 연결

## 2. 저장소 받기

```powershell
git clone https://github.com/mohenz/defect_manage.git
cd defect_manage
```

## 3. 의존성 설치

```powershell
npm install
```

## 4. 주요 폴더 구조

- `css/`: 스타일
- `js/`: 프론트엔드 로직 및 Supabase 연동 코드
- `database/`: SQL 스키마 및 보조 스크립트
- `tests/`: 단위 테스트 및 E2E 테스트
- `docs/`: 기술 문서
- `.github/workflows/`: GitHub Pages 자동 배포 설정

## 5. 환경 설정 확인

현재 프론트엔드는 `js/config.js`의 Supabase 설정을 사용합니다.

확인 파일:

- `js/config.js`

기본 확인 항목:

- `SUPABASE_URL`
- `SUPABASE_KEY`

주의:

- 현재 구조는 클라이언트에서 Supabase로 직접 접근합니다.
- 다른 Supabase 프로젝트를 사용할 경우 `js/config.js` 값을 새 환경에 맞게 변경해야 합니다.

## 6. 로컬 실행

정적 페이지 확인만 할 경우:

```powershell
start index.html
```

로컬 서버로 확인할 경우:

```powershell
node server.js
```

기본 주소:

- `http://localhost:3000`

## 7. 테스트

단위 테스트:

```powershell
npm run test:unit
```

E2E 테스트:

```powershell
npm run test:e2e
```

## 8. 자주 작업하는 파일

- `js/app.js`: 화면 렌더링, 권한, 폼 제어
- `js/storage.js`: Supabase CRUD 처리
- `css/style.css`: UI 스타일
- `index.html`: 앱 진입점
- `docs/functional_specification.md`: 기능 명세

## 9. 배포 방식

배포는 GitHub Pages 자동 배포입니다.

동작 조건:

- `main` 브랜치에 푸시
- `.github/workflows/static.yml` 실행

배포 URL:

- `https://mohenz.github.io/defect_manage/`

## 10. 권장 작업 순서

1. `main` 최신 코드 pull
2. `npm install`
3. `npm run test:unit`
4. 로컬에서 기능 확인
5. 수정 후 테스트 재실행
6. 커밋 및 `main` 또는 작업 브랜치 푸시
7. GitHub Actions 배포 확인

## 11. 문제 발생 시 점검 항목

- 사용자 목록/결함 목록이 비정상일 때: Supabase 연결 상태 확인
- 저장이 안 될 때: 브라우저 콘솔 오류 및 `js/storage.js` 확인
- 권한 동작이 다를 때: 현재 로그인 사용자 role 확인
- 배포가 반영되지 않을 때: GitHub Actions의 Pages 워크플로우 상태 확인

## 12. 참고 문서

- [functional_specification.md](./functional_specification.md)
- [program_design.md](./program_design.md)
- [db_schema.md](./db_schema.md)
- [github_pages_deployment_plan.md](./github_pages_deployment_plan.md)
