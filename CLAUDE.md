# Better Goals App - Claude Code Instructions

## Project Overview

Lightweight Telegram bot for personal tracking of key life areas (max 7). Built with Node.js, TypeScript, Grammy, and Prisma.

**Philosophy:** Less is more. Simple tool for maintaining focus, not a complex task manager.

## Tech Stack

- **Runtime:** Node.js 20 LTS
- **Language:** TypeScript 5+ (strict mode, no `any`)
- **Bot Framework:** Grammy 1.21+ with Conversations plugin
- **ORM:** Prisma 5+ (SQLite for MVP, PostgreSQL-ready)
- **Scheduler:** node-cron
- **Validation:** zod
- **Logging:** pino
- **Date/Time:** date-fns, date-fns-tz

## Project Structure

```
better-goals-app/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── bot/
│   │   ├── bot.ts                  # Grammy bot initialization
│   │   ├── conversations/          # Grammy conversations (wizard flows)
│   │   │   ├── onboarding.ts
│   │   │   ├── add-area.ts
│   │   │   └── log-progress.ts
│   │   ├── handlers/
│   │   │   ├── start.handler.ts
│   │   │   ├── areas.handler.ts
│   │   │   ├── progress.handler.ts
│   │   │   ├── summary.handler.ts
│   │   │   └── settings.handler.ts
│   │   ├── keyboards/
│   │   │   ├── main-menu.keyboard.ts
│   │   │   ├── areas.keyboard.ts
│   │   │   └── settings.keyboard.ts
│   │   ├── middleware/
│   │   │   ├── error-handler.ts
│   │   │   └── logger.ts
│   │   └── utils/
│   │       ├── message-formatter.ts
│   │       └── validators.ts
│   ├── services/
│   │   ├── user.service.ts
│   │   ├── areas.service.ts
│   │   ├── progress.service.ts
│   │   ├── statistics.service.ts
│   │   ├── digest.service.ts
│   │   ├── reminder.service.ts
│   │   └── prompt.service.ts
│   ├── scheduler/
│   │   └── jobs.ts
│   ├── types/
│   │   └── index.ts
│   ├── config/
│   │   └── env.ts                  # Zod-validated env config
│   ├── db/
│   │   └── client.ts               # Prisma client singleton
│   └── index.ts                    # Entry point
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Database Schema

```prisma
model User {
  id                  String   @id @default(cuid())
  telegramId          BigInt   @unique @map("telegram_id")
  timezone            String   @default("UTC")
  morningDigestTime   String?  @map("morning_digest_time")  // HH:mm
  eveningReminderTime String?  @map("evening_reminder_time") // HH:mm
  pinnedMessageId     BigInt?  @map("pinned_message_id")
  onboardingCompleted Boolean  @default(false) @map("onboarding_completed")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  areas           Area[]
  progressEntries ProgressEntry[]

  @@map("users")
}

model Area {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String   // max 50 chars (validate in code)
  body      String?  // max 200 chars
  emoji     String?
  position  Int      // creation order, no reorder in MVP
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  progressEntries ProgressEntry[]

  @@map("areas")
}

model ProgressEntry {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  areaId    String   @map("area_id")
  area      Area     @relation(fields: [areaId], references: [id], onDelete: Cascade)
  content   String   // max 200 chars
  date      DateTime @map("date")
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([userId, areaId, date])
  @@map("progress_entries")
}
```

## Key Implementation Rules

### Conversation Flows (Grammy Conversations Plugin)

Use `@grammyjs/conversations` for multi-step flows:
- **Onboarding:** Welcome → Add areas → Set timezone → Set reminder times → Pin message
- **Add Area:** Ask title → Ask body (optional) → Ask emoji (optional) → Save
- **Log Progress:** Iterate areas → For each: show area → wait for text or skip → Save all at end

If bot restarts during conversation, user starts flow from beginning (no persistence needed).

### Validation Rules

| Field | Max Length | Required |
|-------|------------|----------|
| Area title | 50 chars | Yes |
| Area body | 200 chars | No |
| Progress entry | 200 chars | Yes |
| Max areas per user | 7 | - |

Use zod schemas for all input validation.

### Date/Time Handling

- Store times in `HH:mm` format (string)
- Store timezone as IANA string (e.g., `Europe/Moscow`)
- Use `date-fns-tz` for timezone conversions
- Progress logging date = date when user started the logging session
- Scheduler runs hourly, checks which users should receive digest/reminder

### Timezone Selection

Ask during onboarding with inline keyboard:
- Europe/Moscow (MSK)
- Europe/London (GMT)
- America/New_York (EST)
- Asia/Tokyo (JST)
- UTC
- "Other" → text input for IANA timezone

### Area Deletion

**Hard delete** with cascade. Show warning:
```
Delete "Work"?

