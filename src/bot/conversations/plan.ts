import { InlineKeyboard } from 'grammy';
import type { Task } from '@prisma/client';
import { format, isSameDay } from 'date-fns';
import type { BotContext, BotConversation, Language } from '../../types/index.js';
import * as userService from '../../services/user.service.js';
import * as planService from '../../services/daily-plan.service.js';
import {
  passThroughGlobalInterruptIfAny,
} from './global-interrupts.js';
import {
  appendTaskInputsToPlan,
  MAX_TASKS_PER_DAY,
  formatTaskList,
  parseTasksFromMessage,
  TASK_STATUSES,
} from '../../services/task.service.js';
import { syncPinnedPlanMessage } from '../utils/pinned-plan.js';

interface DraftTaskInput {
  text: string;
  areaId?: string | null;
  carriedFromTaskId?: string | null;
}

function isRussian(language: string): boolean {
  return language === 'ru';
}

function getPlanDateLabel(
  targetDate: Date,
  today: Date,
  tomorrow: Date,
  language: Language
): string {
  const isRu = isRussian(language);

  if (isSameDay(targetDate, today)) {
    return isRu ? 'сегодня' : 'today';
  }

  if (isSameDay(targetDate, tomorrow)) {
    return isRu ? 'завтра' : 'tomorrow';
  }

  return format(targetDate, 'dd.MM.yyyy');
}

function buildPreviewText(
  tasks: DraftTaskInput[],
  language: Language,
  dateLabel: string
): string {
  const header = isRussian(language)
    ? `План на ${dateLabel} сейчас такой:`
    : `Current plan for ${dateLabel}:`;

  const list = tasks
    .map((task, index) => `${index + 1}. ${task.text}`)
    .join('\n');

  const footer = isRussian(language) ? 'Все верно?' : 'Does this look right?';

  return `${header}\n\n${list}\n\n${footer}`;
}

function createPlanPreviewKeyboard(
  canAddMore: boolean,
  language: Language
): InlineKeyboard {
  const isRu = isRussian(language);
  const keyboard = new InlineKeyboard()
    .text(isRu ? '✅ Подтвердить' : '✅ Confirm', 'plan:confirm')
    .text(isRu ? '✏️ Изменить' : '✏️ Rewrite', 'plan:rewrite')
    .row();

  if (canAddMore) {
    keyboard.text(isRu ? '➕ Добавить' : '➕ Add more', 'plan:add_more').row();
  }

  keyboard.text(isRu ? '❌ Отмена' : '❌ Cancel', 'plan:cancel');
  return keyboard;
}

function createYesNoKeyboard(
  yesCallback: string,
  noCallback: string,
  language: Language
): InlineKeyboard {
  const isRu = isRussian(language);
  return new InlineKeyboard()
    .text(isRu ? '✅ Да' : '✅ Yes', yesCallback)
    .text(isRu ? '❌ Нет' : '❌ No', noCallback);
}

async function waitForPlanAction(
  conversation: BotConversation,
  allowed: string[]
): Promise<string> {
  while (true) {
    const callback = await conversation.waitFor('callback_query:data', {
      otherwise: async (otherCtx) => {
        await passThroughGlobalInterruptIfAny(conversation, otherCtx);
      },
    });

    await passThroughGlobalInterruptIfAny(conversation, callback);
    const data = callback.callbackQuery?.data ?? '';
    await callback.answerCallbackQuery();

    if (allowed.includes(data)) {
      return data;
    }
  }
}

function getCarryOverCandidatesFromPlan(plan: { tasks: Task[] } | null): Task[] {
  if (!plan) return [];
  return plan.tasks
    .filter((task) => task.status === TASK_STATUSES.IN_PROGRESS)
    .sort((a, b) => a.position - b.position);
}

/**
 * Daily plan creation flow for today or tomorrow.
 */
