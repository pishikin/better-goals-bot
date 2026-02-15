-- Add new planning/settings fields to users
ALTER TABLE "users" ADD COLUMN "morning_plan_time" TEXT DEFAULT '09:00';
ALTER TABLE "users" ADD COLUMN "evening_review_time" TEXT DEFAULT '21:00';
ALTER TABLE "users" ADD COLUMN "daily_reminders_count" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "users" ADD COLUMN "daily_reminders_times" TEXT DEFAULT '["14:00"]';
ALTER TABLE "users" ADD COLUMN "task_area_linking_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "new_model_onboarding_shown_at" DATETIME;

-- Add archive flag to areas (future-proofing for focus management)
ALTER TABLE "areas" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- Create daily plans
CREATE TABLE "daily_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "source" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "confirmed_at" DATETIME,
    "review_started_at" DATETIME,
    "review_completed_at" DATETIME,
    CONSTRAINT "daily_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "daily_plans_user_id_date_key" ON "daily_plans"("user_id", "date");
CREATE INDEX "daily_plans_user_id_date_idx" ON "daily_plans"("user_id", "date");

-- Create tasks
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plan_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "area_id" TEXT,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "status_updated_at" DATETIME,
    "carried_from_task_id" TEXT,
    CONSTRAINT "tasks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "daily_plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_carried_from_task_id_fkey" FOREIGN KEY ("carried_from_task_id") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "tasks_plan_id_position_key" ON "tasks"("plan_id", "position");
CREATE INDEX "tasks_user_id_status_idx" ON "tasks"("user_id", "status");
CREATE INDEX "tasks_plan_id_position_idx" ON "tasks"("plan_id", "position");
