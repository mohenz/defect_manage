# DefectFlow 데이터베이스 테이블 설계서 (PostgreSQL/Supabase)

이 문서는 `DefectFlow` 시스템의 데이터 영속성을 위한 Supabase(PostgreSQL) 테이블 설계 명세입니다. 보안 로그인 및 고도화된 결함 관리 기능을 포함하고 있습니다.

## 1. 사용자 테이블 (users)

사용자 계정 정보 및 인증/권한 상태를 관리합니다.

```sql
CREATE TABLE users (
    user_id              BIGINT PRIMARY KEY,          -- 관리번호 (Unique Timestamp)
    email                VARCHAR(100) UNIQUE NOT NULL, -- 이메일 (로그인 ID)
    password             VARCHAR(255) NOT NULL,       -- 암호화된 비밀번호 (BCrypt)
    name                 VARCHAR(50) NOT NULL,        -- 성함
    department           VARCHAR(50),                 -- 소속 부서
    role                 VARCHAR(20) NOT NULL,        -- 역할 (테스터, 조치자, 관리자)
    status               VARCHAR(10) DEFAULT '사용',   -- 계정 상태 (사용, 사용중지)
    needs_password_reset BOOLEAN DEFAULT TRUE,        -- 초기 비번 변경 필요 여부
    created_at           TIMESTAMPTZ DEFAULT NOW(),   -- 등록일
    updated_at           TIMESTAMPTZ DEFAULT NOW()    -- 수정일
);
```

## 2. 결함 정보 테이블 (defects)

발생한 결함의 상세 내용과 조치 이력을 관리합니다.

```sql
CREATE TABLE defects (
    defect_id       BIGINT PRIMARY KEY,          -- 결함 ID (Unique Timestamp)
    title           VARCHAR(200) NOT NULL,       -- 결함 제목
    test_type       VARCHAR(50),                 -- 테스트 구분 (선오픈, 통합테스트, 3자테스트(I&C), 3자테스트(W2), 단위 등)
    severity        VARCHAR(20),                 -- 심각도 (Critical, Major, Minor, Simple)
    priority        VARCHAR(10),                 -- 우선순위 (P1, P2, P3, P4)
    status          VARCHAR(20) DEFAULT 'New',   -- 상태 (New, Open, Resolved, Closed 등)
    steps_to_repro  TEXT,                        -- 재현 단계
    menu_name       VARCHAR(100),                -- 메뉴명
    screen_name     VARCHAR(100),                -- 화면명
    screen_url      TEXT,                        -- 관련 화면 URL (또는 캡처 원본 링크)
    screenshot      TEXT,                        -- 캡처 이미지 (기존 URL 또는 신규 inline data URL)
    defect_identification VARCHAR(50),           -- 결함식별 (기존결함, 협의필요, 신규요구사항, 결함아님)
    env_info        TEXT,                        -- 테스트 환경 정보 (Browser/OS)
    creator         VARCHAR(50),                 -- 등록자 (사용자 성함 연동)
    assignee        VARCHAR(50),                 -- 담당 조치자 (사용자 성함 연동)
    action_comment  TEXT,                        -- 결함 조치 내용
    action_start    DATE,                        -- 조치 시작일
    action_end      DATE,                        -- 조치 종료일
    is_deleted      VARCHAR(1) DEFAULT 'N',      -- 삭제 여부 (Y/N)
    created_at      TIMESTAMPTZ DEFAULT NOW(),   -- 등록일
    updated_at      TIMESTAMPTZ DEFAULT NOW()    -- 수정일
);
```

## 3. 애플리케이션 설정 테이블 (app_settings)

시스템의 전역 설정 정보를 Key-Value 형태로 관리합니다.

```sql
CREATE TABLE app_settings (
    key          VARCHAR(100) PRIMARY KEY,      -- 설정 키 (예: 'global_config')
    value        JSONB NOT NULL,                -- JSON 형태의 설정 값
    updated_at   TIMESTAMPTZ DEFAULT NOW()      -- 수정일
);

-- 초기 데이터 예시 (모든 테스트 구분 활성화)
-- INSERT INTO app_settings (key, value) VALUES ('global_config', '{"enabledTestTypes": ["선오픈", "통합테스트", "3자테스트(I&C)", "3자테스트(W2)", "단위테스트"]}');
```

## 4. 결함 저장 오류 로그 테이블 (defect_save_error_logs)

외부 사이트 연동, Chrome 확장프로그램 연동, 일반 등록 화면 등에서 결함 저장에 실패했을 때 원인을 중앙에서 추적하기 위한 테이블입니다.

```sql
CREATE TABLE defect_save_error_logs (
    id               BIGSERIAL PRIMARY KEY,
    client_log_id    VARCHAR(80) UNIQUE,
    operation        VARCHAR(30) NOT NULL,
    defect_id        BIGINT,
    pending_source   VARCHAR(30) DEFAULT 'manual',
    stage            VARCHAR(50),
    error_type       VARCHAR(50),
    message          TEXT NOT NULL,
    error_code       VARCHAR(50),
    error_details    TEXT,
    error_hint       TEXT,
    runtime_context  JSONB DEFAULT '{}'::jsonb,
    payload_summary  JSONB DEFAULT '{}'::jsonb,
    extra            JSONB DEFAULT '{}'::jsonb,
    reported_by      VARCHAR(50),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_defect_save_error_logs_created_at
    ON defect_save_error_logs (created_at DESC);

CREATE INDEX idx_defect_save_error_logs_pending_source
    ON defect_save_error_logs (pending_source);

CREATE INDEX idx_defect_save_error_logs_operation
    ON defect_save_error_logs (operation);
```

### 저장 원칙

*   **원본 캡처 미저장**: `payload_summary`에는 캡처 존재 여부와 길이 등 요약 정보만 저장하고, base64 원문은 저장하지 않습니다.
*   **로컬 백업 병행**: 중앙 저장에 실패할 경우에도 브라우저 `localStorage`에 최근 로그를 백업해 관리자 화면에서 확인할 수 있습니다.
*   **운영 분석 목적**: `runtime_context`에는 현재 화면, 모달, 역할, 사용자명, 브라우저 UA 등 분석에 필요한 최소 실행 문맥만 저장합니다.

## 5. 주요 설계 특징 및 제약 조건

*   **인증 보안**: `password` 필드는 클라이언트 측에서 `bcryptjs`를 통해 해싱된 값만 저장하며, 일반 텍스트는 서버로 전달되지 않습니다.
*   **결함식별**: `defect_identification` 필드는 현업/개발 간의 의사소통을 위해 추가되었으며, 조치자 및 관리자만 수정 권한을 가집니다.
*   **이미지 저장 구조**: `screenshot` 필드는 기존 데이터의 URL 형식과 신규 데이터의 inline data URL 형식을 함께 허용합니다.
*   **시간대(Timezone)**: 모든 시간 데이터는 `TIMESTAMPTZ`를 사용하며, 애플리케이션에서 `Asia/Seoul` 기준으로 처리됩니다.
*   **데이터 타입**: `defect_id`와 `user_id`는 JavaScript의 `Date.now()` 값이 입력되므로 `BIGINT` 타입을 유지합니다.
