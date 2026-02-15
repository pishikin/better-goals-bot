import type { BotContext } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import { createMainMenuKeyboard } from '../keyboards/main-menu.keyboard.js';
import { buildPinnedPlanMessage, syncPinnedPlanMessage } from '../utils/pinned-plan.js';

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

  // One-time notice about the new planning model for existing users.
  if (!user.newModelOnboardingShownAt) {
    const isRu = user.language === 'ru';
    await ctx.reply(
      isRu
        ? '🆕 Обновление Better Goals:\n\nТеперь основной цикл: план на день → напоминания → вечерняя подбивка.\nСтарые данные по направлениям и прогрессу сохранены.'
        : '🆕 Better Goals update:\n\nThe main flow is now: daily plan → reminders → evening review.\nYour existing areas and progress history are preserved.'
    );
    await userService.markNewModelOnboardingShown(user.id);
  }

  // Existing user - show main menu with current plan snapshot
  const messageText = await buildPinnedPlanMessage(
    user.id,
    user.timezone,
    user.language
  );

  await ctx.reply(messageText, {
    reply_markup: createMainMenuKeyboard(ctx.t),
  });

  await syncPinnedPlanMessage(ctx, {
    userId: user.id,
    timezone: user.timezone,
    language: user.language,
    pinnedMessageId: user.pinnedMessageId,
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
      await ctx.conversation.enter('plan');
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
