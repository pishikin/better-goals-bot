import type { BotContext, BotConversation } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import * as areasService from '../../services/areas.service.js';
import { getUserStatistics, getLastProgressDate } from '../../services/statistics.service.js';
import {
  validateAreaTitle,
  validateEmoji,
} from '../utils/validators.js';
import { formatPinnedMessage } from '../utils/message-formatter.js';
import { createMainMenuKeyboard } from '../keyboards/main-menu.keyboard.js';
import { createEditFieldKeyboard } from '../keyboards/areas.keyboard.js';
import { i18n } from '../middleware/i18n.js';
import { InlineKeyboard } from 'grammy';

type TranslateFn = (key: string, params?: Record<string, any>) => string;

/**
 * Edit area conversation flow.
 * Allows users to edit an existing focus area:
 * 1. Show options: edit title, body, or emoji
 * 2. Wait for selection
 * 3. Ask for new value
 * 4. Validate and save
 * 5. Update pinned message
 */
export async function editAreaConversation(
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

  const language = user.language || 'en';
  const t: TranslateFn = (key, params) => i18n.t(language, key, params);

  // Get areaId from callback data
  const callbackData = ctx.callbackQuery?.data;
  const areaId = callbackData?.split(':')[2];

  if (!areaId) {
    await ctx.reply(t('error-area-not-found'));
    return;
  }

  // Get the area
  const area = await conversation.external(() => areasService.getAreaById(areaId));

  if (!area) {
    await ctx.reply(t('error-area-not-found'));
    return;
  }

  // Verify ownership
  if (area.userId !== user.id) {
    await ctx.reply(t('error-access-denied'));
    return;
  }

  // Show what can be edited
  const emoji = area.emoji ?? '📌';
  const body = area.body ? `\n→ ${area.body}` : '';

  await ctx.editMessageText(
    `${emoji} *${area.title}*${body}\n\n${t('edit-area-what')}`,
    {
      parse_mode: 'Markdown',
      reply_markup: createEditFieldKeyboard(areaId, t),
    }
  );

  // Wait for field selection
  const fieldResponse = await conversation.waitFor('callback_query:data');
  const fieldAction = fieldResponse.callbackQuery.data;

  await fieldResponse.answerCallbackQuery();

  // Handle back button
  if (fieldAction === `area:select:${areaId}`) {
    return;
  }

  const updates: {
    title?: string;
    body?: string | null;
    emoji?: string | null;
  } = {};

  // Edit title
  if (fieldAction === `area:edit_title:${areaId}`) {
    await ctx.reply(t('edit-area-title-prompt'), {
      reply_markup: new InlineKeyboard().text(t('btn-cancel'), 'action:cancel'),
    });

    let newTitle: string | null = null;

    while (!newTitle) {
      const response = await conversation.waitFor([':text', 'callback_query:data']);

      if (response.callbackQuery?.data === 'action:cancel') {
        await response.answerCallbackQuery(t('msg-cancelled'));
        await ctx.reply(`❌ ${t('msg-cancelled')}`);
        return;
      }

      if (response.message?.text) {
        const validation = validateAreaTitle(response.message.text);
        if (validation.success) {
          newTitle = validation.data;
          updates.title = newTitle;
        } else {
          await ctx.reply(`⚠️ ${t('error-area-title-too-long')}`);
        }
      }
    }
  }

  // Edit body
  if (fieldAction === `area:edit_body:${areaId}`) {
    await ctx.reply(t('edit-area-body-prompt'), {
      reply_markup: new InlineKeyboard().text(t('btn-cancel'), 'action:cancel'),
    });

    let bodyDone = false;

    while (!bodyDone) {
      const response = await conversation.waitFor([':text', 'callback_query:data']);

      if (response.callbackQuery?.data === 'action:cancel') {
        await response.answerCallbackQuery(t('msg-cancelled'));
        await ctx.reply(`❌ ${t('msg-cancelled')}`);
        return;
      }

      if (response.message?.text) {
        const text = response.message.text;

        // Check for /remove command
        if (text === '/remove') {
          updates.body = null;
          bodyDone = true;
        } else {
          const trimmedText = text.trim();

          // Allow empty body (remove description)
          if (trimmedText.length === 0) {
            updates.body = null;
            bodyDone = true;
          } else if (trimmedText.length <= 200) {
            updates.body = trimmedText;
            bodyDone = true;
          } else {
            await ctx.reply(`⚠️ ${t('error-area-body-too-long')}`);
          }
        }
      }
    }
  }

  // Edit emoji
  if (fieldAction === `area:edit_emoji:${areaId}`) {
    await ctx.reply(t('edit-area-emoji-prompt'), {
      reply_markup: new InlineKeyboard().text(t('btn-cancel'), 'action:cancel'),
    });

    let emojiDone = false;

    while (!emojiDone) {
      const response = await conversation.waitFor([':text', 'callback_query:data']);

      if (response.callbackQuery?.data === 'action:cancel') {
        await response.answerCallbackQuery(t('msg-cancelled'));
        await ctx.reply(`❌ ${t('msg-cancelled')}`);
        return;
      }

      if (response.message?.text) {
        const text = response.message.text;

        // Check for /remove command
        if (text === '/remove') {
          updates.emoji = null;
          emojiDone = true;
        } else {
          const validation = validateEmoji(text);
          if (validation.success && validation.data) {
            updates.emoji = validation.data;
            emojiDone = true;
          } else {
            await ctx.reply(`⚠️ ${t('error-invalid-emoji')}`);
          }
        }
      }
    }
  }

  // Update the area only if there are changes
  if (Object.keys(updates).length > 0) {
    await conversation.external(() => areasService.updateArea(areaId, updates));
  }

  // Show success message
  await ctx.reply(`✅ ${t('edit-area-updated')}`);

  // Update pinned message
  await updatePinnedMessage(conversation, ctx, user.id, user.timezone, user.pinnedMessageId, language, t);
}

/**
 * Helper to update the pinned message with current areas and stats.
 */
async function updatePinnedMessage(
  conversation: BotConversation,
  ctx: BotContext,
  userId: string,
  timezone: string,
  pinnedMessageId: bigint | null,
  language: string,
  t: TranslateFn
): Promise<void> {
  const areas = await conversation.external(() => areasService.getUserAreas(userId));
  const stats = await conversation.external(() => getUserStatistics(userId, timezone));
  const lastProgress = await conversation.external(() => getLastProgressDate(userId));

  const messageText = formatPinnedMessage(areas, stats, lastProgress, timezone, language);

  if (pinnedMessageId) {
    // Try to edit existing pinned message
    try {
      await ctx.api.editMessageText(
        ctx.chat?.id ?? 0,
        Number(pinnedMessageId),
        messageText,
        { reply_markup: createMainMenuKeyboard(t) }
      );
    } catch {
      // If edit fails, send a new message
      const newMessage = await ctx.reply(messageText, {
        reply_markup: createMainMenuKeyboard(t),
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
      reply_markup: createMainMenuKeyboard(t),
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
