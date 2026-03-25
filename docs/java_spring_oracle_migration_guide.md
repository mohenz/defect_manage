# Defect Manage: Java Spring & Oracle 19c 마이그레이션 가이드

현재 Supabase (PostgreSQL) 및 클라이언트 사이드 JS 기반으로 구현된 **Defect Manage** 애플리케이션을 **Java Spring Framework (Spring Boot) + Oracle Database 19c** 엔터프라이즈 환경으로 마이그레이션하기 위한 가이드입니다. 특히 최근 강화된 **보안 로그인**, **역할 관리**, **고도화된 결함 조치 로직** 구현에 초점을 맞춥니다.

---

## 1. 아키텍처 개요

### AS-IS (현재)
*   **Frontend**: HTML, CSS, Vanilla JS
*   **Backend**: Serverless (Supabase Client-side interaction)
*   **Database**: Supabase (PostgreSQL)
*   **Security**: Client-side BCrypt hashing

### TO-BE (목표)
*   **Frontend**: 기존 코드 재사용 (REST API 주소만 변경)
*   **Backend**: Java 17+, Spring Boot 3.x
*   **Database**: Oracle Database 19c
*   **Security**: Spring Security + BCrypt (Server-side)
*   **ORM**: JPA (Hibernate)

---

## 2. 데이터베이스 설계 (Oracle 19c)

최신 `db_schema.md` 명세를 기반으로 Oracle 테이블을 생성합니다.

### 2.1. 사용자 테이블 (USERS)

```sql
CREATE TABLE USERS (
    USER_ID              NUMBER PRIMARY KEY,          -- Unique Timestamp 필드
    EMAIL                VARCHAR2(100) UNIQUE NOT NULL, -- 로그인 ID
    PASSWORD             VARCHAR2(255) NOT NULL,       -- 암호화된 비밀번호 (Spring Security BCrypt)
    NAME                 VARCHAR2(100) NOT NULL,        -- 성함
    DEPARTMENT           VARCHAR2(100),                 -- 소속 부서
    ROLE                 VARCHAR2(50) NOT NULL,        -- 역할 (테스터, 조치자, 관리자)
    STATUS               VARCHAR2(20) DEFAULT '사용',   -- 상태 (사용, 사용중지)
    NEEDS_PASSWORD_RESET NUMBER(1) DEFAULT 1,          -- 1(TRUE), 0(FALSE)
    CREATED_AT           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2. 결함 테이블 (DEFECTS)

```sql
CREATE TABLE DEFECTS (
    DEFECT_ID       NUMBER PRIMARY KEY,
    TITLE           VARCHAR2(300) NOT NULL,
    TEST_TYPE       VARCHAR2(50), -- 단위테스트, 통합테스트 등
    SEVERITY        VARCHAR2(50), -- Critical, Major, Minor, Simple
    PRIORITY        VARCHAR2(50), -- P1, P2, P3, P4
    STATUS          VARCHAR2(50) DEFAULT 'New',
    STEPS_TO_REPRO  CLOB,
    MENU_NAME       VARCHAR2(200),
    SCREEN_NAME     VARCHAR2(200),
    SCREEN_URL      CLOB,
    SCREENSHOT      CLOB,         -- 이미지 URL 또는 파일 경로
    ENV_INFO        CLOB,
    CREATOR         VARCHAR2(100), -- 등록자 성함
    ASSIGNEE        VARCHAR2(100), -- 조치자 성함
    ACTION_COMMENT  CLOB,
    ACTION_START    DATE,
    ACTION_END      DATE,
    CREATED_AT      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. 백엔드 보안 구현 (Spring Security)

현재 클라이언트에서 수행하는 BCrypt 암호화를 서버 전담으로 마이크레이션합니다.

### 3.1. BCrypt Password Encoder 설정
```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

### 3.2. 로그인 비즈니스 로직
```java
public boolean login(String email, String rawPassword) {
    User user = userRepository.findByEmail(email);
    if (user != null && encoder.matches(rawPassword, user.getPassword())) {
        // 세션 처리 및 로그인 성공
        return true;
    }
    return false;
}
```

---

## 4. 핵심 기능 구현 가이드

### 4.1. 이미지 업로드 (Screenshot)
*   **AS-IS**: Supabase Storage로 직접 업로드.
*   **TO-BE**: Spring Boot에서 멀티파트 업로드를 처리하고, 파일 서버 또는 Oracle BLOB/CLOB에 정보를 저장합니다.

### 4.2. 날짜 및 시간 처리
*   JS의 `Asia/Seoul` 처리를 Java의 `ZonedDateTime` 또는 `LocalDateTime`과 매핑합니다.
*   Oracle의 `TIMESTAMPTZ` 대신 `TIMESTAMP`를 사용할 경우, DB 세션 타임존 설정을 확인해야 합니다.

### 4.3. 역할 기반 접근 제어 (RBAC)
*   사용자의 `ROLE` 필드(테스터, 조치자, 관리자)를 Spring Security의 `SimpleGrantedAuthority`로 변환하여 API 접근 권한을 관리합니다.

---

## 5. 마이그레이션 체크리스트 (Updated)

1.  [ ] **인증 로직 이관**: 클라이언트 측 BCrypt 암호화를 서버 측 Spring Security로 전환.
2.  [ ] **데이터 타입 일치**: `BIGINT` (PostgreSQL) -> `NUMBER` (Oracle), `TEXT` -> `CLOB`.
3.  [ ] **환경 변수 관리**: Supabase Config 값들을 Spring의 `application.yml`로 이동.
4.  [ ] **초기 데이터 이관**: `needs_password_reset` 값을 포함하여 기존 사용자 계정 정보 안전하게 이전.
5.  [ ] **필드명 매핑**: `test_type`, `action_comment` 등 최신화된 DB 필드명이 Java Entity에 정확히 반영되었는지 확인.

이 가이드는 최신 보안 요구사항과 기능 개선 사항을 포함하고 있으므로, 엔터프라이즈 환경으로의 안정적인 전환을 보장합니다.
