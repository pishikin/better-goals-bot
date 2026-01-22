import type { BotContext, BotConversation, Language } from '../../types/index.js';
import type { Area } from '@prisma/client';
import * as userService from '../../services/user.service.js';
import * as areasService from '../../services/areas.service.js';
import * as progressService from '../../services/progress.service.js';
import { getUserStatistics, getLastProgressDate } from '../../services/statistics.service.js';
import { validateProgressContent } from '../utils/validators.js';
import { formatPinnedMessage } from '../utils/message-formatter.js';
import { createMainMenuKeyboard } from '../keyboards/main-menu.keyboard.js';
import { createProgressControlKeyboard, createAllLoggedKeyboard } from '../keyboards/progress.keyboard.js';
import { formatDate } from '../utils/date-formatter.js';
import { i18n } from '../../locales/index.js';

type TranslateFn = (key: string, params?: Record<string, any>) => string;

/**
 * Temporary storage for progress entries during a session.
 */
interface ProgressSessionEntry {
  areaId: string;
  content: string;
}

/**
 * Log progress conversation flow.
 * Iterates through areas without progress for selected date and collects entries:
 * 1. Show areas one by one
 * 2. Wait for text input or skip
 * 3. Allow cancel all to abort
 * 4. Save all entries in a transaction at the end
 * 5. Update pinned message with new streak
 */
export async function logProgressConversation(
  conversation: BotConversation,
  ctx: BotContext,
  selectedDate?: Date
): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);

  // Get user first
  const user = await conversation.external(() => userService.getUserByTelegramId(telegramId));

  if (!user) {
    await ctx.reply(i18n.t('en', 'error-please-start'));
    return;
  }

  // Get user's language
  const language: Language = (user.language as Language) || 'en';
  const t: TranslateFn = (key, params) => i18n.t(language, key, params);

  // Get the session date (either selected date or today)
  const sessionDate = selectedDate || progressService.getTodayInTimezone(user.timezone);

  // Get areas without progress for the selected date
  const areasToLog = await conversation.external(() =>
    progressService.getAreasWithoutProgressForDate(user.id, sessionDate)
  );

  if (areasToLog.length === 0) {
    const dateLabel = selectedDate 
      ? formatDate(sessionDate, language)
      : t('progress-today');
    await ctx.reply(t('progress-all-caught-up-for-date', { date: dateLabel }), {
      parse_mode: 'Markdown',
      reply_markup: createAllLoggedKeyboard(t),
    });
    return;
  }

  // Collect entries during the session
  const sessionEntries: ProgressSessionEntry[] = [];
  let skippedCount = 0;
  let cancelled = false;

  // Iterate through each area
  for (let i = 0; i < areasToLog.length && !cancelled; i++) {
    const area = areasToLog[i] as Area;
    const currentIndex = i + 1;
    const totalAreas = areasToLog.length;

    // Show the area prompt
    const areaEmoji = area.emoji ?? '📝';
    const areaBody = area.body ?? 'none';
    await ctx.reply(
      t('progress-area-prompt', {
        current: currentIndex,
        total: totalAreas,
        emoji: areaEmoji,
        title: area.title,
        body: areaBody,
      }),
      {
        parse_mode: 'Markdown',
        reply_markup: createProgressControlKeyboard(t),
      }
    );

    // Wait for response
    let entryDone = false;

    while (!entryDone && !cancelled) {
      const response = await conversation.waitFor([':text', 'callback_query:data']);

      if (response.callbackQuery?.data) {
        await response.answerCallbackQuery();

        if (response.callbackQuery.data === 'progress:skip') {
          skippedCount++;
          await ctx.reply(t('progress-skipped-area', { emoji: areaEmoji, title: area.title }));
          entryDone = true;
        } else if (response.callbackQuery.data === 'progress:cancel') {
          cancelled = true;
        }
      } else if (response.message?.text) {
        const validation = validateProgressContent(response.message.text);

        if (validation.success) {
          sessionEntries.push({
            areaId: area.id,
            content: validation.data,
          });
          entryDone = true;
        } else {
          await ctx.reply(`⚠️ ${t('error-progress-too-long')}`);
        }
      }
    }
  }

  // Handle cancellation
  if (cancelled) {
    await ctx.reply(t('progress-cancelled'), { parse_mode: 'Markdown' });
    return;
  }

  // Save all entries in a transaction (or create check-in if all skipped)
  if (sessionEntries.length > 0 || skippedCount > 0) {
    await conversation.external(() =>
      progressService.logProgressBatch(user.id, sessionEntries, skippedCount, sessionDate)
    );
  }

  // Calculate new statistics
  const stats = await conversation.external(() => getUserStatistics(user.id, user.timezone));

  // Show summary
  const dateLabel = selectedDate 
    ? formatDate(sessionDate, language)
    : t('progress-today');
  const summaryText = t('progress-summary-for-date', { 
    count: sessionEntries.length,
    date: dateLabel 
  });
  const streakText = stats.currentStreak > 0 ? '\n\n' + t('progress-streak', { days: stats.currentStreak }) : '';
  await ctx.reply(summaryText + streakText, { parse_mode: 'Markdown' });

  // Update pinned message
  await updatePinnedMessage(conversation, ctx, user.id, user.timezone, user.pinnedMessageId, language, t);
}

/**
 * Helper to update the pinned message with current areas and stats.
 */
async function updatePinnedMessage(
  conversation: BotConversation,
  ctx: BotContext,
  userId: string,
  timezone: string,
  pinnedMessageId: bigint | null,
  language: string,
  t: TranslateFn
): Promise<void> {
  const areas = await conversation.external(() => areasService.getUserAreas(userId));
  const stats = await conversation.external(() => getUserStatistics(userId, timezone));
  const lastProgress = await conversation.external(() => getLastProgressDate(userId));

  const messageText = formatPinnedMessage(areas, stats, lastProgress, timezone, language);

  if (pinnedMessageId) {
    try {
      await ctx.api.editMessageText(
        ctx.chat?.id ?? 0,
        Number(pinnedMessageId),
        messageText,
        { reply_markup: createMainMenuKeyboard(t) }
      );
    } catch {
      // Edit might fail if message hasn't changed, that's okay
    }
  }
}
