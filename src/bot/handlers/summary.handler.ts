import type { BotContext } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import { generateAnalysisPrompt, generateQuickSummary } from '../../services/prompt.service.js';
import { formatPromptGenerated } from '../utils/message-formatter.js';
import { InlineKeyboard } from 'grammy';

/**
 * Handle /summary command - generate AI analysis prompt.
 */
export async function handleSummaryCommand(ctx: BotContext): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);

  if (!user) {
    await ctx.reply('Please start the bot first with /start');
    return;
  }

  // Show options for time range
  await ctx.reply('📊 *Generate AI Analysis Prompt*\n\nSelect the time range:', {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text('Last 3 days', 'summary:3')
      .text('Last 7 days', 'summary:7')
      .row()
      .text('Last 14 days', 'summary:14')
      .text('Last 30 days', 'summary:30')
      .row()
      .text('← Back', 'action:back'),
  });
}

/**
 * Handle summary generation with specific day range.
 */
export async function handleSummaryGeneration(ctx: BotContext, days: number): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);

  if (!user) {
    await ctx.answerCallbackQuery('Please start the bot first');
    return;
  }

  await ctx.answerCallbackQuery('Generating prompt...');

  // Generate the prompt
  const prompt = await generateAnalysisPrompt(user, days);

  // Send info message
  await ctx.editMessageText(formatPromptGenerated(days), {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text('🔄 Different range', 'action:summary')
      .text('← Back', 'action:back'),
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
}

/**
 * Handle quick summary (shorter version).
 */
export async function handleQuickSummary(ctx: BotContext): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);

  if (!user) {
    await ctx.reply('Please start the bot first with /start');
    return;
  }

  const summary = await generateQuickSummary(user);

  await ctx.reply(summary, {
    reply_markup: new InlineKeyboard()
      .text('📊 Full AI Prompt', 'action:summary')
      .text('← Back', 'action:back'),
  });
}

/**
 * Handle summary-related callbacks.
 */
export async function handleSummaryCallbacks(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (!data?.startsWith('summary:')) return;

  const days = parseInt(data.replace('summary:', ''), 10);

  if (isNaN(days)) {
    await ctx.answerCallbackQuery('Invalid selection');
    return;
  }

  await handleSummaryGeneration(ctx, days);
}
