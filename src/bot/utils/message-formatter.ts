import type { Area } from '@prisma/client';
import type { UserStatistics, Language } from '../../types/index.js';
import { formatDateTime } from './date-formatter.js';

/**
 * Message formatter utility for bot messages.
 * Most formatting is now done inline with i18n translations.
 * This file contains only shared utilities.
 */

/**
 * Format the pinned message with all areas and statistics.
 * This is the main summary message that gets pinned in the chat.
 */
export function formatPinnedMessage(
  areas: Area[],
  stats: UserStatistics,
  lastProgressDate: Date | null,
  _timezone: string,
  language: string = 'en'
): string {
  const lang = language as Language;
  const isRu = lang === 'ru';

  const title = isRu ? '🎯 ВАШИ ОБЛАСТИ ФОКУСА' : '🎯 YOUR FOCUS AREAS';
  const lines: string[] = [title, ''];

  if (areas.length === 0) {
    const emptyMsg = isRu
      ? 'У вас пока нет областей фокуса. Добавьте первую!'
      : 'No areas yet. Add your first focus area!';
    lines.push(emptyMsg);
  } else {
    areas.forEach((area, index) => {
      const emoji = area.emoji ?? '•';
      const body = area.body ? `\n   → ${area.body}` : '';
      lines.push(`${index + 1}. ${emoji} ${area.title}${body}`);
    });
  }

  lines.push('');
  lines.push('───────────────');

  // Build stats line
  if (stats.currentStreak > 0 && lastProgressDate) {
    const lastUpdateText = formatDateTime(lastProgressDate, lang);
    const days = stats.currentStreak;
    const dayWord = isRu
      ? days === 1
        ? 'день'
        : days < 5
          ? 'дня'
          : 'дней'
      : days === 1
        ? 'day'
        : 'days';
    const lastLabel = isRu ? 'Последнее' : 'Last';
    lines.push(`🔥 ${days} ${dayWord} | ${lastLabel}: ${lastUpdateText}`);
  } else if (stats.currentStreak > 0) {
    const days = stats.currentStreak;
    const dayWord = isRu
      ? days === 1
        ? 'день'
        : days < 5
          ? 'дня'
          : 'дней'
      : days === 1
        ? 'day'
        : 'days';
    lines.push(`🔥 ${days} ${dayWord}`);
  } else if (lastProgressDate) {
    // User has progress entries but streak is broken
    // Show last progress date instead of "No progress logged yet"
    const lastUpdateText = formatDateTime(lastProgressDate, lang);
    const lastLabel = isRu ? 'Последнее' : 'Last';
    lines.push(`${lastLabel}: ${lastUpdateText}`);
  } else if (stats.totalEntries > 0) {
    // User has entries but no lastProgressDate (shouldn't happen, but handle gracefully)
    const hasEntries = isRu ? 'Есть записи прогресса' : 'Progress entries exist';
    lines.push(hasEntries);
  } else {
    // Truly no progress entries at all
    const noProgress = isRu
      ? 'Прогресс ещё не записан'
      : 'No progress logged yet';
    lines.push(noProgress);
  }

  return lines.join('\n');
}

/**
 * Escape special characters for Telegram MarkdownV2.
 * Use this for user-provided content that might contain special chars.
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
