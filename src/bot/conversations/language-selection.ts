import { InlineKeyboard } from 'grammy';
import type { BotConversation, BotContext } from '../../types/index.js';
import { userService } from '../../services/user.service.js';
import { isValidLanguage } from '../../locales/index.js';

/**
 * Language selection conversation
 * First step for new users - choose interface language
 */
export async function languageSelectionConversation(
  conversation: BotConversation,
  ctx: BotContext
) {
  if (!ctx.from?.id) return;

  const telegramId = BigInt(ctx.from.id);
  const user = await userService.getOrCreateUser(telegramId);

  // Show language selection (always in both languages)
  const keyboard = new InlineKeyboard()
    .text('🇬🇧 English', 'lang:en')
    .text('🇷🇺 Русский', 'lang:ru');

  await ctx.reply(
    'Welcome! 👋\n' +
      'Please select your language:\n\n' +
      'Добро пожаловать! 👋\n' +
      'Пожалуйста, выберите ваш язык:',
    { reply_markup: keyboard }
  );

  // Wait for language selection
  const langCtx = await conversation.waitFor('callback_query:data');
  await langCtx.answerCallbackQuery();

  const selectedLang = langCtx.callbackQuery.data.replace('lang:', '');

  if (!isValidLanguage(selectedLang)) {
    await langCtx.reply('Invalid language. Please try again.');
    return;
  }

  // Update user language
  await userService.updateLanguage(user.id, selectedLang);

  // Update context locale for subsequent messages
  await langCtx.i18n.setLocale(selectedLang);

  // Confirm selection
  const confirmMsg =
    selectedLang === 'en'
      ? 'Language updated to English'
      : 'Язык изменён на Русский';
  await langCtx.reply(confirmMsg);

  // Continue to onboarding
  await langCtx.conversation.enter('onboarding');
}
