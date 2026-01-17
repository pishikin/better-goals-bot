import type { BotContext, BotConversation } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import * as areasService from '../../services/areas.service.js';
import { getUserStatistics, getLastProgressDate } from '../../services/statistics.service.js';
import {
  validateAreaTitle,
  validateAreaBody,
  validateEmoji,
  validateTimezone,
  validateTime,
  VALIDATION_LIMITS,
} from '../utils/validators.js';
import {
  formatWelcomeMessage,
  formatOnboardingComplete,
  formatAreaCreated,
  formatPinnedMessage,
  formatValidationError,
} from '../utils/message-formatter.js';
import { createMainMenuKeyboard } from '../keyboards/main-menu.keyboard.js';
import { createAddMoreAreasKeyboard } from '../keyboards/areas.keyboard.js';
import { createTimezoneKeyboard, createTimeSelectionKeyboard } from '../keyboards/settings.keyboard.js';
import { InlineKeyboard } from 'grammy';

/**
 * Onboarding conversation flow.
 * Guides new users through initial setup:
 * 1. Welcome message
 * 2. Add focus areas (1-7)
 * 3. Select timezone
 * 4. Configure reminders (optional)
 * 5. Create pinned message
 */
export async function onboardingConversation(
  conversation: BotConversation,
  ctx: BotContext
): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);

  // Get or create user
  const user = await conversation.external(() => userService.getOrCreateUser(telegramId));

  // Step 1: Welcome message
  await ctx.reply(formatWelcomeMessage(), { parse_mode: 'Markdown' });

  // Step 2: Add focus areas
  let areasCount = 0;
  let continueAddingAreas = true;

  while (continueAddingAreas && areasCount < VALIDATION_LIMITS.MAX_AREAS_PER_USER) {
    // Prompt for area title
    const titlePrompt = areasCount === 0
      ? '📌 *First area*\n\nWhat life area do you want to focus on?\n\n_Examples: Work, Health, Learning, Family_'
      : '📌 *Add another area*\n\nWhat other area matters to you?';

    await ctx.reply(titlePrompt, {
      parse_mode: 'Markdown',
      reply_markup: areasCount > 0
        ? new InlineKeyboard().text('✅ Done adding areas', 'onboarding:done_areas')
        : undefined,
    });

    // Wait for title or "done" button
    const titleResponse = await conversation.waitFor([':text', 'callback_query:data']);

    if (titleResponse.callbackQuery?.data === 'onboarding:done_areas') {
      await titleResponse.answerCallbackQuery();
      continueAddingAreas = false;
      break;
    }

    const titleText = titleResponse.message?.text ?? '';
    const titleValidation = validateAreaTitle(titleText);

    if (!titleValidation.success) {
      await ctx.reply(formatValidationError('Title', titleValidation.error));
      continue;
    }

    // Ask for description (optional)
    await ctx.reply(
      `📝 *Description* (optional)\n\nAdd a short description for "${titleValidation.data}":\n\n_Example: Frontend dev and team management_`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('⏭ Skip', 'input:skip_body'),
      }
    );

    const bodyResponse = await conversation.waitFor([':text', 'callback_query:data']);
    let bodyText: string | undefined;

    if (bodyResponse.callbackQuery?.data === 'input:skip_body') {
      await bodyResponse.answerCallbackQuery();
    } else if (bodyResponse.message?.text) {
      const bodyValidation = validateAreaBody(bodyResponse.message.text);
      if (bodyValidation.success) {
        bodyText = bodyValidation.data;
      }
    }

    // Ask for emoji (optional)
    await ctx.reply(
      '😀 *Emoji* (optional)\n\nSend an emoji to represent this area:',
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('⏭ Skip', 'input:skip_emoji'),
      }
    );

    const emojiResponse = await conversation.waitFor([':text', 'callback_query:data']);
    let emojiText: string | undefined;

    if (emojiResponse.callbackQuery?.data === 'input:skip_emoji') {
      await emojiResponse.answerCallbackQuery();
    } else if (emojiResponse.message?.text) {
      const emojiValidation = validateEmoji(emojiResponse.message.text);
      if (emojiValidation.success) {
        emojiText = emojiValidation.data;
      }
    }

    // Create the area
    const area = await conversation.external(() =>
      areasService.createArea(user.id, {
        title: titleValidation.data,
        body: bodyText,
        emoji: emojiText,
      })
    );

    areasCount++;

    // Show confirmation and ask to add more
    await ctx.reply(formatAreaCreated(area), { parse_mode: 'Markdown' });

    if (areasCount < VALIDATION_LIMITS.MAX_AREAS_PER_USER) {
      await ctx.reply(
        `You have ${areasCount} area${areasCount > 1 ? 's' : ''}. Add more?`,
        { reply_markup: createAddMoreAreasKeyboard(areasCount) }
      );

      const addMoreResponse = await conversation.waitFor('callback_query:data');
      await addMoreResponse.answerCallbackQuery();

      if (addMoreResponse.callbackQuery.data === 'onboarding:done_areas') {
        continueAddingAreas = false;
      }
    } else {
      await ctx.reply(`You've reached the maximum of ${VALIDATION_LIMITS.MAX_AREAS_PER_USER} areas.`);
      continueAddingAreas = false;
    }
  }

  // Step 3: Timezone selection
  await ctx.reply(
    '🌍 *Timezone*\n\nSelect your timezone for accurate reminders:',
    {
      parse_mode: 'Markdown',
      reply_markup: createTimezoneKeyboard(),
    }
  );

  let timezone = 'UTC';
  let timezoneSet = false;

  while (!timezoneSet) {
    const tzResponse = await conversation.waitFor([':text', 'callback_query:data']);

    if (tzResponse.callbackQuery?.data) {
      await tzResponse.answerCallbackQuery();

      if (tzResponse.callbackQuery.data === 'timezone:custom') {
        await ctx.reply(
          'Type your timezone in IANA format:\n\n_Example: Europe/Berlin, Asia/Singapore, America/Los_Angeles_',
          { parse_mode: 'Markdown' }
        );
        continue;
      }

      if (tzResponse.callbackQuery.data.startsWith('timezone:')) {
        timezone = tzResponse.callbackQuery.data.replace('timezone:', '');
        timezoneSet = true;
      }
    } else if (tzResponse.message?.text) {
      const tzValidation = validateTimezone(tzResponse.message.text);
      if (tzValidation.success) {
        timezone = tzValidation.data;
        timezoneSet = true;
      } else {
        await ctx.reply(formatValidationError('Timezone', tzValidation.error));
      }
    }
  }

  await conversation.external(() => userService.updateTimezone(user.id, timezone));
  await ctx.reply(`✅ Timezone set to ${timezone}`);

  // Step 4: Digest reminder (optional)
  await ctx.reply(
    '📋 *Goals Digest*\n\nWant daily reminders to review your goals? (up to 3 times/day)',
    {
      parse_mode: 'Markdown',
      reply_markup: createTimeSelectionKeyboard('morning'),
    }
  );

  const digestResponse = await conversation.waitFor('callback_query:data');
  await digestResponse.answerCallbackQuery();

  let digestTime: string | null = null;
  const digestData = digestResponse.callbackQuery.data;

  if (digestData === 'time:morning:disable' || digestData === 'action:settings') {
    // Skip digest
  } else if (digestData === 'time:morning:custom') {
    await ctx.reply('Enter time in HH:mm format (e.g., 09:00):');
    const customTime = await conversation.waitFor(':text');
    const timeValidation = validateTime(customTime.message?.text ?? '');
    if (timeValidation.success) {
      digestTime = timeValidation.data;
    }
  } else if (digestData.startsWith('time:morning:')) {
    digestTime = digestData.replace('time:morning:', '');
  }

  if (digestTime) {
    await conversation.external(() => userService.addDigestTime(user.id, digestTime as string));
    await ctx.reply(`✅ Digest reminder set to ${digestTime}`);
  }

  // Step 5: Progress reminder (optional)
  await ctx.reply(
    '📝 *Progress Reminder*\n\nGet reminded to log your progress if you haven\'t yet?',
    {
      parse_mode: 'Markdown',
      reply_markup: createTimeSelectionKeyboard('evening'),
    }
  );

  const reminderResponse = await conversation.waitFor('callback_query:data');
  await reminderResponse.answerCallbackQuery();

  let reminderTime: string | null = null;
  const reminderData = reminderResponse.callbackQuery.data;

  if (reminderData === 'time:evening:disable' || reminderData === 'action:settings') {
    // Skip reminder
  } else if (reminderData === 'time:evening:custom') {
    await ctx.reply('Enter time in HH:mm format (e.g., 21:00):');
    const customTime = await conversation.waitFor(':text');
    const timeValidation = validateTime(customTime.message?.text ?? '');
    if (timeValidation.success) {
      reminderTime = timeValidation.data;
    }
  } else if (reminderData.startsWith('time:evening:')) {
    reminderTime = reminderData.replace('time:evening:', '');
  }

  if (reminderTime) {
    await conversation.external(() => userService.updateProgressReminderTime(user.id, reminderTime));
    await ctx.reply(`✅ Progress reminder set to ${reminderTime}`);
  }

  // Step 6: Complete onboarding
  await conversation.external(() => userService.completeOnboarding(user.id));

  // Step 7: Create and pin the summary message
  const areas = await conversation.external(() => areasService.getUserAreas(user.id));
  const stats = await conversation.external(() => getUserStatistics(user.id, timezone));
  const lastProgress = await conversation.external(() => getLastProgressDate(user.id));

  const pinnedMessage = formatPinnedMessage(areas, stats, lastProgress, timezone);
  const sentMessage = await ctx.reply(pinnedMessage, {
    reply_markup: createMainMenuKeyboard(),
  });

  // Try to pin the message
  try {
    await ctx.pinChatMessage(sentMessage.message_id, { disable_notification: true });
    await conversation.external(() =>
      userService.updatePinnedMessageId(user.id, BigInt(sentMessage.message_id))
    );
  } catch {
    // Pinning might fail if bot doesn't have permission, that's okay
  }

  // Final message
  await ctx.reply(formatOnboardingComplete(areasCount), { parse_mode: 'Markdown' });
}
