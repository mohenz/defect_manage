---
description: defect_manage 개발 작업 워크플로우 (기능 개선, 버그 수정, UI 변경)
---

## 사전 준비

1. 로컬 서버 실행 확인
   ```
   cd d:\Workspace\defect_manage
   npm start
   ```
   - 접속 URL: http://localhost:3000
   - 이미 실행 중이면 `EADDRINUSE` 오류 발생 → 그대로 브라우저에서 확인

2. 주요 파일 위치 파악
   - **UI/로직**: `js/app.js` (렌더링, 이벤트, 비즈니스 로직)
   - **DB 연동**: `js/storage.js` (Supabase CRUD)
   - **스타일**: `css/style.css`
   - **진입점**: `index.html`
   - **변경 이력**: `docs/CHANGELOG.md`

---

## 기능 개선 / UI 수정 작업

1. `js/app.js` 에서 수정 대상 함수 확인
   - 대시보드 관련: `renderDashboard()`
   - 목록 관련: `renderList()`
   - 등록/수정 폼: `renderForm()`
   - 설정 화면: `renderSettings()`

2. 파일 내 혼합 인코딩(CRLF/LF) 주의사항
   - `app.js`는 CRLF/LF 혼재 파일
   - `replace_file_content` / `multi_replace_file_content` 도구로 편집 **실패할 수 있음**
   - 실패 시 Python 패치 스크립트를 `/tmp/` 또는 프로젝트 루트에 작성 후 실행

   ```powershell
   python patch_xxx.py
   ```
   - 적용 후 스크립트 파일 즉시 삭제:
   ```powershell
   Remove-Item patch_xxx.py -Force
   ```

3. 결과 검증 (Python)
   ```python
   # 변경 키워드가 파일에 존재하는지 확인
   python -c "
   with open('js/app.js', 'rb') as f: text = f.read().decode('utf-8')
   print('패치 확인:', '검색할_키워드' in text)
   "
   ```

---

## Supabase 연동 함수 추가 작업

1. `js/storage.js` 하단 `StorageService` 객체 내에 신규 함수 추가
2. 함수 위치: 마지막 함수(`saveAppSettings`) 앞에 삽입 권장
3. 필터 적용 패턴 참고:
   ```javascript
   async myNewFunction(filters = {}) {
       let query = supabaseClient.from('defects').select('...').eq('is_deleted', 'N');
       if (filters.severity) query = query.eq('severity', filters.severity);
       const { data, error } = await query.order('created_at', { ascending: false });
       if (error) throw error;
       return data;
   },
   ```

---

## 작업 완료 후 처리

// turbo
4. 변경 이력 기록 (`docs/CHANGELOG.md`)
   - 날짜, 항목 번호, 변경 전/후, 수정 파일명을 기재
   - 형식:
     ```
     #### N. 기능명
     - **변경 전**: 기존 동작 설명
     - **변경 후**: 개선된 동작 설명
     - **수정 파일**: `js/app.js` — 함수명
     ```

5. 브라우저에서 수동 테스트
   - URL: http://localhost:3000
   - 캐시 문제 발생 시: `Ctrl+Shift+R` (강제 새로고침)

---

## 클라우드 배포 (Vercel)

> 로컬 테스트 완료 후 아래 순서로 진행

// turbo
6. 변경 파일 스테이징
   ```powershell
   cd d:\Workspace\defect_manage
   git add js/app.js js/storage.js
   # 신규 파일이 있을 경우 추가
   # git add docs/CHANGELOG.md .agent/workflows/...
   ```

// turbo
7. 커밋 메시지 작성 (영문, Conventional Commits 형식 권장)
   ```powershell
   git commit -m "feat: 기능 요약 한 줄

   - 세부 변경 내역 1
   - 세부 변경 내역 2
   - 수정 파일: js/app.js, js/storage.js"
   ```
   - 접두어 규칙:
     | 접두어 | 용도 |
     |--------|------|
     | `feat:` | 신규 기능 추가 |
     | `fix:` | 버그 수정 |
     | `ui:` | UI/스타일 변경 |
     | `refactor:` | 코드 구조 개선 (기능 변화 없음) |
     | `docs:` | 문서 추가/수정 |
     | `chore:` | 설정, 워크플로우 등 기타 |

// turbo
8. GitHub 원격 저장소에 푸시
   ```powershell
   git push origin main
   ```
   - 푸시 완료 메시지 예시:
     ```
     To https://github.com/mohenz/defect_manage.git
        b487936..aea4daf  main -> main
     ```

9. GitHub Pages 배포 확인
   - GitHub `main` 브랜치 push 시 **GitHub Actions가 자동으로 배포 트리거**
   - 배포 완료까지 약 **1~3분** 소요
   - 🌐 **배포 URL**: https://mohenz.github.io/defect_manage
   - 배포 상태 확인: https://github.com/mohenz/defect_manage/actions
   - 배포 실패 시: Actions 탭 > 실패한 워크플로우 클릭 > 로그 확인

### 배포 구성 정보

| 항목 | 내용 |
|------|------|
| 플랫폼 | GitHub Pages (Static Hosting) |
| 배포 URL | https://mohenz.github.io/defect_manage |
| 연동 저장소 | https://github.com/mohenz/defect_manage |
| 배포 브랜치 | `main` |
| 배포 방식 | GitHub Actions 자동 배포 |
| DB | Supabase (클라우드, 별도 서버 불필요) |

### 주의사항
- `data/*.json`, `images/`, `.env` 는 `.gitignore`에 포함되어 **푸시되지 않음**
- GitHub Pages 환경에서 `server.js`는 사용되지 않음 (정적 파일 서빙만 해당)
- Supabase 키(`js/config.js`)는 퍼블릭 키이므로 커밋해도 무방

---



## 패치 스크립트 작성 가이드 (인코딩 우회)

`app.js` 편집 도구가 실패할 때 사용하는 Python 방식:

```python
# 템플릿
with open('js/app.js', 'rb') as f:
    text = f.read().decode('utf-8')

original = text

old = '''기존 문자열'''
new = '''새 문자열'''

# LF 버전 먼저, 실패 시 CRLF 버전 시도
if old in text:
    text = text.replace(old, new, 1)
    print("패치 적용 완료")
else:
    old_crlf = old.replace('\n', '\r\n')
    if old_crlf in text:
        text = text.replace(old_crlf, new, 1)
        print("패치 적용 완료 (CRLF)")
    else:
        print("ERROR: 타겟 문자열을 찾을 수 없음")

if text != original:
    with open('js/app.js', 'wb') as f:
        f.write(text.encode('utf-8'))
    print("파일 저장 완료")
```

---

## 주요 구조 참고

### 대시보드 렌더링 순서 (`renderDashboard`)
1. 통계 계산 (creatorStats, testTypeStats, statusStats, pct 헬퍼)
2. HTML 순서:
   - 상단 stat-card (전체/진행중/조치완료/크리티컬)
   - Chart.js 차트 (결함 상태별 비중 / 심각도별 비중)
   - **결함 상태 현황 표** (테스트 구분 × 상태별)
   - **테스트 구분별 결함 현황 표** (테스트 구분 × 심각도별, 비중 포함)
   - 최근 등록된 결함 (최대 10건)
   - 등록자별 결함 통계

### 엑셀 다운로드 흐름
```
downloadExcel()
  └─ StorageService.getAllDefectsForExport(filters)   // 전체 조회, 이미지 제외
       └─ Supabase SELECT (필터 적용, 페이징 없음)
  └─ CSV 생성 (BOM 포함 UTF-8)
  └─ 다운로드 링크 클릭 트리거
```
