import cron from 'node-cron';
import { InlineKeyboard } from 'grammy';
import { toZonedTime } from 'date-fns-tz';
import { bot } from '../bot/bot.js';
import * as userService from '../services/user.service.js';
import * as planService from '../services/daily-plan.service.js';
import { MAX_TASKS_PER_DAY, TASK_STATUSES } from '../services/task.service.js';

type NotificationType =
  | 'morning_plan'
  | 'daily_reminder'
  | 'evening_review'
  | 'morning_review_fallback';

/**
 * Dedup map: userId:type:slot -> timestamp
 */
const sentNotifications = new Map<string, number>();

function buildDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTime(time: string): { hour: number; minute: number } | null {
  const parts = time.split(':');
  if (parts.length !== 2) return null;

  const hour = Number(parts[0]);
  const minute = Number(parts[1]);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
}

/**
 * True if local time is inside [target, target + 6 min) window.
 * +6 keeps reliability if job executes at +5 minute boundary after restart jitter.
 */
function isTimeMatch(zonedNow: Date, target: string): boolean {
  const parsed = parseTime(target);
  if (!parsed) return false;

  const currentMinutes = zonedNow.getHours() * 60 + zonedNow.getMinutes();
  const targetMinutes = parsed.hour * 60 + parsed.minute;

  return currentMinutes >= targetMinutes && currentMinutes < targetMinutes + 6;
}

function wasSent(userId: string, type: NotificationType, slot: string): boolean {
  const key = `${userId}:${type}:${slot}`;
  return sentNotifications.has(key);
}

function markSent(userId: string, type: NotificationType, slot: string): void {
  const key = `${userId}:${type}:${slot}`;
  sentNotifications.set(key, Date.now());

  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  for (const [k, timestamp] of sentNotifications.entries()) {
    if (timestamp < cutoff) {
      sentNotifications.delete(k);
    }
  }
}

