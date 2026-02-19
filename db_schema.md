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
    test_type       VARCHAR(50),                 -- 테스트 구분 (단위, 통합 등)
    severity        VARCHAR(20),                 -- 심각도 (Critical, Major, Minor, Simple)
    priority        VARCHAR(10),                 -- 우선순위 (P1, P2, P3, P4)
    status          VARCHAR(20) DEFAULT 'New',   -- 상태 (New, Open, Resolved, Closed 등)
    steps_to_repro  TEXT,                        -- 재현 단계
    menu_name       VARCHAR(100),                -- 메뉴명
    screen_name     VARCHAR(100),                -- 화면명
    screen_url      TEXT,                        -- 관련 화면 URL (또는 캡처 원본 링크)
    screenshot      TEXT,                        -- 캡처 이미지 URL (Supabase Storage 연동)
    env_info        TEXT,                        -- 테스트 환경 정보 (Browser/OS)
    creator         VARCHAR(50),                 -- 등록자 (사용자 성함 연동)
    assignee        VARCHAR(50),                 -- 담당 조치자 (사용자 성함 연동)
    action_comment  TEXT,                        -- 결함 조치 내용
    action_start    DATE,                        -- 조치 시작일
    action_end      DATE,                        -- 조치 종료일
    created_at      TIMESTAMPTZ DEFAULT NOW(),   -- 등록일
    updated_at      TIMESTAMPTZ DEFAULT NOW()    -- 수정일
);
```

## 3. 주요 설계 특징 및 제약 조건

*   **인증 보안**: `password` 필드는 클라이언트 측에서 `bcryptjs`를 통해 해싱된 값만 저장하며, 일반 텍스트는 서버로 전달되지 않습니다.
*   **스토리지 연동**: `screenshot` 필드는 과거 Base64 직접 저장 방식에서 **Supabase Storage(defect-images 버킷)**의 Public URL을 저장하는 방식으로 고도화되었습니다.
*   **시간대(Timezone)**: 모든 시간 데이터는 `TIMESTAMPTZ`를 사용하며, 애플리케이션에서 `Asia/Seoul` 기준으로 처리됩니다.
*   **데이터 타입**: `defect_id`와 `user_id`는 JavaScript의 `Date.now()` 값이 입력되므로 `BIGINT` 타입을 유지합니다.
