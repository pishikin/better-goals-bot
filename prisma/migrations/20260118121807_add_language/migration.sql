-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegram_id" BIGINT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "digest_times" TEXT,
    "progress_reminder_time" TEXT,
    "pinned_message_id" BIGINT,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_users" ("created_at", "digest_times", "id", "onboarding_completed", "pinned_message_id", "progress_reminder_time", "telegram_id", "timezone", "updated_at") SELECT "created_at", "digest_times", "id", "onboarding_completed", "pinned_message_id", "progress_reminder_time", "telegram_id", "timezone", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
