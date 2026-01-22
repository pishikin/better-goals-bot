import type { BotContext, BotConversation, Language } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import { createProgressDateSelectionKeyboard } from '../keyboards/progress.keyboard.js';
import { selectDateConversation } from './select-date.js';
import { logProgressConversation } from './log-progress.js';
import { i18n } from '../../locales/index.js';

type TranslateFn = (key: string, params?: Record<string, any>) => string;

/**
 * Conversation for selecting whether to log progress for today or past period.
 * Routes to appropriate flow based on user selection.
 */
export async function progressDateSelectionConversation(
  conversation: BotConversation,
  ctx: BotContext
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

  // Show date selection options
  await ctx.reply(t('progress-date-selection'), {
    parse_mode: 'Markdown',
    reply_markup: createProgressDateSelectionKeyboard(t),
  });

  // Wait for user selection
  while (true) {
    const response = await conversation.waitFor('callback_query:data');

    if (response.callbackQuery?.data) {
      await response.answerCallbackQuery();

      const data = response.callbackQuery.data;

      if (data === 'progress:date:today') {
        // Log progress for today
        await logProgressConversation(conversation, ctx);
        return;
      }

      if (data === 'progress:date:past') {
        // Select past date
        const selectedDate = await selectDateConversation(conversation, ctx);
        
        if (selectedDate) {
          // Log progress for selected date
          await logProgressConversation(conversation, ctx, selectedDate);
        }
        return;
      }

      if (data === 'action:back') {
        return; // User cancelled
      }
    }
  }
}
