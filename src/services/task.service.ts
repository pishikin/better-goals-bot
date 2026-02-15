import type { Task } from '@prisma/client';
import prisma from '../db/client.js';
import { getTodayInTimezone, getTodayPlan, type DailyPlanWithTasks } from './daily-plan.service.js';

export const MAX_TASKS_PER_DAY = 10;
export const MAX_TASK_TEXT_LENGTH = 200;

export const TASK_STATUSES = {
  PENDING: 'pending',
  DONE: 'done',
  IN_PROGRESS: 'in_progress',
  SKIPPED: 'skipped',
} as const;

export type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES];

export interface AppendTaskInput {
  text: string;
  areaId?: string | null;
  carriedFromTaskId?: string | null;
}

/**
 * Parse task text from message (single task or multiline list).
 * Supports bullets/numeration prefixes.
 */
export function parseTasksFromMessage(input: string): string[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .map((line) => line.replace(/^(?:[-*•]|\d+[.)])\s*/u, '').trim())
    .filter((line) => line.length > 0)
    .map((line) => line.slice(0, MAX_TASK_TEXT_LENGTH));
}

/**
 * Normalize and clamp task list to max size.
 */
export function normalizeTaskTexts(taskTexts: string[]): string[] {
  return taskTexts
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((text) => text.slice(0, MAX_TASK_TEXT_LENGTH))
    .slice(0, MAX_TASKS_PER_DAY);
}

/**
 * Add tasks to existing plan, preserving order.
 */
export async function addTasksToPlan(
  planId: string,
  userId: string,
  taskTexts: string[]
): Promise<Task[]> {
  const normalized = normalizeTaskTexts(taskTexts);

  if (normalized.length === 0) {
    return [];
  }

  return prisma.$transaction(async (tx) => {
    const currentCount = await tx.task.count({
      where: { planId },
    });

    if (currentCount >= MAX_TASKS_PER_DAY) {
      return [];
    }

    const allowed = normalized.slice(0, MAX_TASKS_PER_DAY - currentCount);

    await tx.task.createMany({
      data: allowed.map((text, index) => ({
        planId,
        userId,
        text,
        position: currentCount + index + 1,
        status: TASK_STATUSES.PENDING,
      })),
    });

    return tx.task.findMany({
      where: { planId },
      orderBy: { position: 'asc' },
    });
  });
}

/**
 * Append task objects to existing plan, preserving order and metadata.
 */
export async function appendTaskInputsToPlan(
  planId: string,
  userId: string,
  taskInputs: AppendTaskInput[]
): Promise<Task[]> {
  const normalized = taskInputs
    .map((task) => ({
      text: task.text.trim().slice(0, MAX_TASK_TEXT_LENGTH),
      areaId: task.areaId ?? null,
      carriedFromTaskId: task.carriedFromTaskId ?? null,
    }))
    .filter((task) => task.text.length > 0);

  if (normalized.length === 0) {
    return getPlanTasks(planId);
  }

  return prisma.$transaction(async (tx) => {
    const currentCount = await tx.task.count({
      where: { planId },
    });

    if (currentCount >= MAX_TASKS_PER_DAY) {
      return tx.task.findMany({
        where: { planId },
        orderBy: { position: 'asc' },
      });
    }

    const allowed = normalized.slice(0, MAX_TASKS_PER_DAY - currentCount);

    await tx.task.createMany({
      data: allowed.map((task, index) => ({
        planId,
        userId,
        areaId: task.areaId,
        text: task.text,
        position: currentCount + index + 1,
        status: TASK_STATUSES.PENDING,
        carriedFromTaskId: task.carriedFromTaskId,
      })),
    });

    return tx.task.findMany({
      where: { planId },
      orderBy: { position: 'asc' },
    });
  });
}

/**
 * Add tasks to today's plan for user.
 * Returns null if no plan exists.
 */
export async function addTasksToTodayPlan(
  userId: string,
  timezone: string,
  taskTexts: string[]
): Promise<DailyPlanWithTasks | null> {
  const todayPlan = await getTodayPlan(userId, timezone);

  if (!todayPlan) {
    return null;
  }

  await addTasksToPlan(todayPlan.id, userId, taskTexts);

  return prisma.dailyPlan.findUnique({
    where: { id: todayPlan.id },
    include: {
      tasks: { orderBy: { position: 'asc' } },
    },
  });
}

