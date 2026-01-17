import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { env } from '../config/env.js';
import type { BotContext, SessionData } from '../types/index.js';

// Import conversations
import { onboardingConversation } from './conversations/onboarding.js';
import { addAreaConversation } from './conversations/add-area.js';
import { logProgressConversation } from './conversations/log-progress.js';

// Import handlers
import { handleStart, handleMainMenuActions } from './handlers/start.handler.js';
import { handleAreasCommand, handleEditAreas, handleAreaCallbacks } from './handlers/areas.handler.js';
import { handleSettingsCommand, handleSettingsCallbacks } from './handlers/settings.handler.js';
import { handleSummaryCommand, handleSummaryCallbacks } from './handlers/summary.handler.js';

// Create bot instance
export const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN);

// Session middleware
bot.use(
  session({
    initial: (): SessionData => ({}),
  })
);

// Conversations middleware
bot.use(conversations());

// Register conversations
bot.use(createConversation(onboardingConversation, 'onboarding'));
bot.use(createConversation(addAreaConversation, 'addArea'));
bot.use(createConversation(logProgressConversation, 'logProgress'));

// Error handler
bot.catch((err) => {
  const ctx = err.ctx;
  const e = err.error;

  console.error(`Error while handling update ${ctx.update.update_id}:`);

  if (e instanceof Error) {
    console.error('Error message:', e.message);
    console.error('Stack trace:', e.stack);
  } else {
    console.error('Unknown error:', e);
  }
});

// Command handlers
bot.command('start', handleStart);
bot.command('areas', handleAreasCommand);
bot.command('settings', handleSettingsCommand);
bot.command('summary', handleSummaryCommand);

bot.command('progress', async (ctx) => {
  await ctx.conversation.enter('logProgress');
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    '📖 *Better Goals Help*\n\n' +
      '*Commands:*\n' +
      '/start - Start bot and see your areas\n' +
      '/areas - Manage focus areas\n' +
      '/progress - Log daily progress\n' +
      '/summary - Generate AI analysis prompt\n' +
      '/settings - Configure reminders\n' +
      '/help - Show this message\n\n' +
      '*Philosophy:*\n' +
      'Less is more. Focus on up to 7 key areas.\n' +
      'Log daily progress. Build momentum through consistency.',
    { parse_mode: 'Markdown' }
  );
});

// Callback query handlers - order matters!
// More specific handlers first, then generic ones
bot.callbackQuery(/^area:/, handleAreaCallbacks);
bot.callbackQuery(/^settings:|^timezone:|^time:|^digest:|^reset:/, handleSettingsCallbacks);
bot.callbackQuery(/^summary:/, handleSummaryCallbacks);
bot.callbackQuery(/^action:edit_areas$/, handleEditAreas);
bot.callbackQuery(/^action:settings$/, handleSettingsCallbacks);
bot.callbackQuery(/^action:summary$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await handleSummaryCommand(ctx);
});

// Generic action handlers
bot.on('callback_query:data', handleMainMenuActions);

export default bot;
