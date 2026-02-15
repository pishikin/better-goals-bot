import { formatInTimeZone } from 'date-fns-tz';
import type { BotContext, Language } from '../../types/index.js';
import * as planService from '../../services/daily-plan.service.js';
import * as userService from '../../services/user.service.js';
import { formatTaskList } from '../../services/task.service.js';
import { createMainMenuKeyboard } from '../keyboards/main-menu.keyboard.js';

export type ExternalRunner = <T>(fn: () => Promise<T>) => Promise<T>;

interface PinnedPlanState {
  plan: planService.DailyPlanWithTasks | null;
  isTodayPlan: boolean;
}

const runDirectly: ExternalRunner = async <T>(fn: () => Promise<T>) => fn();

function isRussian(language: string): boolean {
  return language === 'ru';
}

function formatPlanDate(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'dd.MM.yyyy');
}

async function getPinnedPlanState(
  userId: string,
  timezone: string
): Promise<PinnedPlanState> {
  const todayPlan = await planService.getTodayPlan(userId, timezone);

  if (planService.isFilledPlan(todayPlan)) {
    return {
      plan: todayPlan,
      isTodayPlan: true,
    };
  }

  const fallbackPlan = await planService.getLatestFilledPlanBeforeToday(
    userId,
    timezone
  );

  return {
    plan: fallbackPlan,
    isTodayPlan: false,
  };
}

function formatPinnedPlanMessage(
  state: PinnedPlanState,
  timezone: string,
  language: Language
): string {
  const isRu = isRussian(language);
  const lines: string[] = [isRu ? '📌 ПЛАН ДНЯ' : '📌 DAILY PLAN', ''];

  if (state.plan && state.isTodayPlan) {
    lines.push(isRu ? '🗓 Сегодня:' : '🗓 Today:');
    lines.push(formatTaskList(state.plan.tasks));
    return lines.join('\n');
  }

  if (state.plan) {
    const dateLabel = formatPlanDate(state.plan.date, timezone);

    lines.push(
      isRu
        ? '🗓 На сегодня план еще не заполнен.'
        : "🗓 Today's plan is not filled yet."
    );
    lines.push(
      isRu
        ? `Показываю последний заполненный план (${dateLabel}):`
        : `Showing your latest filled plan (${dateLabel}):`
    );
    lines.push('');
    lines.push(formatTaskList(state.plan.tasks));
    return lines.join('\n');
  }

  lines.push(
    isRu
      ? 'На сегодня план еще не заполнен.\nСоздай его командой /plan.'
      : "Today's plan is not filled yet.\nCreate it with /plan."
  );

  return lines.join('\n');
}

export async function buildPinnedPlanMessage(
  userId: string,
  timezone: string,
  language: string,
  external?: ExternalRunner
): Promise<string> {
  const runExternal = external ?? runDirectly;
  const lang = (language === 'ru' ? 'ru' : 'en') as Language;
  const state = await runExternal(() => getPinnedPlanState(userId, timezone));
  return formatPinnedPlanMessage(state, timezone, lang);
}

interface SyncPinnedPlanOptions {
  userId: string;
  timezone: string;
  language: string;
  pinnedMessageId: bigint | null;
  external?: ExternalRunner;
}

/**
 * Keep pinned message in sync with today's plan.
 * If today's plan isn't filled yet, show the last previous filled one.
 */
export async function syncPinnedPlanMessage(
  ctx: BotContext,
  options: SyncPinnedPlanOptions
): Promise<void> {
  const runExternal = options.external ?? runDirectly;
  const messageText = await buildPinnedPlanMessage(
    options.userId,
    options.timezone,
    options.language,
    runExternal
  );
  const chatId = ctx.chat?.id ?? ctx.from?.id;

  if (!chatId) {
    return;
  }

  const keyboard = createMainMenuKeyboard(ctx.t);

  if (options.pinnedMessageId) {
    try {
      await ctx.api.editMessageText(chatId, Number(options.pinnedMessageId), messageText, {
        reply_markup: keyboard,
      });
      return;
    } catch {
      // Old pinned message may be deleted or inaccessible, create a new one below.
    }
  }

  try {
    const sent = await ctx.api.sendMessage(chatId, messageText, {
      reply_markup: keyboard,
    });

    try {
      await ctx.api.pinChatMessage(chatId, sent.message_id, {
        disable_notification: true,
      });
    } catch {
      // Pinning can fail if chat permissions are limited.
    }

    await runExternal(() =>
      userService.updatePinnedMessageId(options.userId, BigInt(sent.message_id))
    );
  } catch {
    // Ignore messaging errors to avoid breaking the calling flow.
  }
}
