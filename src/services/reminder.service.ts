import type { User } from '@prisma/client';
import { hasProgressToday } from './progress.service.js';
import { getUserAreas } from './areas.service.js';
import { calculateStreak } from './statistics.service.js';

/**
 * Reminder service handles progress reminder generation.
 * Progress reminders are only sent if user hasn't logged progress today.
 */

/**
 * Check if a user should receive a progress reminder.
 * Returns false if they've already logged progress today (including check-ins).
 */
export async function shouldSendProgressReminder(user: User): Promise<boolean> {
  // Don't remind if user hasn't completed onboarding
  if (!user.onboardingCompleted) {
    return false;
  }

  // Don't remind if user has no areas
  const areas = await getUserAreas(user.id);
  if (areas.length === 0) {
    return false;
  }

  // Don't remind if they've already logged progress today
  const hasProgress = await hasProgressToday(user.id, user.timezone);
  return !hasProgress;
}

/**
 * Generate the progress reminder message.
 * Simple reminder to log progress.
 */
export async function generateProgressReminder(user: User): Promise<string> {
  const currentStreak = await calculateStreak(user.id, user.timezone);

  const lines: string[] = ['📝 *Don\'t forget to log your progress!*', ''];

  // Add streak-based motivation
  if (currentStreak > 0) {
    lines.push(`You're on a ${currentStreak} day streak! 🔥`);
    lines.push("Keep it going — take a moment to log today's progress.");
  } else {
    lines.push('How was your day? Take a moment to reflect and log your progress.');
    lines.push('Every step counts!');
  }

  lines.push('');
  lines.push('Use /progress to log your day.');

  return lines.join('\n');
}

/**
 * Generate a streak-at-risk warning message.
 * Used for users who haven't logged progress and have an active streak.
 */
export async function generateStreakWarning(user: User): Promise<string | null> {
  const currentStreak = await calculateStreak(user.id, user.timezone);

  // Only warn if there's a streak to protect
  if (currentStreak < 3) {
    return null;
  }

  const hasProgress = await hasProgressToday(user.id, user.timezone);
  if (hasProgress) {
    return null;
  }

  return [
    `⚠️ *Streak Alert*`,
    '',
    `Your ${currentStreak} day streak is at risk!`,
    '',
    'Log at least one area to keep it going.',
    '',
    '/progress',
  ].join('\n');
}

// Keep old function names for backward compatibility
export const shouldSendReminder = shouldSendProgressReminder;
export const generateEveningReminder = generateProgressReminder;
