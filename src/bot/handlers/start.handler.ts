import type { BotContext } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import * as areasService from '../../services/areas.service.js';
import { getUserStatistics, getLastProgressDate } from '../../services/statistics.service.js';
import { formatPinnedMessage } from '../utils/message-formatter.js';
import { createMainMenuKeyboard } from '../keyboards/main-menu.keyboard.js';

/**
 * Handle /start command.
 * Routes to language selection for new users, onboarding for incomplete setup,
 * or shows main menu for existing users.
 */
export async function handleStart(ctx: BotContext): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);

  if (!user) {
    // New user - start with language selection
    await ctx.conversation.enter('languageSelection');
    return;
  }

  if (!user.onboardingCompleted) {
    // Incomplete onboarding - continue onboarding
    await ctx.conversation.enter('onboarding');
    return;
  }

  // Existing user - show main menu
  const areas = await areasService.getUserAreas(user.id);
  const stats = await getUserStatistics(user.id, user.timezone);
  const lastProgress = await getLastProgressDate(user.id);

  const messageText = formatPinnedMessage(
    areas,
    stats,
    lastProgress,
    user.timezone,
    user.language
  );

  // For now, use default English keyboard until we refactor all handlers
  await ctx.reply(messageText, {
    reply_markup: createMainMenuKeyboard(),
  });
}

/**
 * Handle main menu button callbacks.
 */
export async function handleMainMenuActions(ctx: BotContext): Promise<void> {
  const action = ctx.callbackQuery?.data;

  if (!action) return;

  await ctx.answerCallbackQuery();

  switch (action) {
    case 'action:progress':
      await ctx.conversation.enter('logProgress');
      break;

    case 'action:add_area':
      await ctx.conversation.enter('addArea');
      break;

    case 'action:edit_areas':
      // Will be handled by areas handler
      await ctx.reply('Edit areas coming soon...');
      break;

    case 'action:settings':
      // Will be handled by settings handler
      await ctx.reply('Settings coming soon...');
      break;

    case 'action:summary':
      // Will be handled by summary handler
      await ctx.reply('Summary coming soon...');
      break;

    case 'action:main_menu':
    case 'action:back':
      await handleStart(ctx);
      break;

    default:
      break;
  }
}
