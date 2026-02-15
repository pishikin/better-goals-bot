import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { env } from '../config/env.js';
import type { BotContext, SessionData } from '../types/index.js';
import { i18n, languageMiddleware } from './middleware/i18n.js';

// Import conversations
import { languageSelectionConversation } from './conversations/language-selection.js';
import { onboardingConversation } from './conversations/onboarding.js';
import { addAreaConversation } from './conversations/add-area.js';
import { editAreaConversation } from './conversations/edit-area.js';
import { logProgressConversation } from './conversations/log-progress.js';
import { progressDateSelectionConversation } from './conversations/progress-date-selection.js';

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

// i18n middleware (must be before conversations)
bot.use(i18n);
bot.use(languageMiddleware());

// Conversations middleware
bot.use(conversations());

// Register conversations
bot.use(createConversation(languageSelectionConversation, 'languageSelection'));
bot.use(createConversation(onboardingConversation, 'onboarding'));
bot.use(createConversation(addAreaConversation, 'addArea'));
bot.use(createConversation(editAreaConversation, 'editArea'));
bot.use(createConversation(logProgressConversation, 'logProgress'));
bot.use(createConversation(progressDateSelectionConversation, 'progressDateSelection'));

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
  await ctx.conversation.enter('progressDateSelection');
});

bot.command('help', async (ctx) => {
  const t = (key: string) => ctx.t(key);

  const helpText = [
    t('help-title'),
    '',
    t('help-commands'),
    t('help-start'),
    t('help-areas'),
    t('help-progress'),
    t('help-summary'),
    t('help-settings'),
    t('help-help'),
    '',
    t('help-philosophy'),
    t('help-philosophy-text'),
  ].join('\n');

  await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

// Callback query handlers - order matters!
// More specific handlers first, then generic ones
bot.callbackQuery(/^area:/, handleAreaCallbacks);
bot.callbackQuery(/^settings:|^language:|^timezone:|^time:|^digest:|^reset:/, handleSettingsCallbacks);
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
