import type { BotContext, BotConversation, Language } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import * as areasService from '../../services/areas.service.js';
import { getUserStatistics, getLastProgressDate } from '../../services/statistics.service.js';
import {
  validateAreaTitle,
  validateAreaBody,
  validateEmoji,
} from '../utils/validators.js';
import { formatPinnedMessage } from '../utils/message-formatter.js';
import { createMainMenuKeyboard } from '../keyboards/main-menu.keyboard.js';
import { InlineKeyboard } from 'grammy';
import { i18n } from '../../locales/index.js';

type TranslateFn = (key: string, params?: Record<string, any>) => string;

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
    await ctx.reply(i18n.t('en', 'error-please-start'));
    return;
  }

  const language: Language = (user.language as Language) || 'en';
  const t: TranslateFn = (key, params) => i18n.t(language, key, params);

  // Check if user can add more areas
  const canAdd = await conversation.external(() => areasService.canAddArea(user.id));

  if (!canAdd) {
    await ctx.reply(
      `❌ ${t('error-max-areas')}`,
      {
        reply_markup: new InlineKeyboard()
          .text(t('btn-edit-areas'), 'action:edit_areas')
          .text(t('btn-back'), 'action:back'),
      }
    );
    return;
  }

  // Step 1: Ask for title
  await ctx.reply(t('add-area-start') + '\n\n' + t('add-area-title-prompt'), {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard().text(t('btn-cancel'), 'action:cancel'),
  });

  // Wait for title
  let title: string | null = null;

  while (!title) {
    const response = await conversation.waitFor([':text', 'callback_query:data']);

    if (response.callbackQuery?.data === 'action:cancel') {
      await response.answerCallbackQuery(t('msg-cancelled'));
      await ctx.reply(`❌ ${t('msg-cancelled')}`);
      return;
    }

    if (response.message?.text) {
      const validation = validateAreaTitle(response.message.text);
      if (validation.success) {
        title = validation.data;
      } else {
        await ctx.reply(`⚠️ ${t('error-area-title-too-long')}`);
      }
    }
  }

  // Step 2: Ask for description (optional)
  await ctx.reply(t('add-area-body-prompt'), {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text(t('btn-skip'), 'input:skip_body')
      .row()
      .text(t('btn-cancel'), 'action:cancel'),
  });

  let body: string | undefined;
  let bodyDone = false;

  while (!bodyDone) {
    const response = await conversation.waitFor([':text', 'callback_query:data']);

    if (response.callbackQuery?.data === 'action:cancel') {
      await response.answerCallbackQuery(t('msg-cancelled'));
      await ctx.reply(`❌ ${t('msg-cancelled')}`);
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
        await ctx.reply(`⚠️ ${t('error-area-body-too-long')}`);
      }
    }
  }

  // Step 3: Ask for emoji (optional)
  await ctx.reply(t('add-area-emoji-prompt'), {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text(t('btn-skip'), 'input:skip_emoji')
      .row()
      .text(t('btn-cancel'), 'action:cancel'),
  });

  let emoji: string | undefined;
  let emojiDone = false;

  while (!emojiDone) {
    const response = await conversation.waitFor([':text', 'callback_query:data']);

    if (response.callbackQuery?.data === 'action:cancel') {
      await response.answerCallbackQuery(t('msg-cancelled'));
      await ctx.reply(`❌ ${t('msg-cancelled')}`);
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
        await ctx.reply(`⚠️ ${t('btn-skip')}`);
      }
    }
  }

  // Step 4: Create the area
  const area = await conversation.external(() =>
    areasService.createArea(user.id, { title, body, emoji })
  );

  // Show confirmation
  const areaEmoji = area.emoji ?? '✓';
  await ctx.reply(
    t('add-area-success', { emoji: areaEmoji, title: area.title, body: area.body ?? 'none' }),
    { parse_mode: 'Markdown' }
  );

  // Step 5: Update pinned message
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
