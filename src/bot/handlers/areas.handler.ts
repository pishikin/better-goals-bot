import type { BotContext } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import * as areasService from '../../services/areas.service.js';
import {
  createAreasListKeyboard,
  createAreaActionsKeyboard,
  createDeleteConfirmKeyboard,
  createAreasOverviewKeyboard,
} from '../keyboards/areas.keyboard.js';
import { syncPinnedPlanMessage } from '../utils/pinned-plan.js';

type TranslateFn = (key: string, params?: Record<string, any>) => string;

/**
 * Format areas list using i18n.
 */
function formatAreasListLocalized(
  areas: { emoji: string | null; title: string; body: string | null }[],
  t: TranslateFn
): string {
  if (areas.length === 0) {
    return t('areas-empty');
  }

  return areas
    .map((area, index) => {
      const emoji = area.emoji ?? '•';
      const title = area.title;
      const body = area.body;

      if (body) {
        return `${index + 1}. ${emoji} ${title}\n   → ${body}`;
      } else {
        return `${index + 1}. ${emoji} ${title}`;
      }
    })
    .join('\n\n');
}

/**
 * Handle /areas command - show areas overview.
 */
export async function handleAreasCommand(ctx: BotContext): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);
  const t: TranslateFn = (key, params) => ctx.t(key, params);

  if (!user) {
    await ctx.reply(t('error-please-start'));
    return;
  }

  const areas = await areasService.getUserAreas(user.id);
  const areasText = formatAreasListLocalized(areas, t);

  await ctx.reply(`${t('areas-title')}\n\n${areasText}`, {
    reply_markup: createAreasOverviewKeyboard(areas.length, t),
  });
}

/**
 * Handle edit areas action - show list for selection.
 */
export async function handleEditAreas(ctx: BotContext): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);
  const t: TranslateFn = (key, params) => ctx.t(key, params);

  if (!user) {
    await ctx.answerCallbackQuery(t('error-please-start'));
    return;
  }

  const areas = await areasService.getUserAreas(user.id);

  if (areas.length === 0) {
    await ctx.editMessageText(t('areas-no-areas-to-edit'), {
      reply_markup: createAreasOverviewKeyboard(0, t),
    });
    return;
  }

  await ctx.editMessageText(t('areas-select-to-edit'), {
    reply_markup: createAreasListKeyboard(areas, 'area:select', t),
  });
}

/**
 * Handle area selection - show actions for selected area.
 */
export async function handleAreaSelect(ctx: BotContext, areaId: string): Promise<void> {
  const t: TranslateFn = (key, params) => ctx.t(key, params);
  const area = await areasService.getAreaById(areaId);

  if (!area) {
    await ctx.answerCallbackQuery(t('error-area-not-found'));
    return;
  }

  const emoji = area.emoji ?? '📌';
  const body = area.body ? `\n→ ${area.body}` : '';

  await ctx.editMessageText(`${emoji} *${area.title}*${body}\n\n${t('areas-what-to-do')}`, {
    parse_mode: 'Markdown',
    reply_markup: createAreaActionsKeyboard(areaId, t),
  });
}

/**
 * Handle delete area action - show confirmation.
 */
export async function handleDeleteArea(ctx: BotContext, areaId: string): Promise<void> {
  const t: TranslateFn = (key, params) => ctx.t(key, params);
  const area = await areasService.getAreaById(areaId);

  if (!area) {
    await ctx.answerCallbackQuery(t('error-area-not-found'));
    return;
  }

  await ctx.editMessageText(t('delete-area-confirm', { title: area.title }), {
    reply_markup: createDeleteConfirmKeyboard(areaId, t),
  });
}

/**
 * Handle confirm delete - actually delete the area.
 */
export async function handleConfirmDelete(ctx: BotContext, areaId: string): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await userService.getUserByTelegramId(telegramId);
  const t: TranslateFn = (key, params) => ctx.t(key, params);

  if (!user) {
    await ctx.answerCallbackQuery(t('error-please-start'));
    return;
  }

  const area = await areasService.getAreaById(areaId);

  if (!area) {
    await ctx.answerCallbackQuery(t('error-area-not-found'));
    return;
  }

  // Verify ownership
  if (area.userId !== user.id) {
    await ctx.answerCallbackQuery(t('error-access-denied'));
    return;
  }

  await areasService.deleteArea(areaId);
  await ctx.answerCallbackQuery(t('areas-deleted-success'));

  // Update the message with remaining areas
  const areas = await areasService.getUserAreas(user.id);

  if (areas.length === 0) {
    await ctx.editMessageText(`✅ ${t('areas-deleted-no-remaining')}`, {
      reply_markup: createAreasOverviewKeyboard(0, t),
    });
  } else {
    const areasText = formatAreasListLocalized(areas, t);
    await ctx.editMessageText(
      `✅ ${t('areas-deleted-success')}\n\n${t('areas-remaining')}\n\n${areasText}`,
      { reply_markup: createAreasOverviewKeyboard(areas.length, t) }
    );
  }

  // Update pinned message
  await updatePinnedMessage(ctx, user.id, user.timezone, user.pinnedMessageId, user.language);
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
      if (areaId) await ctx.conversation.enter('editArea');
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
  pinnedMessageId: bigint | null,
  language: string = 'en'
): Promise<void> {
  await syncPinnedPlanMessage(ctx, {
    userId,
    timezone,
    language,
    pinnedMessageId,
  });
}
