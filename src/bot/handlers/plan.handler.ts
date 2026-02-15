import { InlineKeyboard } from 'grammy';
import type { BotContext, Language } from '../../types/index.js';
import { isDev } from '../../config/env.js';
import * as userService from '../../services/user.service.js';
import * as planService from '../../services/daily-plan.service.js';
import * as taskService from '../../services/task.service.js';
import {
  formatCalendarWeekStatsMessage,
  getCalendarWeekStats,
} from '../../services/weekly-stats.service.js';
import { syncPinnedPlanMessage } from '../utils/pinned-plan.js';

type PlanTarget = 'today' | 'tomorrow';
type ReminderSimulationMode = 'morning' | 'day' | 'evening' | 'all';

function isRussian(language: string): boolean {
  return language === 'ru';
}

async function getCurrentUser(ctx: BotContext) {
  const telegramId = BigInt(ctx.from?.id ?? 0);
  return userService.getUserByTelegramId(telegramId);
}

function parseCommandArgument(text: string, command: string): string {
  const regex = new RegExp(`^\\/${command}(?:@\\w+)?\\s*`, 'i');
  return text.replace(regex, '').trim();
}

function resolvePlanTarget(argument: string): PlanTarget | null {
  if (!argument) {
    return 'today';
  }

  const normalized = argument.trim().toLowerCase();

  if (['today', 'tod', 'сегодня'].includes(normalized)) {
    return 'today';
  }

  if (['tomorrow', 'tmr', 'tom', 'завтра'].includes(normalized)) {
    return 'tomorrow';
  }

  return null;
}

function parseSimulationMode(argument: string): ReminderSimulationMode | null {
  if (!argument) {
    return 'all';
  }

  const normalized = argument.trim().toLowerCase();

  if (['all', 'все', 'всё'].includes(normalized)) {
    return 'all';
  }

  if (['morning', 'утро'].includes(normalized)) {
    return 'morning';
  }

  if (['day', 'день', 'daily'].includes(normalized)) {
    return 'day';
  }

  if (['evening', 'вечер'].includes(normalized)) {
    return 'evening';
  }

  return null;
}

async function sendSimulatedMorningReminder(
  ctx: BotContext,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  isRu: boolean
): Promise<string> {
  const todayPlan = await planService.getTodayPlan(user.id, user.timezone);
  if (
    todayPlan &&
    todayPlan.status !== planService.PLAN_STATUSES.DRAFT
  ) {
    return isRu
      ? 'утро: пропуск, план на сегодня уже есть'
      : 'morning: skipped, today plan already exists';
  }

  const yesterdayPlan = await planService.getYesterdayPlan(user.id, user.timezone);
  if (
    yesterdayPlan &&
    yesterdayPlan.status !== planService.PLAN_STATUSES.REVIEWED &&
    yesterdayPlan.status !== planService.PLAN_STATUSES.DRAFT
  ) {
    await ctx.reply(
      isRu
        ? '🧪 Симуляция: утреннее напоминание по пропущенной подбивке.\n\nВчерашняя подбивка не завершена. Хочешь быстро подвести итоги вчерашнего дня?'
        : "🧪 Simulation: morning fallback reminder.\n\nYesterday's review was missed. Do you want to quickly review yesterday now?",
      {
        reply_markup: new InlineKeyboard().text(
          isRu ? '🌙 Подбить вчера' : '🌙 Review yesterday',
          'review:start:yesterday'
        ),
      }
    );
  }

  await ctx.reply(
    isRu
      ? `🧪 Симуляция: утреннее напоминание.\n\n☀️ Доброе утро! Давай составим план на сегодня (до ${taskService.MAX_TASKS_PER_DAY} задач).`
      : `🧪 Simulation: morning reminder.\n\n☀️ Good morning! Let's create today's plan (up to ${taskService.MAX_TASKS_PER_DAY} tasks).`,
    {
      reply_markup: new InlineKeyboard().text(
        isRu ? '🗓 Составить план' : '🗓 Plan today',
        'plan:start'
      ),
    }
  );

  return isRu ? 'утро: отправлено' : 'morning: sent';
}

