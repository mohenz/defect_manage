# 📋 결함관리 프로그램 설계서 (DefectFlow Design Document)

**최종 수정일: 2026-02-19**  
**작성/검토: Antigravity AI Assistant**

---

## 1. 개요 및 목적
본 문서는 결함(Defect)의 생명주기를 관리하고, 개발자가 결함을 효율적으로 재현 및 조치할 수 있도록 데이터 구조와 화면 설계를 표준화하는 것을 목적으로 합니다. 특히 최근 **보안 로그인**, **Supabase 기반 실시간 데이터 연동**, **테스트 벤치 위젯** 기능을 포함하여 고도화되었습니다.

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

## 3. 데이터베이스 구조 (PostgreSQL/Supabase)

### 3.1 결함 정보 테이블 (defects)

| 컬럼명 | 타입 | 설명 | 비고 |
|:---|:---|:---|:---|
| **defect_id** | BIGINT (PK) | 결함 고유번호 | Timestamp 기반 |
| **title** | VARCHAR(200)| 결함명 | 필수 입력 (5자 이상) |
| **test_type** | VARCHAR(50) | 테스트 구분 | 단위, 통합, 사용자 테스트 등 |
| **severity** | VARCHAR(20) | **심각도** | Critical, Major, Minor, Simple |
| **priority** | VARCHAR(10) | **우선순위** | P1(긴급), P2, P3, P4 |
| **status** | VARCHAR(20) | 결함상태 | New ~ Closed |
| **steps_to_repro** | TEXT | **재현 단계** | 결함 발생 순차 경로 |
| **menu_name** | VARCHAR(100)| 메뉴명 | 페이지 대분류/중분류 |
| **screen_name** | VARCHAR(100)| 화면명 | 물리적 화면 이름 |
| **screen_url** | TEXT | 발생 화면 URL | 실제 브라우저 주소 |
| **screenshot** | TEXT | **화면 캡처** | Supabase Storage Public URL |
| **env_info** | TEXT | **테스트 환경** | OS, 브라우저 버전 등 |
| **creator** | VARCHAR(50) | 등록자 | 사용자 성함 연동 |
| **assignee** | VARCHAR(50) | 조치자 | 담당 조치자 성함 연동 |
| **action_comment** | TEXT | 결함조치내용 | 원인 분석 및 조치 결과 |
| **action_start** | DATE | 조치시작일 | |
| **action_end** | DATE | 조치완료일 | |
| **created_at** | TIMESTAMPTZ | 등록일시 | |
| **updated_at** | TIMESTAMPTZ | 최종수정일시 | |

### 3.2 사용자 테이블 (users)

| 컬럼명 | 타입 | 설명 | 비고 |
|:---|:---|:---|:---|
| **user_id** | BIGINT (PK) | 관리번호 | Timestamp 기반 |
| **email** | VARCHAR(100)| 이메일 (UNIQUE) | 로그인 ID 및 알림용 |
| **password** | VARCHAR(255)| 비밀번호 | BCrypt 암호화 저장 |
| **name** | VARCHAR(50) | 성함 | 화면 표시용 |
| **department** | VARCHAR(50) | 소속 | QA팀, 개발1팀 등 |
| **role** | VARCHAR(20) | 역할 | 테스터, 조치자, 관리자 |
| **status** | VARCHAR(10) | 상태 | 사용, 사용중지 |
| **needs_pw_reset** | BOOLEAN | 비번 초기화 | 초기 가입/초기화 시 TRUE |
| **created_at** | TIMESTAMPTZ | 등록일 | |
| **updated_at** | TIMESTAMPTZ | 수정일 | |

---

## 4. UI/UX 및 보안 설계 가이드

### 4.1 인증 및 권한 관리
- **BCrypt 암호화**: 모든 사용자 비밀번호는 클라이언트에서 해싱 처리되어 송수신됩니다.
- **역할 기반 제어(RBAC)**: '관리자' 권한 사용자만 설정 및 담당자 관리 메뉴에 접근 가능합니다.
- **리다이렉트 보호**: 비로그인 사용자는 로그인 페이지로 자동 리다이렉트되며, 로그인 후 이전 작업 페이지로 복구됩니다.

### 4.2 외부 연동 (Test Bench)
- **Standalone 모드**: 사이드바를 제거하고 결함 등록 폼만 풀사이즈로 제공하는 특수 모드를 지원합니다.
- **실시간 캡처**: `html2canvas`를 이용해 위젯 클릭 시점의 화면을 자동으로 데이터화합니다.

---

## 5. 🧠 스마트 작업 요구사항 (USER Requirements)
본 프로젝트의 모든 개발은 다음의 3대 핵심 요구사항을 준수합니다.

1.  **깊이 있는 영향도 분석**: 수정 전 전역적인 사이드 이펙트를 분석하여 기존 기능 보호.
2.  **선제적 문제 대응**: 잠재적 오류 요소를 미리 파악하여 보강 코드 선제적 적용.
3.  **'First-Time-Right'**: 반복 수정을 지양하고 단 한 번의 배포로 완벽한 결과 도출.
