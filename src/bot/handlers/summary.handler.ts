import type { BotContext } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import { generateAnalysisPrompt } from '../../services/prompt.service.js';
import { InlineKeyboard } from 'grammy';

type TranslateFn = (key: string, params?: Record<string, any>) => string;

/**
 * Handle /summary command - generate AI analysis prompt.
 */
export async function handleSummaryCommand(ctx: BotContext): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);
  const t: TranslateFn = (key, params) => ctx.t(key, params);

  if (!user) {
    await ctx.reply(t('error-please-start'));
    return;
  }

  // Show options for time range
  await ctx.reply(`${t('summary-title')}\n\n${t('summary-period')}`, {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text(t('summary-7days'), 'summary:7')
      .text(t('summary-14days'), 'summary:14')
      .row()
      .text(t('summary-30days'), 'summary:30')
      .text(t('summary-all'), 'summary:all')
      .row()
      .text(t('btn-back'), 'action:back'),
  });
}

/**
 * Handle summary generation with specific day range.
 */
export async function handleSummaryGeneration(ctx: BotContext, days: number | 'all'): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);
  const t: TranslateFn = (key, params) => ctx.t(key, params);

  if (!user) {
    await ctx.answerCallbackQuery(t('error-please-start'));
    return;
  }

  await ctx.answerCallbackQuery(t('summary-generating'));

  // Generate the prompt (pass 0 for "all time")
  const daysNum = days === 'all' ? 0 : days;
  const prompt = await generateAnalysisPrompt(user, daysNum);

  // Send info message
  await ctx.editMessageText(t('summary-ready'), {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text('🔄', 'action:summary')
      .text(t('btn-back'), 'action:back'),
  });

  // Send the actual prompt in a code block for easy copying
  // Split into chunks if too long (Telegram limit is 4096 chars)
  const maxLength = 4000;

  if (prompt.length <= maxLength) {
    await ctx.reply(`\`\`\`\n${prompt}\n\`\`\``, { parse_mode: 'Markdown' });
  } else {
    // Split into chunks
    const chunks: string[] = [];
    let currentChunk = '';

    const lines = prompt.split('\n');
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    for (let i = 0; i < chunks.length; i++) {
      const header = chunks.length > 1 ? `Part ${i + 1}/${chunks.length}\n` : '';
      await ctx.reply(`${header}\`\`\`\n${chunks[i]}\n\`\`\``, { parse_mode: 'Markdown' });
    }
  }

  // Send copy instruction
  await ctx.reply(t('summary-copy-instruction'));
}

/**
 * Handle summary-related callbacks.
 */
export async function handleSummaryCallbacks(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const t: TranslateFn = (key, params) => ctx.t(key, params);

  if (!data?.startsWith('summary:')) return;

  const daysStr = data.replace('summary:', '');

  if (daysStr === 'all') {
    await handleSummaryGeneration(ctx, 'all');
    return;
  }

  const days = parseInt(daysStr, 10);

  if (isNaN(days)) {
    await ctx.answerCallbackQuery(t('error-something-wrong'));
    return;
  }

  await handleSummaryGeneration(ctx, days);
}