async function sendSimulatedDayReminder(
  ctx: BotContext,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  isRu: boolean
): Promise<string> {
  const todayPlan = await planService.getTodayPlan(user.id, user.timezone);
  if (
    !todayPlan ||
    todayPlan.status === planService.PLAN_STATUSES.DRAFT ||
    todayPlan.tasks.length === 0
  ) {
    return isRu
      ? 'день: пропуск, нет подтвержденного плана с задачами'
      : 'day: skipped, no confirmed plan with tasks';
  }

  const remaining = todayPlan.tasks.filter(
    (task) =>
      task.status !== taskService.TASK_STATUSES.DONE &&
      task.status !== taskService.TASK_STATUSES.SKIPPED
  );

  const reminderMessage = isRu
    ? remaining.length > 0
      ? `🧪 Симуляция: дневное напоминание.\n\n📌 Напоминание о задачах: осталось ${remaining.length}.\n\n${remaining
          .slice(0, 3)
          .map((task, index) => `${index + 1}. ${task.text}`)
          .join('\n')}`
      : '🧪 Симуляция: дневное напоминание.\n\n📌 Напоминание: по плану на сегодня уже всё закрыто. Отлично!'
    : remaining.length > 0
      ? `🧪 Simulation: daytime reminder.\n\n📌 Task reminder: ${remaining.length} remaining.\n\n${remaining
          .slice(0, 3)
          .map((task, index) => `${index + 1}. ${task.text}`)
          .join('\n')}`
      : '🧪 Simulation: daytime reminder.\n\n📌 Reminder: your plan for today is already completed. Great job!';

  await ctx.reply(reminderMessage, {
    reply_markup: new InlineKeyboard()
      .text(isRu ? '📋 Открыть план' : '📋 Open plan', 'plan:start')
      .text(isRu ? '🌙 Подбивка' : '🌙 Review', 'review:start:today'),
  });

  return isRu ? 'день: отправлено' : 'day: sent';
}

async function sendSimulatedEveningReminder(
  ctx: BotContext,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  isRu: boolean
): Promise<string> {
  const todayPlan = await planService.getTodayPlan(user.id, user.timezone);
  if (
    !todayPlan ||
    todayPlan.status === planService.PLAN_STATUSES.DRAFT ||
    todayPlan.status === planService.PLAN_STATUSES.REVIEWED ||
    todayPlan.tasks.length === 0
  ) {
    return isRu
      ? 'вечер: пропуск, нет подходящего плана для подбивки'
      : 'evening: skipped, no eligible plan for review';
  }

  await ctx.reply(
    isRu
      ? '🧪 Симуляция: вечернее напоминание.\n\n🌙 Время подвести итоги дня. Отметь статус задач.'
      : "🧪 Simulation: evening reminder.\n\n🌙 Time for evening review. Mark statuses for today's tasks.",
    {
      reply_markup: new InlineKeyboard()
        .text(isRu ? '✅ Начать подбивку' : '✅ Start review', 'review:start:today')
        .row()
        .text(
          isRu ? '🗓 Запланировать завтра' : '🗓 Plan tomorrow',
          'plan:start:tomorrow'
        ),
    }
  );

  return isRu ? 'вечер: отправлено' : 'evening: sent';
}

export async function handlePlanCommand(ctx: BotContext): Promise<void> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    await ctx.reply('Please run /start first.');
    return;
  }

  const rawText = ctx.message?.text ?? '';
  const argument = parseCommandArgument(rawText, 'plan');
  const target = resolvePlanTarget(argument);
  const isRu = user.language === 'ru';

  if (!target) {
    await ctx.reply(
      isRu
        ? 'Используй /plan, /plan today или /plan tomorrow.'
        : 'Use /plan, /plan today, or /plan tomorrow.'
    );
    return;
  }

  await ctx.conversation.enter('plan', target);
}

export async function handleTomorrowPlanCommand(ctx: BotContext): Promise<void> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    await ctx.reply('Please run /start first.');
    return;
  }

  await ctx.conversation.enter('plan', 'tomorrow');
}

