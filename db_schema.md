# DefectFlow 데이터베이스 테이블 설계서 (SQL)

현재 JSON 기반의 데이터를 관계형 데이터베이스(RDBMS)로 전환하기 위한 테이블 생성 스크립트입니다.

## 1. 결함관리담당자 테이블 (users)

담당자의 정보 및 시스템 권한을 관리하는 테이블입니다.

```sql
CREATE TABLE users (
    user_id       BIGINT PRIMARY KEY,          -- 관리번호 (Unique Timestamp)
    role          VARCHAR(20) NOT NULL,        -- 역할 (테스트, 테스터, 조치자, 관리자)
    department    VARCHAR(50),                 -- 소속
    name          VARCHAR(50) NOT NULL,        -- 이름
    email         VARCHAR(100),                -- 이메일
    status        VARCHAR(10) DEFAULT '사용',   -- 상태 (사용, 사용중지)
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 2. 결함 정보 테이블 (defects)

발생한 결함의 상세 내용과 처리 상태를 관리하는 테이블입니다.

```sql
CREATE TABLE defects (
    defect_id       BIGINT PRIMARY KEY,          -- 결함 ID (Unique Timestamp)
    title           VARCHAR(200) NOT NULL,       -- 결함 제목
    defect_type     VARCHAR(50),                 -- 결함 유형
    severity        VARCHAR(20),                 -- 심각도 (Critical, Major, Minor, Simple)
    priority        VARCHAR(10),                 -- 우선순위 (P1, P2, P3, P4)
    status          VARCHAR(20) DEFAULT 'New',   -- 상태 (New, Open, Resolved, Closed 등)
    steps_to_repro  TEXT,                        -- 재현 단계
    menu_name       VARCHAR(100),                -- 메뉴명
    screen_name     VARCHAR(100),                -- 화면명
    screen_url      VARCHAR(500),                -- 관련 화면 URL
    screenshot      LONGTEXT,                    -- 캡처 이미지 (Base64 Data URL)
    env_info        VARCHAR(500),                -- 테스트 환경 정보 (OS/Browser)
    creator         VARCHAR(50),                 -- 등록자 (users.name 연동)
    assignee        VARCHAR(50),                 -- 담당자 (users.name 연동)
    action_start    DATETIME,                    -- 조치 시작일
    action_end      DATETIME,                    -- 조치 종료일
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 3. 주요 인덱스 및 제약 조건 (참고)

*   `defect_id`와 `user_id`는 현재 JavaScript의 `Date.now()` 값을 기반으로 하므로 `BIGINT` 타입을 권장합니다.
*   `screenshot` 데이터는 Base64 인코딩된 문자열이므로 크기를 고려하여 `LONGTEXT` 또는 대용량 BLOB 타입을 사용해야 합니다.
*   향후 고도화 시 `creator`와 `assignee` 필드는 `users.user_id`를 참조하는 외래키(Foreign Key)로 구성하는 것이 좋습니다.
