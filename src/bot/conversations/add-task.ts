import type { BotContext, BotConversation, Language } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import * as planService from '../../services/daily-plan.service.js';
import { passThroughGlobalInterruptIfAny } from './global-interrupts.js';
import {
  MAX_TASKS_PER_DAY,
  addTasksToPlan,
  formatTaskList,
  parseTasksFromMessage,
} from '../../services/task.service.js';
import { syncPinnedPlanMessage } from '../utils/pinned-plan.js';

function isRussian(language: string): boolean {
  return language === 'ru';
}

/**
 * Add task(s) into today's plan.
 */
export async function addTaskConversation(
  conversation: BotConversation,
  ctx: BotContext
): Promise<void> {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  const user = await conversation.external(() =>
    userService.getUserByTelegramId(telegramId)
  );

  if (!user) {
    await ctx.reply('Please run /start first.');
    return;
  }

  const language: Language = (user.language as Language) || 'en';
  const isRu = isRussian(language);
  const todayPlan = await conversation.external(() =>
    planService.getTodayPlan(user.id, user.timezone)
  );

  if (!todayPlan) {
    await ctx.reply(
      isRu
        ? 'Сначала создай план на сегодня через /plan.'
        : 'Create today\'s plan first using /plan.'
    );
    return;
  }

  if (todayPlan.tasks.length >= MAX_TASKS_PER_DAY) {
    await ctx.reply(
      isRu
        ? `В плане уже ${MAX_TASKS_PER_DAY} задач. Удали лишнюю через /remove N или перепиши план через /plan.`
        : `Your plan already has ${MAX_TASKS_PER_DAY} tasks. Remove one via /remove N or rewrite with /plan.`
    );
    return;
  }

  await ctx.reply(
    isRu
      ? `Отправь задачу (или несколько строками). Осталось слотов: ${MAX_TASKS_PER_DAY - todayPlan.tasks.length}`
      : `Send task text (or multiple lines). Remaining slots: ${MAX_TASKS_PER_DAY - todayPlan.tasks.length}`
  );

  const response = await conversation.waitFor(':text', {
    otherwise: async (otherCtx) => {
      await passThroughGlobalInterruptIfAny(conversation, otherCtx, {
        answerUnhandledCallback: true,
      });
    },
  });
  await passThroughGlobalInterruptIfAny(conversation, response);
  const rawText = response.message?.text ?? '';

  const parsed = parseTasksFromMessage(rawText);

  if (parsed.length === 0) {
    await ctx.reply(
      isRu
        ? 'Не удалось распознать задачи. Попробуй еще раз через /add.'
        : "Couldn't parse tasks. Try again with /add."
    );
    return;
  }

  const updatedTasks = await conversation.external(() =>
    addTasksToPlan(todayPlan.id, user.id, parsed)
  );

  await ctx.reply(
    isRu
      ? `✅ Задачи добавлены.\n\n${formatTaskList(updatedTasks)}`
      : `✅ Tasks added.\n\n${formatTaskList(updatedTasks)}`
  );

  await syncPinnedPlanMessage(ctx, {
    userId: user.id,
    timezone: user.timezone,
    language,
    pinnedMessageId: user.pinnedMessageId,
    external: (fn) => conversation.external(fn),
  });
}
