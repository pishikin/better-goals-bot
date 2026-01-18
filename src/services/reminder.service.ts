import type { User } from '@prisma/client';
import { hasProgressToday } from './progress.service.js';
import { getUserAreas } from './areas.service.js';
import { calculateStreak } from './statistics.service.js';
import type { Language } from '../locales/index.js';

/**
 * Reminder service handles progress reminder generation.
 * Progress reminders are only sent if user hasn't logged progress today.
 */

/**
 * Get localized text based on language.
 */
function t(key: string, lang: Language): string {
  const translations: Record<string, Record<Language, string>> = {
    'reminder-title': {
      en: "📝 *Don't forget to log your progress!*",
      ru: '📝 *Не забудьте записать свой прогресс!*',
    },
    'reminder-streak': {
      en: "Keep it going — take a moment to log today's progress.",
      ru: 'Продолжайте — уделите минутку, чтобы записать прогресс.',
    },
    'reminder-no-streak': {
      en: 'How was your day? Take a moment to reflect and log your progress.',
      ru: 'Как прошёл ваш день? Уделите минутку, чтобы записать прогресс.',
    },
    'reminder-every-step': {
      en: 'Every step counts!',
      ru: 'Каждый шаг важен!',
    },
    'reminder-cta': {
      en: 'Use /progress to log your day.',
      ru: 'Используйте /progress чтобы записать день.',
    },
    'streak-alert': {
      en: '⚠️ *Streak Alert*',
      ru: '⚠️ *Внимание: серия под угрозой*',
    },
    'streak-at-risk': {
      en: 'day streak is at risk!',
      ru: 'под угрозой!',
    },
    'streak-log-to-keep': {
      en: 'Log at least one area to keep it going.',
      ru: 'Запишите хотя бы одну область, чтобы сохранить серию.',
    },
  };

  return translations[key]?.[lang] ?? translations[key]?.en ?? key;
}

/**
 * Get pluralized days string.
 */
function getDaysWord(count: number, lang: Language): string {
  if (lang === 'ru') {
    if (count % 10 === 1 && count % 100 !== 11) return 'день';
    if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return 'дня';
    return 'дней';
  }
  return count === 1 ? 'day' : 'days';
}

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
  const lang = (user.language || 'en') as Language;
  const currentStreak = await calculateStreak(user.id, user.timezone);

  const lines: string[] = [t('reminder-title', lang), ''];

  // Add streak-based motivation
  if (currentStreak > 0) {
    const daysWord = getDaysWord(currentStreak, lang);
    if (lang === 'ru') {
      lines.push(`Вы на серии в ${currentStreak} ${daysWord}! 🔥`);
    } else {
      lines.push(`You're on a ${currentStreak} ${daysWord} streak! 🔥`);
    }
    lines.push(t('reminder-streak', lang));
  } else {
    lines.push(t('reminder-no-streak', lang));
    lines.push(t('reminder-every-step', lang));
  }

  lines.push('');
  lines.push(t('reminder-cta', lang));

  return lines.join('\n');
}

/**
 * Generate a streak-at-risk warning message.
 * Used for users who haven't logged progress and have an active streak.
 */
export async function generateStreakWarning(user: User): Promise<string | null> {
  const lang = (user.language || 'en') as Language;
  const currentStreak = await calculateStreak(user.id, user.timezone);

  // Only warn if there's a streak to protect
  if (currentStreak < 3) {
    return null;
  }

  const hasProgress = await hasProgressToday(user.id, user.timezone);
  if (hasProgress) {
    return null;
  }

  const daysWord = getDaysWord(currentStreak, lang);

  if (lang === 'ru') {
    return [
      t('streak-alert', lang),
      '',
      `Ваша серия в ${currentStreak} ${daysWord} ${t('streak-at-risk', lang)}`,
      '',
      t('streak-log-to-keep', lang),
      '',
      '/progress',
    ].join('\n');
  }

  return [
    t('streak-alert', lang),
    '',
    `Your ${currentStreak} ${daysWord} ${t('streak-at-risk', lang)}`,
    '',
    t('streak-log-to-keep', lang),
    '',
    '/progress',
  ].join('\n');
}

// Keep old function names for backward compatibility
export const shouldSendReminder = shouldSendProgressReminder;
export const generateEveningReminder = generateProgressReminder;
