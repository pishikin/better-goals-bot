-- Backfill new reminder fields from legacy settings for existing users.
-- 1) Copy digest_times -> daily_reminders_times/count when digest_times exists.
UPDATE "users"
SET
  "daily_reminders_times" = "digest_times",
  "daily_reminders_count" = CASE
    WHEN json_valid("digest_times") THEN COALESCE(json_array_length("digest_times"), 1)
    ELSE 1
  END
WHERE "digest_times" IS NOT NULL;

-- 2) Copy progress_reminder_time -> evening_review_time when set.
UPDATE "users"
SET "evening_review_time" = "progress_reminder_time"
WHERE "progress_reminder_time" IS NOT NULL;