export async function handleSimulateRemindersCommand(
  ctx: BotContext
): Promise<void> {
  if (!isDev) {
    await ctx.reply('Reminder simulation command is available only in development mode.');
    return;
  }

  const user = await getCurrentUser(ctx);
  if (!user) {
    await ctx.reply('Please run /start first.');
    return;
  }

  const language: Language = (user.language as Language) || 'en';
  const isRu = isRussian(language);
  const rawText = ctx.message?.text ?? '';
  const argument = parseCommandArgument(rawText, 'simulate');
  const mode = parseSimulationMode(argument);

  if (!mode) {
    await ctx.reply(
      isRu
        ? 'Использование: /simulate, /simulate morning, /simulate day, /simulate evening'
        : 'Usage: /simulate, /simulate morning, /simulate day, /simulate evening'
    );
    return;
  }

  const results: string[] = [];

  if (mode === 'all' || mode === 'morning') {
    results.push(await sendSimulatedMorningReminder(ctx, user, isRu));
  }

  if (mode === 'all' || mode === 'day') {
    results.push(await sendSimulatedDayReminder(ctx, user, isRu));
  }

  if (mode === 'all' || mode === 'evening') {
    results.push(await sendSimulatedEveningReminder(ctx, user, isRu));
  }

  await ctx.reply(
    isRu
      ? `🧪 Результат симуляции:\n• ${results.join('\n• ')}`
      : `🧪 Simulation result:\n• ${results.join('\n• ')}`
  );
}

export async function handleAddCommand(ctx: BotContext): Promise<void> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    await ctx.reply('Please run /start first.');
    return;
  }

  const language: Language = (user.language as Language) || 'en';
  const isRu = isRussian(language);
  const rawText = ctx.message?.text ?? '';
  const argument = parseCommandArgument(rawText, 'add');

  if (!argument) {
    await ctx.conversation.enter('addTask');
    return;
  }

  const parsed = taskService.parseTasksFromMessage(argument);
  if (parsed.length === 0) {
    await ctx.reply(
      isRu
        ? 'Не удалось распознать задачи. Используй /add и отправь текст.'
        : "Couldn't parse tasks. Use /add and send task text."
    );
    return;
  }

  const updatedPlan = await taskService.addTasksToTodayPlan(
    user.id,
    user.timezone,
    parsed
  );

  if (!updatedPlan) {
    await ctx.reply(
      isRu
        ? 'Сначала создай план на сегодня через /plan.'
        : "Create today's plan first via /plan."
    );
    return;
  }

  await ctx.reply(
    isRu
      ? `✅ Задачи добавлены.\n\n${taskService.formatTaskList(updatedPlan.tasks)}`
      : `✅ Tasks added.\n\n${taskService.formatTaskList(updatedPlan.tasks)}`
  );

  await syncPinnedPlanMessage(ctx, {
    userId: user.id,
    timezone: user.timezone,
    language,
    pinnedMessageId: user.pinnedMessageId,
  });
}

export async function handleRemoveCommand(ctx: BotContext): Promise<void> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    await ctx.reply('Please run /start first.');
    return;
  }

  const language: Language = (user.language as Language) || 'en';
  const isRu = isRussian(language);
  const rawText = ctx.message?.text ?? '';
  const argument = parseCommandArgument(rawText, 'remove');
  const todayPlan = await planService.getTodayPlan(user.id, user.timezone);

  if (!todayPlan || todayPlan.tasks.length === 0) {
    await ctx.reply(
      isRu
        ? 'На сегодня нет задач для удаления.'
        : 'There are no tasks for today to remove.'
    );
    return;
  }

  if (!argument) {
    await ctx.reply(
      isRu
        ? `Использование: /remove N\n\n${taskService.formatTaskList(todayPlan.tasks)}`
        : `Usage: /remove N\n\n${taskService.formatTaskList(todayPlan.tasks)}`
    );
    return;
  }

  const index = Number.parseInt(argument, 10);
  if (!Number.isInteger(index) || index < 1) {
    await ctx.reply(
      isRu
        ? 'Использование: /remove N'
        : 'Usage: /remove N'
    );
    return;
  }

  const updatedTasks = await taskService.removeTaskByPositionToday(
    user.id,
    user.timezone,
    index
  );

  if (!updatedTasks) {
    await ctx.reply(
      isRu
        ? `Задача №${index} не найдена в сегодняшнем плане.`
        : `Task #${index} was not found in today's plan.`
    );
    return;
  }

  await ctx.reply(
    isRu
      ? `🗑 Задача №${index} удалена.\n\n${taskService.formatTaskList(updatedTasks)}`
      : `🗑 Task #${index} removed.\n\n${taskService.formatTaskList(updatedTasks)}`
  );

  await syncPinnedPlanMessage(ctx, {
    userId: user.id,
    timezone: user.timezone,
    language,
    pinnedMessageId: user.pinnedMessageId,
  });
}

