import type { User, Area } from '@prisma/client';
import { getUserAreas } from './areas.service.js';
import { getUserStatistics, getLastProgressDate } from './statistics.service.js';
import { toZonedTime } from 'date-fns-tz';
import { formatDateTime } from '../bot/utils/date-formatter.js';
import type { Language } from '../locales/index.js';

/**
 * Digest service handles digest (goals overview) generation.
 * Digests are always sent at configured times to help users stay focused.
 */

/**
 * Format an area for display in the digest.
 */
function formatArea(area: Area, index: number): string {
  const emoji = area.emoji ?? '•';
  const body = area.body ? `\n   → ${area.body}` : '';
  return `${index + 1}. ${emoji} ${area.title}${body}`;
}

/**
 * Get localized text based on language.
 */
function t(key: string, lang: Language): string {
  const translations: Record<string, Record<Language, string>> = {
    'digest-review': {
      en: "📋 *It's time to review your goals*",
      ru: '📋 *Время пересмотреть ваши цели*',
    },
    'digest-areas-title': {
      en: '🎯 *Your Focus Areas*',
      ru: '🎯 *Ваши области фокуса*',
    },
    'digest-no-areas': {
      en: '_No areas defined yet. Use /areas to add some!_',
      ru: '_Области ещё не определены. Используйте /areas чтобы добавить!_',
    },
    'digest-motivation': {
      en: 'Stay focused and make progress! 💪',
      ru: 'Оставайтесь сфокусированы и двигайтесь вперёд! 💪',
    },
    'greeting-morning': {
      en: '☀️ Good morning!',
      ru: '☀️ Доброе утро!',
    },
    'greeting-afternoon': {
      en: '🌤 Good afternoon!',
      ru: '🌤 Добрый день!',
    },
    'greeting-evening': {
      en: '🌙 Good evening!',
      ru: '🌙 Добрый вечер!',
    },
    'stats-streak': {
      en: '🔥 streak',
      ru: '🔥 подряд',
    },
    'stats-start': {
      en: '📊 Start your streak today!',
      ru: '📊 Начните свою серию сегодня!',
    },
    'stats-last': {
      en: 'Last',
      ru: 'Последнее',
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
 * Generate the digest message for a user.
 * Shows their focus areas and current statistics.
 * This is sent to remind users of their goals throughout the day.
 */
export async function generateDigest(user: User): Promise<string> {
  const lang = (user.language || 'en') as Language;
  const areas = await getUserAreas(user.id);
  const stats = await getUserStatistics(user.id, user.timezone);
  const lastProgressDate = await getLastProgressDate(user.id);

  // Get current time in user's timezone
  const now = new Date();
  const zonedNow = toZonedTime(now, user.timezone);
  const greeting = getTimeBasedGreeting(zonedNow.getHours(), lang);

  // Build the message
  const lines: string[] = [
    greeting,
    '',
    t('digest-review', lang),
    '',
    t('digest-areas-title', lang),
    '',
  ];

  if (areas.length === 0) {
    lines.push(t('digest-no-areas', lang));
  } else {
    areas.forEach((area, index) => {
      lines.push(formatArea(area, index));
    });
  }

  lines.push('');
  lines.push('───────────────');

  // Stats line
  const statsLine = buildStatsLine(stats.currentStreak, lastProgressDate, user.timezone, lang);
  lines.push(statsLine);

  lines.push('');
  lines.push(t('digest-motivation', lang));

  return lines.join('\n');
}

/**
 * Get a greeting based on the time of day.
 */
function getTimeBasedGreeting(hour: number, lang: Language): string {
  if (hour < 12) {
    return t('greeting-morning', lang);
  } else if (hour < 17) {
    return t('greeting-afternoon', lang);
  } else {
    return t('greeting-evening', lang);
  }
}

/**
 * Build the statistics line for the digest.
 */
function buildStatsLine(
  streak: number,
  lastProgressDate: Date | null,
  _timezone: string,
  lang: Language
): string {
  const parts: string[] = [];

  if (streak > 0) {
    const daysWord = getDaysWord(streak, lang);
    parts.push(`🔥 ${streak} ${daysWord} ${t('stats-streak', lang)}`);
  }

  if (lastProgressDate) {
    const formattedDate = formatDateTime(lastProgressDate, lang);
    parts.push(`${t('stats-last', lang)}: ${formattedDate}`);
  }

  if (parts.length === 0) {
    return t('stats-start', lang);
  }

  return parts.join(' | ');
}

// Keep old function name for backward compatibility
export const generateMorningDigest = generateDigest;