export async function planConversation(
  conversation: BotConversation,
  ctx: BotContext,
  targetDateInput?: string
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
  const tomorrow = planService.shiftDateInTimezone(today, user.timezone, 1);

  let targetDate = today;
  const normalizedTarget = targetDateInput?.trim().toLowerCase();
  if (normalizedTarget === 'tomorrow') {
    targetDate = tomorrow;
  } else if (normalizedTarget && normalizedTarget !== 'today') {
    const parsed = new Date(targetDateInput ?? '');
    if (!Number.isNaN(parsed.getTime())) {
      targetDate = planService.getDateInTimezone(parsed, user.timezone);
    }
  }

  const isTodayTarget = isSameDay(targetDate, today);
  const isTomorrowTarget = isSameDay(targetDate, tomorrow);

  if (!isTodayTarget && !isTomorrowTarget) {
    await ctx.reply(
      isRu
        ? 'Сейчас можно планировать только сегодня или завтра.'
        : 'You can currently plan only for today or tomorrow.'
    );
    return;
  }

  const dateLabel = getPlanDateLabel(targetDate, today, tomorrow, language);

  if (isTomorrowTarget) {
    const todayPlan = await conversation.external(() =>
      planService.getTodayPlan(user.id, user.timezone)
    );
    const remainingToday =
      todayPlan?.tasks.filter(
        (task) =>
          task.status !== TASK_STATUSES.DONE &&
          task.status !== TASK_STATUSES.SKIPPED
      ).length ?? 0;

    const intro = isRu
      ? [
          'ℹ️ Сейчас ты составляешь отдельный план на завтра.',
          todayPlan
            ? `Задачи на сегодня остаются в сегодняшнем плане (${remainingToday} активных).`
            : 'План на сегодня от этого не изменится.',
        ].join('\n')
      : [
          "ℹ️ You're creating a separate plan for tomorrow.",
          todayPlan
            ? `Your today tasks stay in today's plan (${remainingToday} active).`
            : "This won't affect today's plan.",
        ].join('\n');

    await ctx.reply(intro);
  }

  let existingPlan = await conversation.external(() =>
    planService.getPlanForDate(user.id, targetDate)
  );

  if (
    existingPlan &&
    existingPlan.status !== planService.PLAN_STATUSES.DRAFT
  ) {
    if (isTodayTarget && existingPlan.tasks.length < MAX_TASKS_PER_DAY) {
      const yesterdayPlan = await conversation.external(() =>
        planService.getPlanForDate(
          user.id,
          planService.shiftDateInTimezone(targetDate, user.timezone, -1)
        )
      );
      const carryOverTasks = getCarryOverCandidatesFromPlan(yesterdayPlan);
      const existingCarriedIds = new Set(
        existingPlan.tasks
          .map((task) => task.carriedFromTaskId)
          .filter((value): value is string => Boolean(value))
      );
      const freeSlots = MAX_TASKS_PER_DAY - existingPlan.tasks.length;
      const availableCarryOver = carryOverTasks
        .filter((task) => !existingCarriedIds.has(task.id))
        .slice(0, freeSlots);

      if (availableCarryOver.length > 0) {
        const carryText = availableCarryOver
          .map((task, index) => `${index + 1}. ${task.text}`)
          .join('\n');

        await ctx.reply(
          isRu
            ? `Есть задачи "в процессе" со вчера:\n\n${carryText}\n\nДобавить их в текущий план на сегодня?`
            : `You have in-progress tasks from yesterday:\n\n${carryText}\n\nAdd them to your current plan for today?`,
          {
            reply_markup: createYesNoKeyboard(
              'plan:carryover_existing_yes',
              'plan:carryover_existing_no',
              language
            ),
          }
        );

        const carryAction = await waitForPlanAction(conversation, [
          'plan:carryover_existing_yes',
          'plan:carryover_existing_no',
        ]);

        if (carryAction === 'plan:carryover_existing_yes') {
          const currentPlanId = existingPlan.id;

          await conversation.external(() =>
            appendTaskInputsToPlan(
              currentPlanId,
              user.id,
              availableCarryOver.map((task) => ({
                text: task.text,
                areaId: task.areaId,
                carriedFromTaskId: task.id,
              }))
            )
          );

          existingPlan = await conversation.external(() =>
            planService.getPlanForDate(user.id, targetDate)
          );
        }
      }
    }

    if (!existingPlan) {
      await ctx.reply(
        isRu
          ? 'Не удалось загрузить текущий план, попробуй снова.'
          : 'Could not load the current plan. Please try again.'
      );
      return;
    }

    const intro = isRu
      ? `План на ${dateLabel} уже создан.`
      : `You already have a plan for ${dateLabel}.`;
    await ctx.reply(`${intro}\n\n${formatTaskList(existingPlan.tasks)}`);
    return;
  }

  let tasks: DraftTaskInput[] = [];

  const previousPlan = await conversation.external(() =>
    planService.getPlanForDate(
      user.id,
      planService.shiftDateInTimezone(targetDate, user.timezone, -1)
    )
  );
  const carryOverTasks = getCarryOverCandidatesFromPlan(previousPlan);

  if (carryOverTasks.length > 0) {
    const carryText = carryOverTasks
      .slice(0, MAX_TASKS_PER_DAY)
      .map((task, index) => `${index + 1}. ${task.text}`)
      .join('\n');

    const sourceLabel = isTodayTarget
      ? isRu
        ? 'со вчера'
        : 'from yesterday'
      : isRu
        ? 'сегодня'
        : 'from today';

    const message = isRu
      ? `Есть незавершенные задачи ${sourceLabel}:\n\n${carryText}\n\nДобавить их в план на ${dateLabel}?`
      : `You have in-progress tasks ${sourceLabel}:\n\n${carryText}\n\nAdd them to your plan for ${dateLabel}?`;

    await ctx.reply(message, {
      reply_markup: createYesNoKeyboard(
        'plan:carryover_yes',
        'plan:carryover_no',
        language
      ),
    });

    const action = await waitForPlanAction(conversation, [
      'plan:carryover_yes',
      'plan:carryover_no',
    ]);

    if (action === 'plan:carryover_yes') {
      tasks = carryOverTasks.slice(0, MAX_TASKS_PER_DAY).map((task) => ({
        text: task.text,
        areaId: task.areaId,
        carriedFromTaskId: task.id,
      }));
    }
  }

  if (tasks.length === 0) {
    await ctx.reply(
      isRu
        ? `Напиши задачи на ${dateLabel} (до ${MAX_TASKS_PER_DAY}). Можно отправить сразу несколько строками.`
        : `Send your tasks for ${dateLabel} (up to ${MAX_TASKS_PER_DAY}). You can send multiple lines at once.`
    );

    while (tasks.length === 0) {
      const response = await conversation.waitFor(':text', {
        otherwise: async (otherCtx) => {
          await passThroughGlobalInterruptIfAny(conversation, otherCtx, {
            answerUnhandledCallback: true,
          });
        },
      });
      await passThroughGlobalInterruptIfAny(conversation, response);
      const parsed = parseTasksFromMessage(response.message?.text ?? '');

      if (parsed.length === 0) {
        await ctx.reply(
          isRu
            ? 'Не удалось распознать задачи. Попробуй еще раз.'
            : "I couldn't parse tasks from that message. Please try again."
        );
        continue;
      }

      tasks = parsed.slice(0, MAX_TASKS_PER_DAY).map((text) => ({ text }));
    }
  }

  while (true) {
    await ctx.reply(buildPreviewText(tasks, language, dateLabel), {
      reply_markup: createPlanPreviewKeyboard(
        tasks.length < MAX_TASKS_PER_DAY,
        language
      ),
    });

    const action = await waitForPlanAction(conversation, [
      'plan:confirm',
      'plan:rewrite',
      'plan:add_more',
      'plan:cancel',
    ]);

    if (action === 'plan:confirm') {
      break;
    }

    if (action === 'plan:cancel') {
      await ctx.reply(isRu ? 'Планирование отменено.' : 'Planning cancelled.');
      return;
    }

    if (action === 'plan:rewrite') {
      tasks = [];
      await ctx.reply(
        isRu
          ? `Ок, отправь новый список задач на ${dateLabel} (до ${MAX_TASKS_PER_DAY}).`
          : `Okay, send a new task list for ${dateLabel} (up to ${MAX_TASKS_PER_DAY}).`
      );

      while (tasks.length === 0) {
        const response = await conversation.waitFor(':text', {
          otherwise: async (otherCtx) => {
            await passThroughGlobalInterruptIfAny(conversation, otherCtx, {
              answerUnhandledCallback: true,
            });
          },
        });
        await passThroughGlobalInterruptIfAny(conversation, response);
        const parsed = parseTasksFromMessage(response.message?.text ?? '');
        if (parsed.length === 0) {
          await ctx.reply(
            isRu
              ? 'Не удалось распознать задачи. Попробуй еще раз.'
              : "I couldn't parse tasks from that message. Please try again."
          );
          continue;
        }
        tasks = parsed.slice(0, MAX_TASKS_PER_DAY).map((text) => ({ text }));
      }
      continue;
    }

    if (action === 'plan:add_more') {
      if (tasks.length >= MAX_TASKS_PER_DAY) {
        await ctx.reply(
          isRu
            ? `Уже достигнут лимит в ${MAX_TASKS_PER_DAY} задач.`
            : `You already reached the limit of ${MAX_TASKS_PER_DAY} tasks.`
        );
        continue;
      }

      await ctx.reply(
        isRu
          ? `Добавь еще задачи (осталось ${MAX_TASKS_PER_DAY - tasks.length}).`
          : `Add more tasks (${MAX_TASKS_PER_DAY - tasks.length} slots left).`
      );

      const response = await conversation.waitFor(':text', {
        otherwise: async (otherCtx) => {
          await passThroughGlobalInterruptIfAny(conversation, otherCtx, {
            answerUnhandledCallback: true,
          });
        },
      });
      await passThroughGlobalInterruptIfAny(conversation, response);
      const parsed = parseTasksFromMessage(response.message?.text ?? '');

      if (parsed.length === 0) {
        await ctx.reply(
          isRu
            ? 'Не удалось распознать задачи. Вернемся к текущему плану.'
            : "Couldn't parse tasks. Returning to current plan."
        );
        continue;
      }

      const allowed = parsed.slice(0, MAX_TASKS_PER_DAY - tasks.length);
      tasks.push(...allowed.map((text) => ({ text })));
    }
  }

  const finalTasks = tasks.slice(0, MAX_TASKS_PER_DAY);

  const createdPlan = await conversation.external(() =>
    planService.createOrReplaceConfirmedPlan(
      user.id,
      targetDate,
      finalTasks,
      isTomorrowTarget ? 'manual_tomorrow' : 'manual'
    )
  );

  await ctx.reply(
    isRu
      ? `✅ План на ${dateLabel} готов.\n\n${formatTaskList(createdPlan.tasks)}`
      : `✅ Your plan for ${dateLabel} is ready.\n\n${formatTaskList(createdPlan.tasks)}`
  );

  await syncPinnedPlanMessage(ctx, {
    userId: user.id,
    timezone: user.timezone,
    language,
    pinnedMessageId: user.pinnedMessageId,
    external: (fn) => conversation.external(fn),
  });

  if (isTomorrowTarget) {
    await ctx.reply(
      isRu
        ? 'Если после вечерней подбивки часть задач за сегодня останется "в процессе", утром я предложу добавить их в этот план.'
        : 'If some tasks from today remain in progress after evening review, tomorrow morning I will ask whether to add them to this plan.'
    );
  }
}
