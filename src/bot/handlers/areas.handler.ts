import type { BotContext } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import * as areasService from '../../services/areas.service.js';
import { getUserStatistics, getLastProgressDate } from '../../services/statistics.service.js';
import {
  formatAreasList,
  formatPinnedMessage,
  formatDeleteWarning,
  formatSuccessMessage,
} from '../utils/message-formatter.js';
import {
  createAreasListKeyboard,
  createAreaActionsKeyboard,
  createDeleteConfirmKeyboard,
  createAreasOverviewKeyboard,
} from '../keyboards/areas.keyboard.js';
import { createMainMenuKeyboard } from '../keyboards/main-menu.keyboard.js';

/**
 * Handle /areas command - show areas overview.
 */
export async function handleAreasCommand(ctx: BotContext): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);

  if (!user) {
    await ctx.reply('Please start the bot first with /start');
    return;
  }

  const areas = await areasService.getUserAreas(user.id);

  await ctx.reply(`📌 *Your Focus Areas*\n\n${formatAreasList(areas)}`, {
    parse_mode: 'Markdown',
    reply_markup: createAreasOverviewKeyboard(areas.length),
  });
}

/**
 * Handle edit areas action - show list for selection.
 */
export async function handleEditAreas(ctx: BotContext): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);

  if (!user) {
    await ctx.answerCallbackQuery('Please start the bot first');
    return;
  }

  const areas = await areasService.getUserAreas(user.id);

  if (areas.length === 0) {
    await ctx.editMessageText('No areas to edit. Add some first!', {
      reply_markup: createAreasOverviewKeyboard(0),
    });
    return;
  }

  await ctx.editMessageText('Select an area to edit:', {
    reply_markup: createAreasListKeyboard(areas, 'area:select'),
  });
}

/**
 * Handle area selection - show actions for selected area.
 */
export async function handleAreaSelect(ctx: BotContext, areaId: string): Promise<void> {
  const area = await areasService.getAreaById(areaId);

  if (!area) {
    await ctx.answerCallbackQuery('Area not found');
    return;
  }

  const emoji = area.emoji ?? '📌';
  const body = area.body ? `\n→ ${area.body}` : '';

  await ctx.editMessageText(`${emoji} *${area.title}*${body}\n\nWhat would you like to do?`, {
    parse_mode: 'Markdown',
    reply_markup: createAreaActionsKeyboard(areaId),
  });
}

/**
 * Handle delete area action - show confirmation.
 */
export async function handleDeleteArea(ctx: BotContext, areaId: string): Promise<void> {
  const area = await areasService.getAreaById(areaId);

  if (!area) {
    await ctx.answerCallbackQuery('Area not found');
    return;
  }

  await ctx.editMessageText(formatDeleteWarning(area), {
    reply_markup: createDeleteConfirmKeyboard(areaId),
  });
}

/**
 * Handle confirm delete - actually delete the area.
 */
export async function handleConfirmDelete(ctx: BotContext, areaId: string): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);

  if (!user) {
    await ctx.answerCallbackQuery('Please start the bot first');
    return;
  }

  const area = await areasService.getAreaById(areaId);

  if (!area) {
    await ctx.answerCallbackQuery('Area not found');
    return;
  }

  // Verify ownership
  if (area.userId !== user.id) {
    await ctx.answerCallbackQuery('Access denied');
    return;
  }

  await areasService.deleteArea(areaId);
  await ctx.answerCallbackQuery('Area deleted');

  // Update the message with remaining areas
  const areas = await areasService.getUserAreas(user.id);

  if (areas.length === 0) {
    await ctx.editMessageText(formatSuccessMessage('Area deleted.\n\nNo areas remaining.'), {
      reply_markup: createAreasOverviewKeyboard(0),
    });
  } else {
    await ctx.editMessageText(
      formatSuccessMessage('Area deleted.') + '\n\nRemaining areas:\n\n' + formatAreasList(areas),
      { reply_markup: createAreasOverviewKeyboard(areas.length) }
    );
  }

  // Update pinned message
  await updatePinnedMessage(ctx, user.id, user.timezone, user.pinnedMessageId);
}

/**
 * Handle area-related callback queries.
 */
export async function handleAreaCallbacks(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (!data?.startsWith('area:')) return;

  await ctx.answerCallbackQuery();

  const parts = data.split(':');
  const action = parts[1];
  const areaId = parts[2];

  switch (action) {
    case 'select':
      if (areaId) await handleAreaSelect(ctx, areaId);
      break;

    case 'delete':
      if (areaId) await handleDeleteArea(ctx, areaId);
      break;

    case 'confirm_delete':
      if (areaId) await handleConfirmDelete(ctx, areaId);
      break;

    case 'edit':
      // TODO: Implement edit conversation
      await ctx.reply('Edit functionality coming soon...');
      break;

    default:
      break;
  }
}

/**
 * Helper to update pinned message.
 */
async function updatePinnedMessage(
  ctx: BotContext,
  userId: string,
  timezone: string,
  pinnedMessageId: bigint | null
): Promise<void> {
  if (!pinnedMessageId) return;

  const areas = await areasService.getUserAreas(userId);
  const stats = await getUserStatistics(userId, timezone);
  const lastProgress = await getLastProgressDate(userId);

  const messageText = formatPinnedMessage(areas, stats, lastProgress, timezone);

  try {
    await ctx.api.editMessageText(ctx.chat?.id ?? 0, Number(pinnedMessageId), messageText, {
      reply_markup: createMainMenuKeyboard(),
    });
  } catch {
    // Edit might fail, that's okay
  }
}
