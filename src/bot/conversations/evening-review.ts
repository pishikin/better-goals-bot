import { InlineKeyboard } from 'grammy';
import { isSameDay } from 'date-fns';
import type { BotContext, BotConversation, Language } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import * as planService from '../../services/daily-plan.service.js';
import { passThroughGlobalInterruptIfAny } from './global-interrupts.js';
import {
  TASK_STATUSES,
  formatTaskList,
  getPlanTasks,
  markTaskStatus,
  summarizeTaskStatuses,
  type TaskStatus,
} from '../../services/task.service.js';
import { syncPinnedPlanMessage } from '../utils/pinned-plan.js';

function isRussian(language: string): boolean {
  return language === 'ru';
}

function createReviewKeyboard(taskId: string, language: Language): InlineKeyboard {
  const isRu = isRussian(language);
  return new InlineKeyboard()
    .text(
      isRu ? '✅ Сделано' : '✅ Done',
      `review:task:${taskId}:${TASK_STATUSES.DONE}`
    )
    .text(
      isRu ? '🕓 В процессе → завтра' : '🕓 In progress → tomorrow',
      `review:task:${taskId}:${TASK_STATUSES.IN_PROGRESS}`
    )
    .row()
    .text(
      isRu ? '❌ Не сделано' : '❌ Not done',
      `review:task:${taskId}:${TASK_STATUSES.SKIPPED}`
    );
}

async function waitForTaskStatus(
  conversation: BotConversation,
  taskId: string
): Promise<TaskStatus> {
  while (true) {
    const callback = await conversation.waitFor('callback_query:data', {
      otherwise: async (otherCtx) => {
        await passThroughGlobalInterruptIfAny(conversation, otherCtx);
      },
    });

    await passThroughGlobalInterruptIfAny(conversation, callback);
    const data = callback.callbackQuery?.data ?? '';
    await callback.answerCallbackQuery();

    const prefix = `review:task:${taskId}:`;
    if (!data.startsWith(prefix)) {
      continue;
    }

    const status = data.slice(prefix.length);
    if (
      status === TASK_STATUSES.DONE ||
      status === TASK_STATUSES.IN_PROGRESS ||
      status === TASK_STATUSES.SKIPPED
    ) {
      return status;
    }
  }
}

/**
 * Evening review flow for today's plan (or provided target date).
 */
export async function eveningReviewConversation(
  conversation: BotConversation,
  ctx: BotContext,
  targetDateIso?: string
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
  const today = planService.getTodayInTimezone(user.timezone);
  const targetDate = targetDateIso ? new Date(targetDateIso) : today;

  const plan = await conversation.external(() =>
    planService.getPlanForDate(user.id, targetDate)
  );

  if (
    !plan ||
    plan.status === planService.PLAN_STATUSES.DRAFT ||
    plan.tasks.length === 0
  ) {
    await ctx.reply(
      isRu
        ? 'Нет подтвержденного плана с задачами для подбивки.'
        : 'No confirmed plan with tasks to review.'
    );
    return;
  }

  await conversation.external(() => planService.markReviewStarted(plan.id));

  await ctx.reply(
    isRu
      ? `🌙 Время подвести итоги дня.\n\nТекущий план:\n${formatTaskList(plan.tasks)}\n\nВыбери статус для каждой задачи.`
      : `🌙 Time to review today's tasks.\n\nCurrent plan:\n${formatTaskList(plan.tasks)}\n\nChoose a status for each task.`
  );

  for (let i = 0; i < plan.tasks.length; i++) {
    const task = plan.tasks[i];
    const prompt = isRu
      ? `Задача ${i + 1}/${plan.tasks.length}:\n${task.text}`
      : `Task ${i + 1}/${plan.tasks.length}:\n${task.text}`;

    await ctx.reply(prompt, {
      reply_markup: createReviewKeyboard(task.id, language),
    });

    const status = await waitForTaskStatus(conversation, task.id);
    await conversation.external(() => markTaskStatus(task.id, status));
  }

  await conversation.external(() => planService.markReviewed(plan.id));

  const updatedTasks = await conversation.external(() => getPlanTasks(plan.id));
  const summary = summarizeTaskStatuses(updatedTasks);
  const streak = await conversation.external(() =>
    planService.calculateActiveDayStreak(user.id, user.timezone)
  );

  const summaryText = isRu
    ? [
        '✅ Итоги дня:',
        `• Всего задач: ${summary.total}`,
        `• Выполнено: ${summary.done}`,
        `• В процессе: ${summary.inProgress}`,
        `• Не сделано: ${summary.skipped + summary.pending}`,
        '',
        `🔥 Текущий streak: ${streak}`,
        '',
        formatTaskList(updatedTasks),
      ].join('\n')
    : [
        '✅ Day summary:',
        `• Total tasks: ${summary.total}`,
        `• Done: ${summary.done}`,
        `• In progress: ${summary.inProgress}`,
        `• Not done: ${summary.skipped + summary.pending}`,
        '',
        `🔥 Current streak: ${streak}`,
        '',
        formatTaskList(updatedTasks),
      ].join('\n');

  await syncPinnedPlanMessage(ctx, {
    userId: user.id,
    timezone: user.timezone,
    language,
    pinnedMessageId: user.pinnedMessageId,
    external: (fn) => conversation.external(fn),
  });

  const isReviewingToday = isSameDay(targetDate, today);

  if (isReviewingToday) {
    await ctx.reply(summaryText, {
      reply_markup: new InlineKeyboard().text(
        isRu ? '🗓 Запланировать завтра' : '🗓 Plan tomorrow',
        'plan:start:tomorrow'
      ),
    });
    return;
  }

  const yesterday = planService.shiftDateInTimezone(today, user.timezone, -1);
  const isReviewingYesterday = isSameDay(targetDate, yesterday);

  if (isReviewingYesterday) {
    await ctx.reply(summaryText, {
      reply_markup: new InlineKeyboard().text(
        isRu ? '☀️ Перейти к плану на сегодня' : '☀️ Plan today',
        'plan:start'
      ),
    });
    return;
  }

  await ctx.reply(summaryText);
}