⚠️ All progress history for this area will be permanently deleted.

[Yes, delete] [Cancel]
```

### Progress Logging Flow

1. User clicks "Log Progress" or `/progress`
2. Get all areas, check which don't have today's entry
3. For each area without entry:
   - Show: `1/5 💼 Work\n→ Frontend dev\n\nWhat did you accomplish?\n[Skip] [Cancel All]`
   - Wait for text (save to temp) or button
4. After all areas processed OR Cancel All:
   - Save all collected entries in one transaction
   - Update pinned message
   - Show summary with streak

**Cancel All:** Discards current session entries, already-saved entries from previous sessions remain.

### Pinned Message

Format:
```
🎯 YOUR FOCUS AREAS

1. 💼 Work
   → Frontend dev and team management

2. 🏃 Health
   → Gym 3x/week, 8h sleep

3. 📚 Learning
   → TypeScript deep dive

---
🔥 5 days | Last: Today 21:43

[📝 Log Progress] [➕ Add] [✏️ Edit] [⚙️ Settings]
```

Update pinned message only after completing entire flow (not after each action).

### Statistics

- **Streak:** Consecutive days with at least 1 progress entry
- **Skip ≠ Entry:** Skipping area doesn't count as entry, doesn't affect streak
- **Weekly activity:** Count of days with ≥1 entry in last 7 days

### AI Prompt Generation

Generate copyable English prompt with:
- List of areas with descriptions
- Progress entries grouped by area and date
- Statistics summary
- Analysis questions

No AI API integration - user copies prompt to ChatGPT/Claude manually.

## Code Style

- All code comments in English
- README and docs in English
- Use explicit types, never `any`
- Prefer `interface` for object shapes, `type` for unions
- Use async/await, handle errors with try-catch
- Service layer handles business logic, handlers are thin
- One file = one responsibility

## Environment Variables

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token

# Database
DATABASE_URL="file:./data/app.db"

# Optional
NODE_ENV=development
DEFAULT_TIMEZONE=UTC
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `/start` | Start bot, show onboarding or main menu |
| `/areas` | Manage focus areas |
| `/progress` | Log daily progress |
| `/summary` | Generate AI analysis prompt |
| `/settings` | Configure reminders and timezone |
| `/help` | Show help message |

## Testing Notes (for manual testing)

1. Full onboarding flow
2. Add/Edit/Delete areas (test max 7 limit)
3. Log progress for all areas
4. Skip some areas during logging
5. Cancel All during logging (verify partial entries discarded)
6. Verify streak calculation
7. Verify morning digest sends at correct time
8. Verify evening reminder sends only if no progress today
9. Generate AI prompt for 7 days
10. Change timezone and verify reminders adjust

## Documentation Files

- `.claude/project_vision.md` - Product philosophy and roadmap
- `.claude/technical_spec.md` - Formal requirements (FR/NFR)
- `.claude/development_checklist.md` - Step-by-step implementation guide

## Quick Reference: What Changed from Original Docs

These changes were made after discussion and should override original documentation:

1. **No soft delete** - Areas are hard deleted with cascade
2. **No reorder** - Areas have fixed position based on creation order
3. **Added pinnedMessageId** - Store in User model
4. **Conversations plugin** - Use instead of manual session state
5. **Timezone** - Ask during onboarding with keyboard options
6. **Date boundary** - Progress date = session start date
7. **Skip behavior** - Skip doesn't create entry, doesn't affect streak
8. **Pinned message update** - Only after completing entire flow
9. **Cancel All** - Discards current session only
10. **Edit past progress** - Deferred to v1.1
