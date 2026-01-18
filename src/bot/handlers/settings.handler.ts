import type { BotContext } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import { validateTimezone, validateTime } from '../utils/validators.js';
import {
  createSettingsMenuKeyboard,
  createTimezoneKeyboard,
  createTimeSelectionKeyboard,
  createDigestTimesKeyboard,
  createResetConfirmKeyboard,
  createLanguageKeyboard,
} from '../keyboards/settings.keyboard.js';
import { isValidLanguage, LANGUAGE_NAMES } from '../../locales/index.js';

type TranslateFn = (key: string, params?: Record<string, any>) => string;

/**
 * Format settings menu using i18n.
 */
function formatSettingsMenuLocalized(
  user: { timezone: string; progressReminderTime: string | null; language: string },
  digestTimes: string[],
  t: TranslateFn
): string {
  const lines: string[] = [t('settings.settings-title'), ''];

  lines.push(`🌍 *${t('settings.settings-language')}:* ${user.language === 'ru' ? 'Русский' : 'English'}`);
  lines.push(`🌐 *${t('settings.settings-timezone')}:* ${user.timezone}`);

  if (digestTimes.length > 0) {
    lines.push(`📋 *${t('settings.settings-digest')}:* ${digestTimes.join(', ')}`);
  } else {
    lines.push(`📋 *${t('settings.settings-digest')}:* ${t('settings.digest-current', { times: 'none' })}`);
  }

  if (user.progressReminderTime) {
    lines.push(`📝 *${t('settings.settings-reminder')}:* ${user.progressReminderTime}`);
  } else {
    lines.push(`📝 *${t('settings.settings-reminder')}:* ${t('settings.reminder-current', { time: 'none' })}`);
  }

  return lines.join('\n');
}

/**
 * Handle /settings command.
 */
export async function handleSettingsCommand(ctx: BotContext): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);
  const t: TranslateFn = (key, params) => ctx.t(key, params);

  if (!user) {
    await ctx.reply(t('settings.error-please-start'));
    return;
  }

  const digestTimes = userService.getUserDigestTimes(user);

  await ctx.reply(formatSettingsMenuLocalized(user, digestTimes, t), {
    parse_mode: 'Markdown',
    reply_markup: createSettingsMenuKeyboard(t),
  });
}

/**
 * Handle settings menu navigation.
 */
export async function handleSettingsNavigation(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);
  const t: TranslateFn = (key, params) => ctx.t(key, params);

  if (!user) {
    await ctx.answerCallbackQuery(t('settings.error-please-start'));
    return;
  }

  await ctx.answerCallbackQuery();
  const digestTimes = userService.getUserDigestTimes(user);

  switch (data) {
    case 'action:settings':
      await ctx.editMessageText(formatSettingsMenuLocalized(user, digestTimes, t), {
        parse_mode: 'Markdown',
        reply_markup: createSettingsMenuKeyboard(t),
      });
      break;

    case 'settings:language':
      const currentLang = user.language || 'en';
      const langName =
        currentLang === 'en'
          ? LANGUAGE_NAMES.en.en
          : LANGUAGE_NAMES.ru.ru;
      await ctx.editMessageText(
        `${t('settings.language-title')}\n\n${t('settings.language-current', { language: langName })}\n\n${t('settings.language-select')}`,
        {
          parse_mode: 'Markdown',
          reply_markup: createLanguageKeyboard(currentLang, t),
        }
      );
      break;

    case 'settings:timezone':
      await ctx.editMessageText(`${t('settings.timezone-title')}\n\n${t('settings.timezone-current', { timezone: user.timezone })}`, {
        parse_mode: 'Markdown',
        reply_markup: createTimezoneKeyboard(t),
      });
      break;

    case 'settings:digest':
      await ctx.editMessageText(
        `${t('settings.digest-title')}\n\n${t('settings.digest-current', { times: digestTimes.length > 0 ? digestTimes.join(', ') : 'none' })}`,
        {
          parse_mode: 'Markdown',
          reply_markup: createDigestTimesKeyboard(digestTimes, t),
        }
      );
      break;

    case 'settings:progress_reminder':
      await ctx.editMessageText(
        `${t('settings.reminder-title')}\n\n${t('settings.reminder-current', { time: user.progressReminderTime ?? 'none' })}`,
        {
          parse_mode: 'Markdown',
          reply_markup: createTimeSelectionKeyboard('evening', t),
        }
      );
      break;

    case 'settings:reset':
      await ctx.editMessageText(
        `${t('settings.reset-title')}\n\n${t('settings.reset-warning')}\n${t('settings.reset-warning-areas')}\n${t('settings.reset-warning-progress')}\n${t('settings.reset-warning-settings')}`,
        {
          parse_mode: 'Markdown',
          reply_markup: createResetConfirmKeyboard(t),
        }
      );
      break;

    default:
      break;
  }
}

