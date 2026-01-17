/*
  Warnings:

  - You are about to drop the column `evening_reminder_time` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `morning_digest_time` on the `users` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_progress_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "area_id" TEXT,
    "content" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "date" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "progress_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "progress_entries_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_progress_entries" ("area_id", "content", "created_at", "date", "id", "user_id") SELECT "area_id", "content", "created_at", "date", "id", "user_id" FROM "progress_entries";
DROP TABLE "progress_entries";
ALTER TABLE "new_progress_entries" RENAME TO "progress_entries";
CREATE UNIQUE INDEX "progress_entries_user_id_area_id_date_key" ON "progress_entries"("user_id", "area_id", "date");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegram_id" BIGINT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "digest_times" TEXT,
    "progress_reminder_time" TEXT,
    "pinned_message_id" BIGINT,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_users" ("created_at", "id", "onboarding_completed", "pinned_message_id", "telegram_id", "timezone", "updated_at") SELECT "created_at", "id", "onboarding_completed", "pinned_message_id", "telegram_id", "timezone", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
