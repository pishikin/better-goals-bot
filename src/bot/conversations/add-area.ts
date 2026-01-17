import type { BotContext, BotConversation } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import * as areasService from '../../services/areas.service.js';
import { getUserStatistics, getLastProgressDate } from '../../services/statistics.service.js';
import {
  validateAreaTitle,
  validateAreaBody,
  validateEmoji,
  VALIDATION_LIMITS,
} from '../utils/validators.js';
import {
  formatAreaCreated,
  formatPinnedMessage,
  formatValidationError,
  formatErrorMessage,
} from '../utils/message-formatter.js';
import { createMainMenuKeyboard } from '../keyboards/main-menu.keyboard.js';
import { InlineKeyboard } from 'grammy';

/**
 * Add area conversation flow.
 * Allows users to add a new focus area:
 * 1. Ask for title
 * 2. Ask for description (optional)
 * 3. Ask for emoji (optional)
 * 4. Save and update pinned message
 */
export async function addAreaConversation(
  conversation: BotConversation,
  ctx: BotContext
): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);

  // Get user
  const user = await conversation.external(() => userService.getUserByTelegramId(telegramId));

  if (!user) {
    await ctx.reply('Please start the bot first with /start');
    return;
  }

  // Check if user can add more areas
  const canAdd = await conversation.external(() => areasService.canAddArea(user.id));

  if (!canAdd) {
    await ctx.reply(
      formatErrorMessage(
        `You've reached the maximum of ${VALIDATION_LIMITS.MAX_AREAS_PER_USER} areas. Delete an existing area to add a new one.`
      ),
      {
        reply_markup: new InlineKeyboard()
          .text('✏️ Edit Areas', 'action:edit_areas')
          .text('← Back', 'action:back'),
      }
    );
    return;
  }

  // Step 1: Ask for title
  await ctx.reply(
    '📌 *New Focus Area*\n\nWhat life area do you want to add?\n\n_Examples: Career, Fitness, Relationships, Hobbies_',
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('❌ Cancel', 'action:cancel'),
    }
  );

  // Wait for title
  let title: string | null = null;

  while (!title) {
    const response = await conversation.waitFor([':text', 'callback_query:data']);

    if (response.callbackQuery?.data === 'action:cancel') {
      await response.answerCallbackQuery('Cancelled');
      await ctx.reply('❌ Area creation cancelled.');
      return;
    }

    if (response.message?.text) {
      const validation = validateAreaTitle(response.message.text);
      if (validation.success) {
        title = validation.data;
      } else {
        await ctx.reply(formatValidationError('Title', validation.error));
      }
    }
  }

  // Step 2: Ask for description (optional)
  await ctx.reply(
    `📝 *Description* (optional)\n\nAdd a short description for "${title}":`,
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('⏭ Skip', 'input:skip_body')
        .row()
        .text('❌ Cancel', 'action:cancel'),
    }
  );

  let body: string | undefined;
  let bodyDone = false;

  while (!bodyDone) {
    const response = await conversation.waitFor([':text', 'callback_query:data']);

    if (response.callbackQuery?.data === 'action:cancel') {
      await response.answerCallbackQuery('Cancelled');
      await ctx.reply('❌ Area creation cancelled.');
      return;
    }

    if (response.callbackQuery?.data === 'input:skip_body') {
      await response.answerCallbackQuery();
      bodyDone = true;
    } else if (response.message?.text) {
      const validation = validateAreaBody(response.message.text);
      if (validation.success) {
        body = validation.data;
        bodyDone = true;
      } else {
        await ctx.reply(formatValidationError('Description', validation.error));
      }
    }
  }

  // Step 3: Ask for emoji (optional)
  await ctx.reply(
    '😀 *Emoji* (optional)\n\nSend an emoji to represent this area:',
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('⏭ Skip', 'input:skip_emoji')
        .row()
        .text('❌ Cancel', 'action:cancel'),
    }
  );

  let emoji: string | undefined;
  let emojiDone = false;

  while (!emojiDone) {
    const response = await conversation.waitFor([':text', 'callback_query:data']);

    if (response.callbackQuery?.data === 'action:cancel') {
      await response.answerCallbackQuery('Cancelled');
      await ctx.reply('❌ Area creation cancelled.');
      return;
    }

    if (response.callbackQuery?.data === 'input:skip_emoji') {
      await response.answerCallbackQuery();
      emojiDone = true;
    } else if (response.message?.text) {
      const validation = validateEmoji(response.message.text);
      if (validation.success) {
        emoji = validation.data;
        emojiDone = true;
      } else {
        await ctx.reply('Please send a single emoji, or press Skip.');
      }
    }
  }

  // Step 4: Create the area
  const area = await conversation.external(() =>
    areasService.createArea(user.id, { title, body, emoji })
  );

  await ctx.reply(formatAreaCreated(area), { parse_mode: 'Markdown' });

  // Step 5: Update pinned message
  await updatePinnedMessage(conversation, ctx, user.id, user.timezone, user.pinnedMessageId);
}

/**
 * Helper to update the pinned message with current areas and stats.
 */
async function updatePinnedMessage(
  conversation: BotConversation,
  ctx: BotContext,
  userId: string,
  timezone: string,
  pinnedMessageId: bigint | null
): Promise<void> {
  const areas = await conversation.external(() => areasService.getUserAreas(userId));
  const stats = await conversation.external(() => getUserStatistics(userId, timezone));
  const lastProgress = await conversation.external(() => getLastProgressDate(userId));

  const messageText = formatPinnedMessage(areas, stats, lastProgress, timezone);

  if (pinnedMessageId) {
    // Try to edit existing pinned message
    try {
      await ctx.api.editMessageText(
        ctx.chat?.id ?? 0,
        Number(pinnedMessageId),
        messageText,
        { reply_markup: createMainMenuKeyboard() }
      );
    } catch {
      // If edit fails, send a new message
      const newMessage = await ctx.reply(messageText, {
        reply_markup: createMainMenuKeyboard(),
      });

      try {
        await ctx.pinChatMessage(newMessage.message_id, { disable_notification: true });
        await conversation.external(() =>
          userService.updatePinnedMessageId(userId, BigInt(newMessage.message_id))
        );
      } catch {
        // Pin might fail, that's okay
      }
    }
  } else {
    // No pinned message yet, create one
    const newMessage = await ctx.reply(messageText, {
      reply_markup: createMainMenuKeyboard(),
    });

    try {
      await ctx.pinChatMessage(newMessage.message_id, { disable_notification: true });
      await conversation.external(() =>
        userService.updatePinnedMessageId(userId, BigInt(newMessage.message_id))
      );
    } catch {
      // Pin might fail, that's okay
    }
  }
}