/**
 * Handle timezone selection.
 */
export async function handleTimezoneSelection(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);
  const t: TranslateFn = (key, params) => ctx.t(key, params);

  if (!user || !data?.startsWith('timezone:')) {
    await ctx.answerCallbackQuery(t('common.error-something-wrong'));
    return;
  }

  await ctx.answerCallbackQuery();

  const timezone = data.replace('timezone:', '');

  if (timezone === 'custom') {
    await ctx.editMessageText(t('settings.timezone-custom-prompt'), {
      parse_mode: 'Markdown',
    });
    return;
  }

  const validation = validateTimezone(timezone);

  if (!validation.success) {
    await ctx.reply(`⚠️ ${t('settings.timezone-invalid')}`);
    return;
  }

  await userService.updateTimezone(user.id, timezone);

  const updatedUser = await userService.getUserById(user.id);
  if (updatedUser) {
    const digestTimes = userService.getUserDigestTimes(updatedUser);
    await ctx.editMessageText(
      `✅ ${t('settings.timezone-updated', { timezone })}\n\n${formatSettingsMenuLocalized(updatedUser, digestTimes, t)}`,
      {
        parse_mode: 'Markdown',
        reply_markup: createSettingsMenuKeyboard(t),
      }
    );
  }
}

/**
 * Handle digest time management.
 */
export async function handleDigestTimeActions(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);
  const t: TranslateFn = (key, params) => ctx.t(key, params);

  if (!user || !data?.startsWith('digest:')) {
    await ctx.answerCallbackQuery(t('common.error-something-wrong'));
    return;
  }

  await ctx.answerCallbackQuery();

  const action = data.replace('digest:', '');

  if (action === 'add') {
    await ctx.editMessageText(
      `➕ ${t('settings.digest-add')}\n\n${t('settings.digest-prompt')}`,
      {
        parse_mode: 'Markdown',
        reply_markup: createTimeSelectionKeyboard('digest', t),
      }
    );
    return;
  }

  if (action.startsWith('remove:')) {
    const timeToRemove = action.replace('remove:', '');
    await userService.removeDigestTime(user.id, timeToRemove);

    const updatedUser = await userService.getUserById(user.id);
    if (updatedUser) {
      const digestTimes = userService.getUserDigestTimes(updatedUser);
      await ctx.editMessageText(
        `✅ ${t('settings.digest-removed')}\n\n${t('settings.digest-title')}\n${t('settings.digest-current', { times: digestTimes.length > 0 ? digestTimes.join(', ') : 'none' })}`,
        {
          parse_mode: 'Markdown',
          reply_markup: createDigestTimesKeyboard(digestTimes, t),
        }
      );
    }
    return;
  }

  if (action === 'clear') {
    await userService.clearDigestTimes(user.id);

    const updatedUser = await userService.getUserById(user.id);
    if (updatedUser) {
      await ctx.editMessageText(
        `✅ ${t('settings.digest-cleared')}\n\n${t('settings.digest-title')}\n${t('settings.digest-current', { times: 'none' })}`,
        {
          parse_mode: 'Markdown',
          reply_markup: createDigestTimesKeyboard([], t),
        }
      );
    }
  }
}

/**
 * Handle time selection for digest or progress reminder.
 */