async function sendMessage(
  telegramId: bigint,
  message: string,
  keyboard?: InlineKeyboard
): Promise<void> {
  try {
    await bot.api.sendMessage(Number(telegramId), message, {
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error(`Failed to send scheduled message to ${telegramId}:`, error);
  }
}

async function processMorningPlanPrompts(): Promise<void> {
  const users = await userService.getOnboardedUsers();

  for (const user of users) {
    try {
      if (!user.morningPlanTime) continue;

      const zonedNow = toZonedTime(new Date(), user.timezone);
      if (!isTimeMatch(zonedNow, user.morningPlanTime)) continue;

      const slot = `${buildDateKey(zonedNow)}:${user.morningPlanTime}`;
      if (wasSent(user.id, 'morning_plan', slot)) continue;

      const todayPlan = await planService.getTodayPlan(user.id, user.timezone);
      if (
        todayPlan &&
        todayPlan.status !== planService.PLAN_STATUSES.DRAFT
      ) {
        markSent(user.id, 'morning_plan', slot);
        continue;
      }

      // Morning fallback: if yesterday review was skipped, remind first.
      const yesterdayPlan = await planService.getYesterdayPlan(
        user.id,
        user.timezone
      );
      if (
        yesterdayPlan &&
        yesterdayPlan.status !== planService.PLAN_STATUSES.REVIEWED &&
        yesterdayPlan.status !== planService.PLAN_STATUSES.DRAFT
      ) {
        if (!wasSent(user.id, 'morning_review_fallback', slot)) {
          const fallbackMsg =
            user.language === 'ru'
              ? 'Вчерашняя подбивка не завершена. Хочешь быстро подвести итоги вчерашнего дня?'
              : "Yesterday's review was missed. Do you want to quickly review yesterday now?";

          await sendMessage(
            user.telegramId,
            fallbackMsg,
            new InlineKeyboard().text(
              user.language === 'ru'
                ? '🌙 Подбить вчера'
                : '🌙 Review yesterday',
              'review:start:yesterday'
            )
          );
          markSent(user.id, 'morning_review_fallback', slot);
        }
      }

      const morningMsg =
        user.language === 'ru'
          ? `☀️ Доброе утро! Давай составим план на сегодня (до ${MAX_TASKS_PER_DAY} задач).`
          : `☀️ Good morning! Let's create today's plan (up to ${MAX_TASKS_PER_DAY} tasks).`;

      await sendMessage(
        user.telegramId,
        morningMsg,
        new InlineKeyboard().text(
          user.language === 'ru' ? '🗓 Составить план' : '🗓 Plan today',
          'plan:start'
        )
      );

      markSent(user.id, 'morning_plan', slot);
    } catch (error) {
      console.error(`Morning reminder failed for user ${user.id}:`, error);
    }
  }
}

async function processDailyTaskReminders(): Promise<void> {
  const users = await userService.getOnboardedUsers();

  for (const user of users) {
    try {
      const reminderTimes = userService.getUserDailyReminderTimes(user);
      if (reminderTimes.length === 0) continue;

      const zonedNow = toZonedTime(new Date(), user.timezone);
      const dateKey = buildDateKey(zonedNow);

      for (const reminderTime of reminderTimes) {
        if (!isTimeMatch(zonedNow, reminderTime)) continue;

        const slot = `${dateKey}:${reminderTime}`;
        if (wasSent(user.id, 'daily_reminder', slot)) continue;

        const todayPlan = await planService.getTodayPlan(user.id, user.timezone);
        if (
          !todayPlan ||
          todayPlan.status === planService.PLAN_STATUSES.DRAFT ||
          todayPlan.tasks.length === 0
        ) {
          markSent(user.id, 'daily_reminder', slot);
          continue;
        }

        const remaining = todayPlan.tasks.filter(
          (task) =>
            task.status !== TASK_STATUSES.DONE &&
            task.status !== TASK_STATUSES.SKIPPED
        );

        const reminderMessage =
          user.language === 'ru'
            ? remaining.length > 0
              ? `📌 Напоминание о задачах: осталось ${remaining.length}.\n\n${remaining
                  .slice(0, 3)
                  .map((task, index) => `${index + 1}. ${task.text}`)
                  .join('\n')}`
              : '📌 Напоминание: по плану на сегодня уже всё закрыто. Отлично!'
            : remaining.length > 0
              ? `📌 Task reminder: ${remaining.length} remaining.\n\n${remaining
                  .slice(0, 3)
                  .map((task, index) => `${index + 1}. ${task.text}`)
                  .join('\n')}`
              : '📌 Reminder: your plan for today is already completed. Great job!';

        await sendMessage(
          user.telegramId,
          reminderMessage,
          new InlineKeyboard()
            .text(user.language === 'ru' ? '📋 Открыть план' : '📋 Open plan', 'plan:start')
            .text(
              user.language === 'ru' ? '🌙 Подбивка' : '🌙 Review',
              'review:start:today'
            )
        );

        markSent(user.id, 'daily_reminder', slot);
      }
    } catch (error) {
      console.error(`Day reminder failed for user ${user.id}:`, error);
    }
  }
}

async function processEveningReviewPrompts(): Promise<void> {
  const users = await userService.getOnboardedUsers();

  for (const user of users) {
    try {
      if (!user.eveningReviewTime) continue;

      const zonedNow = toZonedTime(new Date(), user.timezone);
      if (!isTimeMatch(zonedNow, user.eveningReviewTime)) continue;

      const slot = `${buildDateKey(zonedNow)}:${user.eveningReviewTime}`;
      if (wasSent(user.id, 'evening_review', slot)) continue;

      const todayPlan = await planService.getTodayPlan(user.id, user.timezone);
      if (
        !todayPlan ||
        todayPlan.status === planService.PLAN_STATUSES.DRAFT ||
        todayPlan.status === planService.PLAN_STATUSES.REVIEWED ||
        todayPlan.tasks.length === 0
      ) {
        markSent(user.id, 'evening_review', slot);
        continue;
      }

      const message =
        user.language === 'ru'
          ? '🌙 Время подвести итоги дня. Отметь статус задач.'
          : '🌙 Time for evening review. Mark statuses for today\'s tasks.';

      await sendMessage(
        user.telegramId,
        message,
        new InlineKeyboard()
          .text(
            user.language === 'ru' ? '✅ Начать подбивку' : '✅ Start review',
            'review:start:today'
          )
          .row()
          .text(
            user.language === 'ru' ? '🗓 Запланировать завтра' : '🗓 Plan tomorrow',
            'plan:start:tomorrow'
          )
      );

      markSent(user.id, 'evening_review', slot);
    } catch (error) {
      console.error(`Evening reminder failed for user ${user.id}:`, error);
    }
  }
}

/**
 * Start all scheduled jobs.
 */
export function startScheduler(): void {
  console.log('Starting scheduler...');

  // Every 5 minutes to support arbitrary HH:mm settings.
  cron.schedule('*/5 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running planning notifications...`);
    const results = await Promise.allSettled([
      processMorningPlanPrompts(),
      processDailyTaskReminders(),
      processEveningReviewPrompts(),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('Scheduler job failed:', result.reason);
      }
    }
  });

  console.log('Scheduler started. Jobs run every 5 minutes.');
}

/**
 * Manual check for debugging/testing.
 */
export async function runManualCheck(): Promise<void> {
  console.log('Running manual planning notification check...');
  const results = await Promise.allSettled([
    processMorningPlanPrompts(),
    processDailyTaskReminders(),
    processEveningReviewPrompts(),
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Manual scheduler check failed:', result.reason);
    }
  }

  console.log('Manual check complete.');
}
