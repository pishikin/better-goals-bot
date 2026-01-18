import { format, formatDistanceToNow } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import type { Language } from '../../locales/index.js';

const localeMap = {
  en: enUS,
  ru: ru,
};

/**
 * Format date as relative time (e.g., "5 days ago" / "5 дней назад")
 */
export function formatRelativeDate(date: Date, language: Language): string {
  const locale = localeMap[language];
  return formatDistanceToNow(date, { addSuffix: true, locale });
}

/**
 * Format date and time (e.g., "Today 21:43" / "Сегодня 21:43")
 */
export function formatDateTime(date: Date, language: Language): string {
  const locale = localeMap[language];
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    const timeStr = format(date, 'HH:mm', { locale });
    return language === 'en' ? `Today ${timeStr}` : `Сегодня ${timeStr}`;
  }

  return format(date, 'PPp', { locale });
}

/**
 * Format date only (e.g., "Jan 18, 2026" / "18 янв 2026")
 */
export function formatDate(date: Date, language: Language): string {
  const locale = localeMap[language];
  return format(date, 'PP', { locale });
}

/**
 * Format time only (e.g., "09:00")
 */
export function formatTime(date: Date): string {
  return format(date, 'HH:mm');
}