export async function handleTimeSelection(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);
  const t: TranslateFn = (key, params) => ctx.t(key, params);

  if (!user || !data?.startsWith('time:')) {
    await ctx.answerCallbackQuery(t('common.error-something-wrong'));
    return;
  }

  await ctx.answerCallbackQuery();

  const parts = data.split(':');
  const type = parts[1]; // 'morning', 'evening', or 'digest'
  const time = parts.slice(2).join(':'); // Handle HH:mm format

  if (time === 'custom') {
    const promptKey = type === 'evening' ? 'settings.reminder-prompt' : 'settings.digest-prompt';
    await ctx.editMessageText(t(promptKey), { parse_mode: 'Markdown' });
    return;
  }

  if (time === 'disable') {
    if (type === 'evening') {
      await userService.updateProgressReminderTime(user.id, null);
    }

    const updatedUser = await userService.getUserById(user.id);
    if (updatedUser) {
      const digestTimes = userService.getUserDigestTimes(updatedUser);
      await ctx.editMessageText(
        `✅ ${t('settings.reminder-removed')}\n\n${formatSettingsMenuLocalized(updatedUser, digestTimes, t)}`,
        {
          parse_mode: 'Markdown',
          reply_markup: createSettingsMenuKeyboard(t),
        }
      );
    }
    return;
  }

  const validation = validateTime(time);

  if (!validation.success) {
    await ctx.reply(`⚠️ ${t('common.error-invalid-time')}`);
    return;
  }

  // Handle digest time addition
  if (type === 'digest' || type === 'morning') {
    const result = await userService.addDigestTime(user.id, time);

    if (!result.success) {
      await ctx.reply(`⚠️ ${t('settings.digest-max')}`);
      return;
    }

    const digestTimes = userService.getUserDigestTimes(result.user);
    await ctx.editMessageText(
      `✅ ${t('settings.digest-added', { time })}\n\n${t('settings.digest-title')}\n${t('settings.digest-current', { times: digestTimes.join(', ') })}`,
      {
        parse_mode: 'Markdown',
        reply_markup: createDigestTimesKeyboard(digestTimes, t),
      }
    );
    return;
  }

  // Handle progress reminder time
  if (type === 'evening') {
    await userService.updateProgressReminderTime(user.id, time);

    const updatedUser = await userService.getUserById(user.id);
    if (updatedUser) {
      const digestTimes = userService.getUserDigestTimes(updatedUser);
      await ctx.editMessageText(
        `✅ ${t('settings.reminder-updated', { time })}\n\n${formatSettingsMenuLocalized(updatedUser, digestTimes, t)}`,
        {
          parse_mode: 'Markdown',
          reply_markup: createSettingsMenuKeyboard(t),
        }
      );
    }
  }
}

/**
 * Handle reset confirmation.
 */
export async function handleResetConfirmation(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);
  const t: TranslateFn = (key, params) => ctx.t(key, params);

  if (!user) {
    await ctx.answerCallbackQuery(t('common.error-something-wrong'));
    return;
  }

  await ctx.answerCallbackQuery();

  if (data === 'reset:confirm') {
    // Show second confirmation - still show reset keyboard for final action
    await ctx.editMessageText(
      `🚨 ${t('settings.reset-title')}\n\n${t('settings.reset-warning')}\n${t('settings.reset-warning-areas')}\n${t('settings.reset-warning-progress')}\n${t('settings.reset-warning-settings')}`,
      {
        parse_mode: 'Markdown',
        reply_markup: createResetConfirmKeyboard(t),
      }
    );
    return;
  }

  if (data === 'reset:execute') {
    await userService.fullReset(user.id);

    await ctx.editMessageText(`✅ ${t('settings.reset-success')}`, {
      parse_mode: 'Markdown',
    });
    return;
  }

  // Cancel - go back to settings
  const digestTimes = userService.getUserDigestTimes(user);
  await ctx.editMessageText(formatSettingsMenuLocalized(user, digestTimes, t), {
    parse_mode: 'Markdown',
    reply_markup: createSettingsMenuKeyboard(t),
  });
}

/**
 * Handle language selection.
 */
export async function handleLanguageSelection(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);

  if (!user || !data?.startsWith('language:')) {
    await ctx.answerCallbackQuery(ctx.t('common.error-something-wrong'));
    return;
  }

  await ctx.answerCallbackQuery();

  const selectedLang = data.replace('language:', '');

  if (!isValidLanguage(selectedLang)) {
    await ctx.reply(ctx.t('common.error-something-wrong'));
    return;
  }

  // Update user language
  await userService.updateLanguage(user.id, selectedLang);

  // Update context locale
  await ctx.i18n.setLocale(selectedLang);

  // Get fresh translation function with new locale
  const t: TranslateFn = (key, params) => ctx.t(key, params);

  const langName = selectedLang === 'en' ? 'English' : 'Русский';

  const updatedUser = await userService.getUserById(user.id);
  if (updatedUser) {
    const digestTimes = userService.getUserDigestTimes(updatedUser);
    await ctx.editMessageText(
      `✅ ${t('settings.language-updated', { language: langName })}\n\n${formatSettingsMenuLocalized(updatedUser, digestTimes, t)}`,
      {
        parse_mode: 'Markdown',
        reply_markup: createSettingsMenuKeyboard(t),
      }
    );
  }
}

/**
 * Handle all settings-related callbacks.
 */
export async function handleSettingsCallbacks(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (!data) return;

  if (data.startsWith('settings:') || data === 'action:settings') {
    await handleSettingsNavigation(ctx);
  } else if (data.startsWith('language:')) {
    await handleLanguageSelection(ctx);
  } else if (data.startsWith('timezone:')) {
    await handleTimezoneSelection(ctx);
  } else if (data.startsWith('time:')) {
    await handleTimeSelection(ctx);
  } else if (data.startsWith('digest:')) {
    await handleDigestTimeActions(ctx);
  } else if (data.startsWith('reset:')) {
    await handleResetConfirmation(ctx);
  }
}
