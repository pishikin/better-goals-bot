import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { env, isDev } from '../config/env.js';
import type { BotContext, SessionData } from '../types/index.js';
import { i18n, languageMiddleware } from './middleware/i18n.js';

// Import conversations
import { languageSelectionConversation } from './conversations/language-selection.js';
import { onboardingConversation } from './conversations/onboarding.js';
import { addAreaConversation } from './conversations/add-area.js';
import { editAreaConversation } from './conversations/edit-area.js';
import { logProgressConversation } from './conversations/log-progress.js';
import { progressDateSelectionConversation } from './conversations/progress-date-selection.js';
import { planConversation } from './conversations/plan.js';
import { addTaskConversation } from './conversations/add-task.js';
import { eveningReviewConversation } from './conversations/evening-review.js';

// Import handlers
import { handleStart, handleMainMenuActions } from './handlers/start.handler.js';
import { handleSettingsCommand, handleSettingsCallbacks } from './handlers/settings.handler.js';
import { handleSummaryCommand, handleSummaryCallbacks } from './handlers/summary.handler.js';
import {
  handleAddCommand,
  handleDoneCommand,
  handleRemoveCommand,
  handlePlanCallbacks,
  handlePlanCommand,
  handleReviewCommand,
  handleSimulateRemindersCommand,
  handleStatsCommand,
  handleTomorrowPlanCommand,
} from './handlers/plan.handler.js';

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
bot.use(createConversation(planConversation, 'plan'));
bot.use(createConversation(addTaskConversation, 'addTask'));
bot.use(createConversation(eveningReviewConversation, 'eveningReview'));

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
bot.command('plan', handlePlanCommand);
bot.command('tomorrow', handleTomorrowPlanCommand);
bot.command('add', handleAddCommand);
bot.command('remove', handleRemoveCommand);
bot.command('done', handleDoneCommand);
bot.command('stats', handleStatsCommand);
bot.command('review', handleReviewCommand);
bot.command('week', handleStatsCommand);
bot.command('settings', handleSettingsCommand);
bot.command('summary', handleSummaryCommand);

if (isDev) {
  bot.command('simulate', handleSimulateRemindersCommand);
}

bot.command('progress', async (ctx) => {
  await ctx.conversation.enter('progressDateSelection');
});

bot.command('help', async (ctx) => {
  const isRu = (await ctx.i18n.getLocale()) === 'ru';
  const helpText = isRu
    ? [
        '📖 *Команды Better Goals*',
        '',
        '/start - старт и главное меню',
        '/plan - план на сегодня (/plan tomorrow для завтра)',
        '/tomorrow - сразу открыть планирование на завтра',
        '/add - добавить задачу в план',
        '/remove N - удалить задачу из плана',
        '/done [N] - отметить задачу выполненной',
        '/review - вечерняя подбивка задач',
        '/stats - статистика за календарную неделю',
        '/settings - настройки времени и напоминаний',
        '/summary - legacy AI prompt по старой модели',
        '/progress - legacy логирование прогресса',
        '/help - показать эту справку',
      ].join('\n')
    : [
        '📖 *Better Goals Commands*',
        '',
        '/start - start and open main menu',
        '/plan - plan for today (/plan tomorrow for tomorrow)',
        '/tomorrow - open planning flow for tomorrow',
        '/add - add task to today plan',
        '/remove N - remove task from today plan',
        '/done [N] - mark task done',
        '/review - run evening review flow',
        '/stats - current calendar week stats',
        '/settings - notification and time settings',
        '/summary - legacy AI prompt from old model',
        '/progress - legacy progress logging',
        '/help - show this help',
      ].join('\n');

  await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

// Callback query handlers - order matters!
// More specific handlers first, then generic ones
bot.callbackQuery(
  /^plan:start(?::tomorrow)?$|^task:done_all_(confirm|cancel)$|^review:start:(today|yesterday)$/,
  handlePlanCallbacks
);
bot.callbackQuery(/^settings:|^language:|^timezone:|^time:|^digest:|^reset:/, handleSettingsCallbacks);
bot.callbackQuery(/^summary:/, handleSummaryCallbacks);
bot.callbackQuery(/^action:settings$/, handleSettingsCallbacks);
bot.callbackQuery(/^action:summary$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await handleSummaryCommand(ctx);
});

// Generic action handlers
bot.on('callback_query:data', handleMainMenuActions);

export default bot;
