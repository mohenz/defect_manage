
-- 1. Update Defects Status
UPDATE defects
SET status = 'Open'
WHERE status = 'New';

UPDATE defects
SET status = 'Verified' -- This status is removed
WHERE status = 'Verified' -- Should be 'Resolved' or 'Closed' depending on workflow?
-- Wait, the user said "Verified is deleted" and didn't specify what to replace it with for existing data.
-- Usually Verified -> Closed or Resolved. Let's assume Resolved or keep as is and let manual fix?
-- The request was: "new, verified은 삭제하고 신규 등록되는 결함의 초기 상태값은 open으로 변경해줘. 현재 new 상태인 값은 open으로 업데이트해줘."
-- Verified mapping was not explicitly requested for existing data, but it's "deleted" from the system.
-- To be safe, let's map Verified to Resolved or Closed. Let's start with New -> Open as requested.

-- 2. Check for any other statuses that might need cleanup?
-- Just New -> Open for now as explicitly requested.

COMMIT;
