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
        const [digestHour] = digestTime.split(':').map(Number);

        // Send within the first 5 minutes of the hour
        if (currentHour === digestHour && currentMinute < 5) {
          const digest = await generateDigest(user);
          await sendMessage(user.telegramId, digest, 'digest');
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
      const [reminderHour] = user.progressReminderTime.split(':').map(Number);

      // Send within the first 5 minutes of the hour
      if (currentHour === reminderHour && currentMinute < 5) {
        // Only send if user hasn't logged progress today
        const shouldSend = await shouldSendProgressReminder(user);

        if (shouldSend) {
          const reminder = await generateProgressReminder(user);
          await sendMessage(user.telegramId, reminder, 'reminder');
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

  // Run checks every hour at minute 0
  // Cron: "0 * * * *" = at minute 0 of every hour
  cron.schedule('0 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running hourly jobs...`);
    await Promise.all([processDigests(), processProgressReminders()]);
  });

  console.log('Scheduler started. Jobs will run at the start of each hour.');
}

/**
 * Manually trigger notifications processing (for testing).
 */
export async function runManualCheck(): Promise<void> {
  console.log('Running manual notification check...');
  await Promise.all([processDigests(), processProgressReminders()]);
  console.log('Manual check complete.');
}