export async function handleDoneCommand(ctx: BotContext): Promise<void> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    await ctx.reply('Please run /start first.');
    return;
  }

  const language: Language = (user.language as Language) || 'en';
  const isRu = isRussian(language);
  const rawText = ctx.message?.text ?? '';
  const argument = parseCommandArgument(rawText, 'done');
  const todayPlan = await planService.getTodayPlan(user.id, user.timezone);

  if (!todayPlan || todayPlan.tasks.length === 0) {
    await ctx.reply(
      isRu
        ? 'На сегодня нет задач для отметки.'
        : "There are no tasks for today to mark as done."
    );
    return;
  }

  if (!argument) {
    await ctx.reply(
      isRu ? 'Отметить все задачи как выполненные?' : 'Mark all today tasks as done?',
      {
        reply_markup: new InlineKeyboard()
          .text(isRu ? '✅ Да' : '✅ Yes', 'task:done_all_confirm')
          .text(isRu ? '❌ Нет' : '❌ No', 'task:done_all_cancel'),
      }
    );
    return;
  }

  const index = Number.parseInt(argument, 10);
  if (!Number.isInteger(index) || index < 1) {
    await ctx.reply(isRu ? 'Использование: /done или /done N' : 'Usage: /done or /done N');
    return;
  }

  const updatedTask = await taskService.markTaskDoneByPositionToday(
    user.id,
    user.timezone,
    index
  );

  if (!updatedTask) {
    await ctx.reply(
      isRu
        ? `Задача №${index} не найдена в сегодняшнем плане.`
        : `Task #${index} was not found in today's plan.`
    );
    return;
  }

  const updatedPlan = await planService.getTodayPlan(user.id, user.timezone);
  await ctx.reply(
    isRu
      ? `✅ Задача №${index} отмечена как выполненная.\n\n${taskService.formatTaskList(updatedPlan?.tasks ?? [])}`
      : `✅ Task #${index} marked as done.\n\n${taskService.formatTaskList(updatedPlan?.tasks ?? [])}`
  );

  await syncPinnedPlanMessage(ctx, {
    userId: user.id,
    timezone: user.timezone,
    language,
    pinnedMessageId: user.pinnedMessageId,
  });
}

export async function handleStatsCommand(ctx: BotContext): Promise<void> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    await ctx.reply('Please run /start first.');
    return;
  }

  const language: Language = (user.language as Language) || 'en';
  const stats = await getCalendarWeekStats(user.id, user.timezone);
  const message = formatCalendarWeekStatsMessage(
    stats,
    language,
    user.timezone
  );

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

export async function handleReviewCommand(ctx: BotContext): Promise<void> {
  await ctx.conversation.enter('eveningReview');
}

export async function handlePlanCallbacks(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const user = await getCurrentUser(ctx);
  if (!user) {
    await ctx.answerCallbackQuery('Please run /start first.');
    return;
  }

  const language: Language = (user.language as Language) || 'en';
  const isRu = isRussian(language);

  if (data === 'plan:start') {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('plan', 'today');
    return;
  }

  if (data === 'plan:start:tomorrow') {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('plan', 'tomorrow');
    return;
  }

  if (data === 'review:start:today') {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('eveningReview');
    return;
  }

  if (data === 'review:start:yesterday') {
    await ctx.answerCallbackQuery();
    const today = planService.getTodayInTimezone(user.timezone);
    const yesterday = planService.shiftDateInTimezone(
      today,
      user.timezone,
      -1
    );
    await ctx.conversation.enter('eveningReview', yesterday.toISOString());
    return;
  }

  if (data === 'task:done_all_cancel') {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(isRu ? 'Ок, без массовой отметки.' : 'Okay, no bulk update.');
    return;
  }

  if (data === 'task:done_all_confirm') {
    await ctx.answerCallbackQuery();
    const updatedCount = await taskService.markAllTodayTasksDone(
      user.id,
      user.timezone
    );
    const todayPlan = await planService.getTodayPlan(user.id, user.timezone);
    await ctx.editMessageText(
      isRu
        ? `✅ Готово. Отмечено задач: ${updatedCount}\n\n${taskService.formatTaskList(todayPlan?.tasks ?? [])}`
        : `✅ Done. Tasks marked: ${updatedCount}\n\n${taskService.formatTaskList(todayPlan?.tasks ?? [])}`
    );

    await syncPinnedPlanMessage(ctx, {
      userId: user.id,
      timezone: user.timezone,
      language,
      pinnedMessageId: user.pinnedMessageId,
    });
  }
}
