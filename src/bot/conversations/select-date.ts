import type { BotContext, BotConversation, Language } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import * as progressService from '../../services/progress.service.js';
import { validatePastDate } from '../utils/validators.js';
import { formatDate } from '../utils/date-formatter.js';
import { createPastDateSelectionKeyboard } from '../keyboards/progress.keyboard.js';
import { createBackKeyboard } from '../keyboards/main-menu.keyboard.js';
import { startOfDay, subDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { i18n } from '../../locales/index.js';

type TranslateFn = (key: string, params?: Record<string, any>) => string;

/**
 * Conversation for selecting a past date to log progress.
 * Shows last 3 days + option to input custom date.
 */
export async function selectDateConversation(
  conversation: BotConversation,
  ctx: BotContext
): Promise<Date | null> {
  const telegramId = BigInt(ctx.from?.id ?? 0);

  // Get user first
  const user = await conversation.external(() => userService.getUserByTelegramId(telegramId));

  if (!user) {
    await ctx.reply(i18n.t('en', 'error-please-start'));
    return null;
  }

  // Get user's language
  const language: Language = (user.language as Language) || 'en';
  const t: TranslateFn = (key, params) => i18n.t(language, key, params);

  // Get today in user's timezone
  const today = progressService.getTodayInTimezone(user.timezone);
  
  // Generate last 3 days
  const lastThreeDays = [];
  for (let i = 1; i <= 3; i++) {
    const date = subDays(today, i);
    const dateStr = formatDate(date, language);
    lastThreeDays.push({
      date,
      label: dateStr,
    });
  }

  // Show date selection keyboard
  await ctx.reply(t('progress-select-past-date'), {
    parse_mode: 'Markdown',
    reply_markup: createPastDateSelectionKeyboard(lastThreeDays, t),
  });

  // Wait for user selection
  while (true) {
    const response = await conversation.waitFor([':text', 'callback_query:data']);

    if (response.callbackQuery?.data) {
      await response.answerCallbackQuery();

      const data = response.callbackQuery.data;

      if (data === 'progress:date:back') {
        return null; // User cancelled
      }

      if (data === 'progress:date:custom') {
        // Ask for custom date input
        await ctx.reply(t('progress-custom-date-prompt'), {
          parse_mode: 'Markdown',
          reply_markup: createBackKeyboard(t, 'progress:date:back'),
        });
        continue;
      }

      if (data.startsWith('progress:date:')) {
        const dateStr = data.replace('progress:date:', '');
        
        // Handle ISO date string from button
        if (dateStr !== 'today' && dateStr !== 'past' && dateStr !== 'custom' && dateStr !== 'back') {
          try {
            const selectedDate = new Date(dateStr);
            
            // Validate date is valid
            if (isNaN(selectedDate.getTime())) {
              continue;
            }
            
            // Check date is in the past and within 7 days (using user's timezone)
            const selectedDay = startOfDay(selectedDate);
            const todayStart = startOfDay(today);
            const daysDiff = Math.floor((todayStart.getTime() - selectedDay.getTime()) / (1000 * 60 * 60 * 24));
            
            if (selectedDay < todayStart && daysDiff > 0 && daysDiff <= 7) {
              return selectedDay;
            } else {
              await ctx.reply(`⚠️ ${t('error-invalid-date')}`, {
                parse_mode: 'Markdown',
              });
              continue;
            }
          } catch {
            // Invalid date format
            await ctx.reply(`⚠️ ${t('error-invalid-date')}`, {
              parse_mode: 'Markdown',
            });
            continue;
          }
        }
      }
    } else if (response.message?.text) {
      const text = response.message.text.trim();

      // Check if user wants to go back
      if (text === '/back' || text === t('btn-back')) {
        return null;
      }

      // Validate date format DD.MM.YY
      const validation = validatePastDate(text);

      if (validation.success) {
        // validation.data is a Date object parsed from DD.MM.YY format
        // We interpret the date components as a date in user's timezone
        const year = validation.data.getFullYear();
        const month = validation.data.getMonth();
        const day = validation.data.getDate();
        
        // Create date components and build a date string
        // We'll create it as a date in user's timezone by using Intl.DateTimeFormat
        // to format it, then parse it back. Actually, simpler: just use the date
        // components to create a date string and parse it.
        // Since validatePastDate already validated the date is in the past and within 7 days,
        // we just need to normalize it to start of day in user's timezone.
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Parse the date as if it's in user's timezone
        // We'll create a date at midnight in the user's timezone
        // Using a simpler approach: create date and normalize to start of day
        const parsedDate = new Date(`${dateStr}T00:00:00`);
        
        // Convert to user's timezone and get start of day
        const zonedDate = toZonedTime(parsedDate, user.timezone);
        const selectedDay = startOfDay(zonedDate);
        
        // Double-check it's still valid (should be, but verify)
        const todayStart = startOfDay(today);
        const daysDiff = Math.floor((todayStart.getTime() - selectedDay.getTime()) / (1000 * 60 * 60 * 24));
        
        if (selectedDay < todayStart && daysDiff > 0 && daysDiff <= 7) {
          return selectedDay;
        } else {
          await ctx.reply(`⚠️ ${t('error-invalid-date')}`, {
            parse_mode: 'Markdown',
          });
          continue;
        }
      } else {
        await ctx.reply(`⚠️ ${validation.error || t('error-invalid-date')}`, {
          parse_mode: 'Markdown',
        });
        continue;
      }
    }
  }
}
