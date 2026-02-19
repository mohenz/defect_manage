# 📋 결함관리 프로그램 설계서 (DefectFlow Design Document)

**최종 수정일: 2026-02-10**  
**작성/검토: Antigravity AI Assistant**

---

## 1. 개요 및 목적
본 문서는 결함(Defect)의 생명주기를 관리하고, 개발자가 결함을 효율적으로 재현 및 조치할 수 있도록 데이터 구조와 화면 설계를 표준화하는 것을 목적으로 합니다. 단순 기록을 넘어 **'재현성 증대'**와 **'조치 우선순위 체계화'**에 중점을 둡니다.

---

## 2. 결함 관리 표준 프로세스 (Lifecycle)
결함은 등록부터 종료까지 다음의 표준 워크플로우를 따릅니다.

1.  **New(신규)**: 결함이 등록된 초기 상태 (등록 직후)
2.  **Open(접수)**: 담당자(Assignee)가 할당되고 조치가 결정된 상태
3.  **In Progress(조치 중)**: 결함 수정 및 원인 분석이 진행 중인 상태
4.  **Resolved(수정 완료)**: 개발자가 조치를 완료하여 검증을 요청한 상태
5.  **Verified(검증 완료)**: QA/등록자가 조치 내용을 확인하고 정상 동작을 검증한 상태
6.  **Closed(종료)**: 모든 조치 및 검증이 완료되어 결함이 종결된 상태
7.  **Reopened(재오픈)**: 검증 실패 시 다시 조치를 요청하는 상태

---

## 3. 데이터베이스 구조 (Advanced Schema)

### 3.1 결함 정보 테이블 (defects)

| 컬럼명 | 타입 | 설명 | 비고 |
|:---|:---|:---|:---|
| **defect_id** | BIGINT (PK) | 결함 고유번호 | Timestamp 기반 |
| **title** | VARCHAR(200)| 결함명 | 명확하고 간결하게 작성 |
| **defect_type** | VARCHAR(20) | 결함유형 | 기능오류, UI/UX, 성능 등 |
| **severity** | VARCHAR(10) | **심각도** | Critical, Major, Minor, Simple |
| **priority** | VARCHAR(10) | **우선순위** | P1(긴급), P2, P3, P4 |
| **status** | VARCHAR(20) | 결함상태 | New ~ Closed |
| **env_info** | VARCHAR(500)| **테스트 환경** | OS, 브라우저 버전 등 (자동 수집) |
| **steps_to_repro** | TEXT | **재현 단계** | 결함 발생 순차 경로 |
| **expected_result** | TEXT | **기대 결과** | 정상 동작 시나리오 |
| **actual_result** | TEXT | **실제 결과** | 오류 현상 |
| **screenshot** | LONGTEXT | **화면 캡처** | Base64 이미지 데이터 |
| **screen_url** | VARCHAR(500)| 발생 화면 URL | 실제 브라우저 주소 |
| **menu_name** | VARCHAR(200)| 메뉴명 | 페이지 대분류/중분류 |
| **screen_name** | VARCHAR(200)| 화면명 | 물리적 화면 이름 |
| **action_comment** | TEXT | 결함조치내용 | 원인 분석 및 조치 결과 |
| **creator** | VARCHAR(50) | 등록자 | 담당자 테이블 연동 |
| **assignee** | VARCHAR(50) | 조치자 | 담당자 테이블 연동 |
| **action_start** | DATETIME | 조치시작일 | |
| **action_end** | DATETIME | 조치완료일 | |
| **created_at** | DATETIME | 등록일시 | |
| **updated_at** | DATETIME | 최종수정일시 | |

### 3.2 결함관리담당자 테이블 (users)

| 컬럼명 | 타입 | 설명 | 비고 |
|:---|:---|:---|:---|
| **user_id** | BIGINT (PK) | 관리번호 | Timestamp 기반 |
| **role** | VARCHAR(20) | 역할 | 테스트, 테스터, 조치자, 관리자 |
| **department** | VARCHAR(50) | 소속 | QA팀, 개발1팀 등 |
| **name** | VARCHAR(50) | 이름 | 중복 피함 |
| **email** | VARCHAR(100)| 이메일 | 알림 전용 |
| **status** | VARCHAR(10) | 상태 | 사용, 사용중지 |
| **created_at** | DATETIME | 등록일 | |
| **updated_at** | DATETIME | 수정일 | |

---

## 4. UI/UX 화면 설계 가이드

### 4.1 등록 및 수정 화면 (Form)
- **정보 그룹화**: 기본 정보, 상세 정보, 재현 정보를 섹션으로 구분하여 가독성 확보.
- **이미지 미리보기**: 캡처된 이미지를 즉시 확인하고, 클릭 시 확대 팝업(Image Viewer) 제공.
- **담당자 자동 매핑**: 등록된 `users` 데이터를 기반으로 드롭다운 선택 지원.

### 4.2 목록 및 대시보드 (View)
- **핵심 지표 강조**: 전체 건수, 진행 중, 조치 완료, 크리티컬 결함 수를 상단 대시보드에 배치.
- **시인성 확보**: 심각도 및 상태별로 Badge 디자인을 차별화하여 강조.

---

## 5. 핵심 준수 사항
1.  **재현 단계 명확화**: `steps_to_repro`가 불분명할 경우 조치 불가로 판단.
2.  **데이터 분리**: 실제 브라우저 주소(`screen_url`)와 캡처 이미지(`screenshot`) 데이터를 명확히 분리하여 저장.
3.  **환경 자동화**: 테스터의 수동 입력을 줄이기 위해 Browser UserAgent 정보를 자동으로 수집.