/**
 * Get tasks for plan.
 */
export async function getPlanTasks(planId: string): Promise<Task[]> {
  return prisma.task.findMany({
    where: { planId },
    orderBy: { position: 'asc' },
  });
}

/**
 * Mark a task with a specific status.
 */
export async function markTaskStatus(
  taskId: string,
  status: TaskStatus
): Promise<Task> {
  return prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      statusUpdatedAt: new Date(),
    },
  });
}

/**
 * Mark specific task by position in today's plan as done.
 */
export async function markTaskDoneByPositionToday(
  userId: string,
  timezone: string,
  position: number
): Promise<Task | null> {
  const today = getTodayInTimezone(timezone);
  const plan = await prisma.dailyPlan.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    select: { id: true },
  });

  if (!plan) {
    return null;
  }

  const task = await prisma.task.findUnique({
    where: {
      planId_position: {
        planId: plan.id,
        position,
      },
    },
  });

  if (!task) {
    return null;
  }

  return markTaskStatus(task.id, TASK_STATUSES.DONE);
}

/**
 * Mark all today's tasks as done.
 */
export async function markAllTodayTasksDone(
  userId: string,
  timezone: string
): Promise<number> {
  const today = getTodayInTimezone(timezone);
  const plan = await prisma.dailyPlan.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    select: { id: true },
  });

  if (!plan) {
    return 0;
  }

  const result = await prisma.task.updateMany({
    where: { planId: plan.id },
    data: {
      status: TASK_STATUSES.DONE,
      statusUpdatedAt: new Date(),
    },
  });

  return result.count;
}

/**
 * Remove specific task by position in today's plan and reindex positions.
 */
export async function removeTaskByPositionToday(
  userId: string,
  timezone: string,
  position: number
): Promise<Task[] | null> {
  const today = getTodayInTimezone(timezone);

  return prisma.$transaction(async (tx) => {
    const plan = await tx.dailyPlan.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      select: { id: true },
    });

    if (!plan) {
      return null;
    }

    const task = await tx.task.findUnique({
      where: {
        planId_position: {
          planId: plan.id,
          position,
        },
      },
      select: { id: true },
    });

    if (!task) {
      return null;
    }

    await tx.task.delete({
      where: { id: task.id },
    });

    const remaining = await tx.task.findMany({
      where: { planId: plan.id },
      orderBy: { position: 'asc' },
    });

    for (let index = 0; index < remaining.length; index++) {
      const nextPosition = index + 1;
      const current = remaining[index];

      if (current.position === nextPosition) {
        continue;
      }

      await tx.task.update({
        where: { id: current.id },
        data: { position: nextPosition },
      });
    }

    return tx.task.findMany({
      where: { planId: plan.id },
      orderBy: { position: 'asc' },
    });
  });
}

export interface TaskStatusSummary {
  total: number;
  done: number;
  inProgress: number;
  skipped: number;
  pending: number;
}

/**
 * Build summary object for task statuses.
 */
export function summarizeTaskStatuses(tasks: Task[]): TaskStatusSummary {
  return tasks.reduce<TaskStatusSummary>(
    (acc, task) => {
      acc.total += 1;

      if (task.status === TASK_STATUSES.DONE) {
        acc.done += 1;
      } else if (task.status === TASK_STATUSES.IN_PROGRESS) {
        acc.inProgress += 1;
      } else if (task.status === TASK_STATUSES.SKIPPED) {
        acc.skipped += 1;
      } else {
        acc.pending += 1;
      }

      return acc;
    },
    {
      total: 0,
      done: 0,
      inProgress: 0,
      skipped: 0,
      pending: 0,
    }
  );
}

/**
 * Render task list for user messages.
 */
export function formatTaskList(tasks: Task[]): string {
  if (tasks.length === 0) {
    return '—';
  }

  return tasks
    .sort((a, b) => a.position - b.position)
    .map((task) => {
      const statusIcon =
        task.status === TASK_STATUSES.DONE
          ? '✅'
          : task.status === TASK_STATUSES.IN_PROGRESS
            ? '🕓'
            : task.status === TASK_STATUSES.SKIPPED
              ? '❌'
              : '▫️';

      return `${task.position}. ${statusIcon} ${task.text}`;
    })
    .join('\n');
}
