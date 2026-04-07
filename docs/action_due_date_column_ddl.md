# 조치예정일 컬럼 추가 DDL

## 목적

- `defects` 테이블에 조치예정일을 저장하기 위한 `action_due_date` 컬럼을 추가합니다.
- 기존 컬럼 `action_start`, `action_end`와 같은 날짜 계열 규칙을 유지합니다.

## 권장 컬럼 정의

- 컬럼명: `action_due_date`
- 타입: `DATE`
- Nullable: `허용`
- 기본값: `없음`

## DDL

```sql
alter table public.defects
add column if not exists action_due_date date;

comment on column public.defects.action_due_date
is '조치예정일';
```

## 선택 인덱스

조치예정일 기준 조회나 정렬이 자주 발생하면 아래 인덱스를 추가합니다.

```sql
create index if not exists idx_defects_action_due_date
on public.defects (action_due_date);
```

상태와 조치예정일을 함께 조건으로 자주 조회하면 복합 인덱스를 고려할 수 있습니다.

```sql
create index if not exists idx_defects_status_action_due_date
on public.defects (status, action_due_date);
```

## 참고

- 현재 코드 기준 `defects`는 `action_start`, `action_end`를 이미 사용합니다.
- 따라서 새 컬럼은 `action_due_date`가 가장 일관된 명명입니다.
- Supabase 반영 후 애플리케이션에서는 목록 조회, 상세 조회, 저장 로직, 입력 UI를 함께 수정해야 합니다.
