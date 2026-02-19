# Defect Manage: Java Spring & Oracle 19c 마이그레이션 가이드

현재 Node.js (Express) + JSON 파일 기반으로 구현된 **Defect Manage** 애플리케이션을 **Java Spring Framework (Spring Boot) + Oracle Database 19c** 환경으로 마이그레이션하기 위한 가이드입니다.

---

## 1. 아키텍처 개요

### AS-IS (현재)
*   **Frontend**: HTML, CSS, Vanilla JS
*   **Backend**: Node.js (Express)
*   **Database**: JSON Files (`data/defects.json`, `data/users.json`)

### TO-BE (목표)
*   **Frontend**: 기존 코드 재사용 (HTML/CSS/JS) 하거나 Thymeleaf 등으로 변환
*   **Backend**: Java 17+, Spring Boot 3.x
*   **Database**: Oracle Database 19c
*   **ORM**: JPA (Hibernate) 또는 MyBatis

---

## 2. 데이터베이스 설계 (Oracle 19c)

기존 JSON 구조를 기반으로 Oracle 테이블을 생성합니다.

### 2.1. 사용자 테이블 (USERS)

```sql
CREATE TABLE USERS (
    USER_ID NUMBER PRIMARY KEY,
    NAME VARCHAR2(100) NOT NULL,
    DEPARTMENT VARCHAR2(100),
    EMAIL VARCHAR2(200),
    ROLE VARCHAR2(50), -- 테스트, 테스터, 조치자, 관리자
    STATUS VARCHAR2(20) DEFAULT '사용',
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auto Increment를 위한 시퀀스 (선택 사항, IDENTITY 컬럼 사용 가능)
CREATE SEQUENCE USER_SEQ START WITH 1 INCREMENT BY 1;
```

### 2.2. 결함 테이블 (DEFECTS)

```sql
CREATE TABLE DEFECTS (
    DEFECT_ID NUMBER PRIMARY KEY,
    TITLE VARCHAR2(300) NOT NULL,
    DEFECT_TYPE VARCHAR2(50), -- 단위테스트, 통합테스트
    SEVERITY VARCHAR2(50), -- Critical, Major, Minor, Simple
    PRIORITY VARCHAR2(50), -- P1, P2, P3, P4
    STATUS VARCHAR2(50), -- New, Open, In Progress, Resolved...
    STEPS_TO_REPRO CLOB, -- 긴 텍스트
    MENU_NAME VARCHAR2(200),
    SCREEN_NAME VARCHAR2(200),
    SCREEN_URL VARCHAR2(500),
    ENV_INFO VARCHAR2(500),
    SCREENSHOT CLOB, -- Base64 이미지 데이터 (용량이 크면 BLOB 권장)
    CREATOR_ID NUMBER,
    ASSIGNEE_ID NUMBER,
    CREATOR_NAME VARCHAR2(100), -- 역정규화 (선택)
    ASSIGNEE_NAME VARCHAR2(100), -- 역정규화 (선택)
    ACTION_COMMENT CLOB,
    ACTION_START DATE,
    ACTION_END DATE,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE DEFECT_SEQ START WITH 1 INCREMENT BY 1;
```

---

## 3. Spring Boot 프로젝트 구성

### 3.1. 의존성 (pom.xml / build.gradle)
다음 라이브러리들을 포함해야 합니다.
*   `spring-boot-starter-web`: REST API 구축
*   `spring-boot-starter-data-jpa`: DB 접근 (또는 `mybatis-spring-boot-starter`)
*   `com.oracle.database.jdbc:ojdbc8`: Oracle JDBC 드라이버
*   `org.projectlombok:lombok`: 코드 간소화

### 3.2. application.yml 설정

```yaml
spring:
  datasource:
    url: jdbc:oracle:thin:@localhost:1521:ORCL # DB 접속 정보 수정 필요
    username: defect_user
    password: password
    driver-class-name: oracle.jdbc.OracleDriver
  jpa:
    hibernate:
      ddl-auto: update # 초기 개발 시 사용, 운영 시 none 또는 validate
    show-sql: true
    properties:
      hibernate:
        dialect: org.hibernate.dialect.OracleDialect
```

---

## 4. Backend 구현 단계

### 4.1. Entity 클래스 생성
`Defect.java`, `User.java` 엔티티 클래스를 생성하고 테이블과 매핑합니다.

```java
@Entity
@Table(name = "DEFECTS")
@Getter @Setter
public class Defect {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "defect_seq_gen")
    @SequenceGenerator(name = "defect_seq_gen", sequenceName = "DEFECT_SEQ", allocationSize = 1)
    private Long defectId;

    private String title;
    // ... 나머지 필드 정의
    
    @Lob // CLOB 매핑
    private String screenshot;
}
```

### 4.2. Repository 인터페이스 생성
`JpaRepository`를 상속받아 CRUD 기능을 구현합니다.

```java
public interface DefectRepository extends JpaRepository<Defect, Long> {
    // 필요한 경우 커스텀 쿼리 메서드 추가
}
```

### 4.3. Service & Controller 구현
기존 `server.js`의 라우팅 로직을 Spring Controller로 이관합니다.

*   `GET /api/defects` -> `DefectController.getAllDefects()`
*   `POST /api/defects` -> `DefectController.createDefect()`
*   `PUT /api/defects/{id}` -> `DefectController.updateDefect()`
*   ...

**주의사항**:
*   기존 Frontend가 `/api/...` 형태의 REST API를 호출하므로, **URL 경로와 응답 JSON 구조( camelCase 등)를 기존과 동일하게 유지**하면 Frontend 수정 없이 백엔드만 교체할 수 있습니다.
*   CORS 설정을 추가하여 Frontend(만약 분리 배포 시)에서의 접근을 허용해야 합니다.

```java
@RestController
@RequestMapping("/api/defects")
@CrossOrigin(origins = "*") // 개발 환경용
public class DefectController {
    // ... Service 주입 및 메서드 구현
}
```

---

## 5. Frontend 연동

### 방법 A: 정적 리소스 포함 (추천)
기존 `public/` 폴더 내의 HTML, CSS, JS 파일들을 Spring Boot 프로젝트의 `src/main/resources/static/` 폴더로 복사합니다.
*   Spring Boot는 기본적으로 이 경로의 정적 컨텐츠를 서빙합니다.
*   `http://localhost:8080/index.html`로 접속 가능합니다.

### 방법 B: 별도 배포
Frontend를 Nginx나 Apache 웹 서버에 배포하고, API 호출 주소만 Spring Boot 서버로 변경합니다.

---

## 6. 마이그레이션 체크리스트

1.  [ ] Oracle DB 스키마 생성 및 계정 설정
2.  [ ] Spring Boot 프로젝트 생성 및 설정
3.  [ ] API 스펙 일치 확인 (Request/Response JSON 필드명)
4.  [ ] 기존 `defects.json`, `users.json` 데이터를 Oracle DB로 이관 (마이그레이션 스크립트 작성 필요)
5.  [ ] 날짜 포맷 확인 (JS의 ISO String <-> Java `LocalDateTime`/Oracle `TIMESTAMP` 호환성)
6.  [ ] 파일 업로드 처리 (현재 Base64 문자열로 처리 중, 용량이 크다면 별도 파일 서버나 DB BLOB 고려)

이 가이드를 따라 진행하시면 기존 기능을 유지하면서 안정적인 엔터프라이즈 환경으로 전환하실 수 있습니다.
