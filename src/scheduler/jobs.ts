import cron from 'node-cron';
import { toZonedTime } from 'date-fns-tz';
import { bot } from '../bot/bot.js';
import * as userService from '../services/user.service.js';
import { generateDigest } from '../services/digest.service.js';
import { shouldSendProgressReminder, generateProgressReminder } from '../services/reminder.service.js';

/**
 * Scheduler module for periodic tasks.
 * Handles digest notifications and progress reminders.
 */

/**
 * Track sent notifications to prevent duplicates within the same hour.
 * Key format: "userId:type:hour"
 */
const sentNotifications = new Map<string, number>();

/**
 * Check if notification was already sent this hour.
 */
function wasSentThisHour(
  userId: string,
  type: 'digest' | 'reminder',
  currentHour: number
): boolean {
  const key = `${userId}:${type}:${currentHour}`;
  return sentNotifications.has(key);
}

/**
 * Mark notification as sent for this hour.
 */
function markAsSent(
  userId: string,
  type: 'digest' | 'reminder',
  currentHour: number
): void {
  const key = `${userId}:${type}:${currentHour}`;
  sentNotifications.set(key, Date.now());

  // Clean up old entries (older than 2 hours)
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [k, timestamp] of sentNotifications.entries()) {
    if (timestamp < twoHoursAgo) {
      sentNotifications.delete(k);
    }
  }
}

/**
 * Send a message to a user.
 */
async function sendMessage(
  telegramId: bigint,
  message: string,
  type: 'digest' | 'reminder'
): Promise<void> {
  try {
    await bot.api.sendMessage(Number(telegramId), message, { parse_mode: 'Markdown' });
    console.log(`${type} sent to user ${telegramId}`);
  } catch (error) {
    console.error(`Failed to send ${type} to ${telegramId}:`, error);
  }
}

/**
 * Process digest notifications for all users.
 * Digests are always sent at configured times.
 */
async function processDigests(): Promise<void> {
  console.log('Processing digests...');

  try {
    const users = await userService.getUsersForDigest();

    for (const user of users) {
      const digestTimes = userService.parseDigestTimes(user.digestTimes);
      if (digestTimes.length === 0) continue;

      // Get current time in user's timezone
      const now = new Date();
      const zonedNow = toZonedTime(now, user.timezone);
      const currentHour = zonedNow.getHours();
      const currentMinute = zonedNow.getMinutes();

      // Check if current time matches any of the digest times
      for (const digestTime of digestTimes) {
        const [digestHour, digestMinute] = digestTime.split(':').map(Number);

        // Send if current time is within 5 minutes of the configured time
        // This accounts for cron execution delays
        if (
          currentHour === digestHour &&
          currentMinute >= digestMinute &&
          currentMinute < digestMinute + 5
        ) {
          // Check if already sent this hour
          if (!wasSentThisHour(user.id, 'digest', currentHour)) {
            const digest = await generateDigest(user);
            await sendMessage(user.telegramId, digest, 'digest');
            markAsSent(user.id, 'digest', currentHour);
          }
          break; // Only send once per hour even if multiple times configured
        }
      }
    }
  } catch (error) {
    console.error('Error processing digests:', error);
  }
}

/**
 * Process progress reminders for all users.
 * Only sends if user hasn't logged progress today.
 */
async function processProgressReminders(): Promise<void> {
  console.log('Processing progress reminders...');

  try {
    const users = await userService.getUsersForProgressReminder();

    for (const user of users) {
      if (!user.progressReminderTime) continue;

      // Get current time in user's timezone
      const now = new Date();
      const zonedNow = toZonedTime(now, user.timezone);
      const currentHour = zonedNow.getHours();
      const currentMinute = zonedNow.getMinutes();

      // Parse user's reminder time
      const [reminderHour, reminderMinute] = user.progressReminderTime.split(':').map(Number);

      // Send if current time is within 5 minutes of the configured time
      // This accounts for cron execution delays
      if (
        currentHour === reminderHour &&
        currentMinute >= reminderMinute &&
        currentMinute < reminderMinute + 5
      ) {
        // Check if already sent this hour
        if (!wasSentThisHour(user.id, 'reminder', currentHour)) {
          // Only send if user hasn't logged progress today
          const shouldSend = await shouldSendProgressReminder(user);

          if (shouldSend) {
            const reminder = await generateProgressReminder(user);
            await sendMessage(user.telegramId, reminder, 'reminder');
            markAsSent(user.id, 'reminder', currentHour);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error processing progress reminders:', error);
  }
}

/**
 * Start all scheduled jobs.
 */
export function startScheduler(): void {
  console.log('Starting scheduler...');

  // Run checks every 5 minutes
  // Cron: "*/5 * * * *" = every 5 minutes
  // This allows notifications to be sent at any HH:mm time configured by users
  cron.schedule('*/5 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running notification checks...`);
    await Promise.all([processDigests(), processProgressReminders()]);
  });

  console.log('Scheduler started. Jobs will run every 5 minutes.');
}

/**
 * Manually trigger notifications processing (for testing).
 */
export async function runManualCheck(): Promise<void> {
  console.log('Running manual notification check...');
  await Promise.all([processDigests(), processProgressReminders()]);
  console.log('Manual check complete.');
}
