import type { BotContext } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import { validateTimezone, validateTime } from '../utils/validators.js';
import { formatSettingsMenu, formatSuccessMessage, formatValidationError } from '../utils/message-formatter.js';
import {
  createSettingsMenuKeyboard,
  createTimezoneKeyboard,
  createTimeSelectionKeyboard,
  createDigestTimesKeyboard,
  createResetConfirmKeyboard,
} from '../keyboards/settings.keyboard.js';

/**
 * Handle /settings command.
 */
export async function handleSettingsCommand(ctx: BotContext): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);

  if (!user) {
    await ctx.reply('Please start the bot first with /start');
    return;
  }

  const digestTimes = userService.getUserDigestTimes(user);

  await ctx.reply(formatSettingsMenu(user, digestTimes), {
    parse_mode: 'Markdown',
    reply_markup: createSettingsMenuKeyboard(),
  });
}

/**
 * Handle settings menu navigation.
 */
export async function handleSettingsNavigation(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);

  if (!user) {
    await ctx.answerCallbackQuery('Please start the bot first');
    return;
  }

  await ctx.answerCallbackQuery();
  const digestTimes = userService.getUserDigestTimes(user);

  switch (data) {
    case 'action:settings':
      await ctx.editMessageText(formatSettingsMenu(user, digestTimes), {
        parse_mode: 'Markdown',
        reply_markup: createSettingsMenuKeyboard(),
      });
      break;

    case 'settings:timezone':
      await ctx.editMessageText('🌍 *Select your timezone:*', {
        parse_mode: 'Markdown',
        reply_markup: createTimezoneKeyboard(),
      });
      break;

    case 'settings:digest':
      await ctx.editMessageText(
        '📋 *Digest Reminders*\n\n' +
        'Get reminders to review your goals throughout the day.\n' +
        `Current: ${digestTimes.length > 0 ? digestTimes.join(', ') : 'None'}\n\n` +
        'You can set up to 3 reminder times.',
        {
          parse_mode: 'Markdown',
          reply_markup: createDigestTimesKeyboard(digestTimes),
        }
      );
      break;

    case 'settings:progress_reminder':
      await ctx.editMessageText(
        '📝 *Progress Reminder*\n\n' +
        'Get reminded to log progress if you haven\'t yet today.\n' +
        `Current: ${user.progressReminderTime ?? 'Disabled'}`,
        {
          parse_mode: 'Markdown',
          reply_markup: createTimeSelectionKeyboard('evening'),
        }
      );
      break;

    case 'settings:reset':
      await ctx.editMessageText(
        '⚠️ *Reset All Data*\n\n' +
        '*This will permanently delete:*\n' +
        '• All your focus areas\n' +
        '• All progress history\n' +
        '• All reminder settings\n' +
        '• Your streak\n\n' +
        '❌ *This action cannot be undone!*\n\n' +
        'Are you absolutely sure?',
        {
          parse_mode: 'Markdown',
          reply_markup: createResetConfirmKeyboard(),
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

  if (!user || !data?.startsWith('timezone:')) {
    await ctx.answerCallbackQuery('Error');
    return;
  }

  await ctx.answerCallbackQuery();

  const timezone = data.replace('timezone:', '');

  if (timezone === 'custom') {
    await ctx.editMessageText(
      '📝 *Custom Timezone*\n\nSend your timezone in IANA format:\n\n_Examples: Europe/Berlin, Asia/Singapore_',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const validation = validateTimezone(timezone);

  if (!validation.success) {
    await ctx.reply(formatValidationError('Timezone', validation.error));
    return;
  }

  await userService.updateTimezone(user.id, timezone);

  const updatedUser = await userService.getUserById(user.id);
  if (updatedUser) {
    const digestTimes = userService.getUserDigestTimes(updatedUser);
    await ctx.editMessageText(
      formatSuccessMessage(`Timezone updated to ${timezone}`) +
        '\n\n' +
        formatSettingsMenu(updatedUser, digestTimes),
      {
        parse_mode: 'Markdown',
        reply_markup: createSettingsMenuKeyboard(),
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

  if (!user || !data?.startsWith('digest:')) {
    await ctx.answerCallbackQuery('Error');
    return;
  }

  await ctx.answerCallbackQuery();

  const action = data.replace('digest:', '');

  if (action === 'add') {
    await ctx.editMessageText(
      '➕ *Add Digest Time*\n\nSelect a time for your goals digest:',
      {
        parse_mode: 'Markdown',
        reply_markup: createTimeSelectionKeyboard('digest'),
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
        formatSuccessMessage(`Removed ${timeToRemove}`) +
          '\n\n📋 *Digest Reminders*\n' +
          `Current: ${digestTimes.length > 0 ? digestTimes.join(', ') : 'None'}`,
        {
          parse_mode: 'Markdown',
          reply_markup: createDigestTimesKeyboard(digestTimes),
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
        formatSuccessMessage('All digest times cleared') +
          '\n\n📋 *Digest Reminders*\nCurrent: None',
        {
          parse_mode: 'Markdown',
          reply_markup: createDigestTimesKeyboard([]),
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

  if (!user || !data?.startsWith('time:')) {
    await ctx.answerCallbackQuery('Error');
    return;
  }

  await ctx.answerCallbackQuery();

  const parts = data.split(':');
  const type = parts[1]; // 'morning', 'evening', or 'digest'
  const time = parts.slice(2).join(':'); // Handle HH:mm format

  if (time === 'custom') {
    await ctx.editMessageText(
      '⏰ *Custom Time*\n\nSend the time in HH:mm format:\n\n_Example: 07:30, 21:00_',
      { parse_mode: 'Markdown' }
    );
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
        formatSuccessMessage('Progress reminder disabled') +
          '\n\n' +
          formatSettingsMenu(updatedUser, digestTimes),
        {
          parse_mode: 'Markdown',
          reply_markup: createSettingsMenuKeyboard(),
        }
      );
    }
    return;
  }

  const validation = validateTime(time);

  if (!validation.success) {
    await ctx.reply(formatValidationError('Time', validation.error));
    return;
  }

  // Handle digest time addition
  if (type === 'digest' || type === 'morning') {
    const result = await userService.addDigestTime(user.id, time);

    if (!result.success) {
      await ctx.reply('⚠️ Maximum of 3 digest times reached. Remove one first.');
      return;
    }

    const digestTimes = userService.getUserDigestTimes(result.user);
    await ctx.editMessageText(
      formatSuccessMessage(`Digest time ${time} added`) +
        '\n\n📋 *Digest Reminders*\n' +
        `Current: ${digestTimes.join(', ')}`,
      {
        parse_mode: 'Markdown',
        reply_markup: createDigestTimesKeyboard(digestTimes),
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
        formatSuccessMessage(`Progress reminder set to ${time}`) +
          '\n\n' +
          formatSettingsMenu(updatedUser, digestTimes),
        {
          parse_mode: 'Markdown',
          reply_markup: createSettingsMenuKeyboard(),
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

  if (!user) {
    await ctx.answerCallbackQuery('Error');
    return;
  }

  await ctx.answerCallbackQuery();

  if (data === 'reset:confirm') {
    // Show second confirmation
    await ctx.editMessageText(
      '🚨 *FINAL WARNING*\n\n' +
      'You are about to DELETE ALL YOUR DATA.\n\n' +
      'Type "DELETE" to confirm, or press Cancel.',
      {
        parse_mode: 'Markdown',
        reply_markup: createSettingsMenuKeyboard(), // Just back button
      }
    );
    // The actual deletion will be handled by text input
    // For simplicity, we'll do it with a second button click
    return;
  }

  if (data === 'reset:execute') {
    await userService.fullReset(user.id);

    await ctx.editMessageText(
      '✅ *All data has been deleted*\n\n' +
      'Your account has been reset.\n' +
      'Use /start to begin again.',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Cancel - go back to settings
  const digestTimes = userService.getUserDigestTimes(user);
  await ctx.editMessageText(formatSettingsMenu(user, digestTimes), {
    parse_mode: 'Markdown',
    reply_markup: createSettingsMenuKeyboard(),
  });
}

/**
 * Handle all settings-related callbacks.
 */
export async function handleSettingsCallbacks(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (!data) return;

  if (data.startsWith('settings:') || data === 'action:settings') {
    await handleSettingsNavigation(ctx);
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
