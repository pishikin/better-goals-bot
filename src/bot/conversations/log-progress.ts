import type { BotContext, BotConversation } from '../../types/index.js';
import type { Area } from '@prisma/client';
import * as userService from '../../services/user.service.js';
import * as areasService from '../../services/areas.service.js';
import * as progressService from '../../services/progress.service.js';
import { getUserStatistics, getLastProgressDate } from '../../services/statistics.service.js';
import { validateProgressContent } from '../utils/validators.js';
import {
  formatProgressHeader,
  formatProgressSummary,
  formatPinnedMessage,
  formatValidationError,
  formatSkipConfirmation,
} from '../utils/message-formatter.js';
import { createMainMenuKeyboard } from '../keyboards/main-menu.keyboard.js';
import { createProgressControlKeyboard, createAllLoggedKeyboard } from '../keyboards/progress.keyboard.js';

/**
 * Temporary storage for progress entries during a session.
 */
interface ProgressSessionEntry {
  areaId: string;
  content: string;
}

/**
 * Log progress conversation flow.
 * Iterates through areas without today's progress and collects entries:
 * 1. Show areas one by one
 * 2. Wait for text input or skip
 * 3. Allow cancel all to abort
 * 4. Save all entries in a transaction at the end
 * 5. Update pinned message with new streak
 */
export async function logProgressConversation(
  conversation: BotConversation,
  ctx: BotContext
): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);

  // Get user
  const user = await conversation.external(() => userService.getUserByTelegramId(telegramId));

  if (!user) {
    await ctx.reply('Please start the bot first with /start');
    return;
  }

  // Get areas without today's progress
  const areasToLog = await conversation.external(() =>
    progressService.getAreasWithoutTodayProgress(user.id, user.timezone)
  );

  if (areasToLog.length === 0) {
    await ctx.reply(
      '✅ *All caught up!*\n\nYou\'ve already logged progress for all areas today.',
      {
        parse_mode: 'Markdown',
        reply_markup: createAllLoggedKeyboard(),
      }
    );
    return;
  }

  // Get the session start date (used for all entries)
  const sessionDate = progressService.getTodayInTimezone(user.timezone);

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
    await ctx.reply(formatProgressHeader(currentIndex, totalAreas, area), {
      parse_mode: 'Markdown',
      reply_markup: createProgressControlKeyboard(),
    });

    // Wait for response
    let entryDone = false;

    while (!entryDone && !cancelled) {
      const response = await conversation.waitFor([':text', 'callback_query:data']);

      if (response.callbackQuery?.data) {
        await response.answerCallbackQuery();

        if (response.callbackQuery.data === 'progress:skip') {
          skippedCount++;
          await ctx.reply(formatSkipConfirmation(area));
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
          await ctx.reply(formatValidationError('Progress entry', validation.error));
        }
      }
    }
  }

  // Handle cancellation
  if (cancelled) {
    await ctx.reply(
      '❌ *Progress logging cancelled*\n\nNo entries were saved from this session.',
      { parse_mode: 'Markdown' }
    );
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
  await ctx.reply(formatProgressSummary(sessionEntries.length, skippedCount, stats.currentStreak), {
    parse_mode: 'Markdown',
  });

  // Update pinned message
  await updatePinnedMessage(conversation, ctx, user.id, user.timezone, user.pinnedMessageId);
}

/**
 * Helper to update the pinned message with current areas and stats.
 */
async function updatePinnedMessage(
  conversation: BotConversation,
  ctx: BotContext,
  userId: string,
  timezone: string,
  pinnedMessageId: bigint | null
): Promise<void> {
  const areas = await conversation.external(() => areasService.getUserAreas(userId));
  const stats = await conversation.external(() => getUserStatistics(userId, timezone));
  const lastProgress = await conversation.external(() => getLastProgressDate(userId));

  const messageText = formatPinnedMessage(areas, stats, lastProgress, timezone);

  if (pinnedMessageId) {
    try {
      await ctx.api.editMessageText(
        ctx.chat?.id ?? 0,
        Number(pinnedMessageId),
        messageText,
        { reply_markup: createMainMenuKeyboard() }
      );
    } catch {
      // Edit might fail if message hasn't changed, that's okay
    }
  }
}
