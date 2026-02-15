import type { DailyPlan, Task } from '@prisma/client';
import { addDays, subDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import prisma from '../db/client.js';

export const PLAN_STATUSES = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  REVIEW_PENDING: 'review_pending',
  REVIEWED: 'reviewed',
} as const;

export type PlanStatus = (typeof PLAN_STATUSES)[keyof typeof PLAN_STATUSES];

export interface PlanTaskInput {
  text: string;
  areaId?: string | null;
  carriedFromTaskId?: string | null;
}

export type DailyPlanWithTasks = DailyPlan & { tasks: Task[] };

/**
 * Build timezone-local day key from any Date.
 */
export function getLocalDayKey(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

/**
 * Convert timezone-local day key to Date stored in DB.
 * Stored value is UTC instant of local 00:00 in the user's timezone.
 */
export function fromLocalDayKey(localDayKey: string, timezone: string): Date {
  return fromZonedTime(`${localDayKey}T00:00:00`, timezone);
}

/**
 * Normalize date to start-of-day in user's timezone.
 */
export function getDateInTimezone(date: Date, timezone: string): Date {
  return fromLocalDayKey(getLocalDayKey(date, timezone), timezone);
}

/**
 * Add/subtract days on a timezone-local calendar day.
 * Keeps correctness across DST boundaries.
 */
export function shiftDateInTimezone(
  date: Date,
  timezone: string,
  deltaDays: number
): Date {
  const dayKey = getLocalDayKey(date, timezone);
  const noonUtc = fromZonedTime(`${dayKey}T12:00:00`, timezone);
  const shiftedNoonUtc = addDays(noonUtc, deltaDays);
  const shiftedDayKey = getLocalDayKey(shiftedNoonUtc, timezone);
  return fromLocalDayKey(shiftedDayKey, timezone);
}

/**
 * Get "today" in user's timezone.
 */
export function getTodayInTimezone(timezone: string): Date {
  return getDateInTimezone(new Date(), timezone);
}

/**
 * Get plan with tasks for a specific date.
 * Date is expected to be normalized by getDateInTimezone/shiftDateInTimezone.
 */
export async function getPlanForDate(
  userId: string,
  date: Date
): Promise<DailyPlanWithTasks | null> {
  return prisma.dailyPlan.findUnique({
    where: {
      userId_date: {
        userId,
        date,
      },
    },
    include: {
      tasks: {
        orderBy: { position: 'asc' },
      },
    },
  });
}

/**
 * Get today's plan in user's timezone.
 */
export async function getTodayPlan(
  userId: string,
  timezone: string
): Promise<DailyPlanWithTasks | null> {
  const today = getTodayInTimezone(timezone);
  return getPlanForDate(userId, today);
}

/**
 * Get yesterday's plan in user's timezone.
 */
export async function getYesterdayPlan(
  userId: string,
  timezone: string
): Promise<DailyPlanWithTasks | null> {
  const today = getTodayInTimezone(timezone);
  const yesterday = shiftDateInTimezone(today, timezone, -1);
  return getPlanForDate(userId, yesterday);
}

/**
 * Plan is considered "filled" when it is not draft and has at least one task.
 */
export function isFilledPlan(
  plan: DailyPlanWithTasks | null | undefined
): plan is DailyPlanWithTasks {
  return Boolean(
    plan &&
      plan.status !== PLAN_STATUSES.DRAFT &&
      plan.tasks.length > 0
  );
}

/**
 * Get latest non-draft plan with tasks before today in user's timezone.
 */
export async function getLatestFilledPlanBeforeToday(
  userId: string,
  timezone: string
): Promise<DailyPlanWithTasks | null> {
  const today = getTodayInTimezone(timezone);

  return prisma.dailyPlan.findFirst({
    where: {
      userId,
      date: { lt: today },
      status: { not: PLAN_STATUSES.DRAFT },
      tasks: {
        some: {},
      },
    },
    orderBy: { date: 'desc' },
    include: {
      tasks: {
        orderBy: { position: 'asc' },
      },
    },
  });
}

/**
 * Return in-progress tasks from yesterday (carry-over candidates).
 */
export async function getCarryOverTasksFromYesterday(
  userId: string,
  timezone: string
): Promise<Task[]> {
  const yesterdayPlan = await getYesterdayPlan(userId, timezone);

  if (!yesterdayPlan) {
    return [];
  }

  return yesterdayPlan.tasks
    .filter((task) => task.status === 'in_progress')
    .sort((a, b) => a.position - b.position);
}

/**
 * Create or replace plan for given date with provided tasks.
 * Existing tasks for this date are replaced (safe idempotent behavior).
 */
export async function createOrReplaceConfirmedPlan(
  userId: string,
  date: Date,
  taskInputs: PlanTaskInput[],
  source: string = 'manual'
): Promise<DailyPlanWithTasks> {
  const normalizedDate = date;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.dailyPlan.findUnique({
      where: {
        userId_date: {
          userId,
          date: normalizedDate,
        },
      },
    });

    let plan: DailyPlan;

    if (existing) {
      await tx.task.deleteMany({
        where: { planId: existing.id },
      });

      plan = await tx.dailyPlan.update({
        where: { id: existing.id },
        data: {
          status: PLAN_STATUSES.CONFIRMED,
          source,
          confirmedAt: now,
          reviewStartedAt: null,
          reviewCompletedAt: null,
        },
      });
    } else {
      plan = await tx.dailyPlan.create({
        data: {
          userId,
          date: normalizedDate,
          status: PLAN_STATUSES.CONFIRMED,
          source,
          confirmedAt: now,
        },
      });
    }

    if (taskInputs.length > 0) {
      await tx.task.createMany({
        data: taskInputs.map((task, index) => ({
          planId: plan.id,
          userId,
          areaId: task.areaId ?? null,
          text: task.text,
          position: index + 1,
          status: 'pending',
          carriedFromTaskId: task.carriedFromTaskId ?? null,
        })),
      });
    }

    return tx.dailyPlan.findUniqueOrThrow({
      where: { id: plan.id },
      include: {
        tasks: {
          orderBy: { position: 'asc' },
        },
      },
    });
  });
}

/**
 * Mark plan as review started.
 */
export async function markReviewStarted(planId: string): Promise<DailyPlan> {
  return prisma.dailyPlan.update({
    where: { id: planId },
    data: {
      status: PLAN_STATUSES.REVIEW_PENDING,
      reviewStartedAt: new Date(),
    },
  });
}

/**
 * Mark plan as reviewed (completed evening review).
 */
export async function markReviewed(planId: string): Promise<DailyPlan> {
  return prisma.dailyPlan.update({
    where: { id: planId },
    data: {
      status: PLAN_STATUSES.REVIEWED,
      reviewCompletedAt: new Date(),
    },
  });
}

/**
 * Get the latest reviewed plan date.
 */
export async function getLastReviewedPlanDate(
  userId: string
): Promise<Date | null> {
  const plan = await prisma.dailyPlan.findFirst({
    where: {
      userId,
      status: PLAN_STATUSES.REVIEWED,
    },
    orderBy: { date: 'desc' },
    select: { date: true },
  });

  return plan?.date ?? null;
}

/**
 * Calculate streak for the new model:
 * consecutive days with reviewed plans.
 */
export async function calculateActiveDayStreak(
  userId: string,
  timezone: string
): Promise<number> {
  const dates = await prisma.dailyPlan.findMany({
    where: {
      userId,
      status: PLAN_STATUSES.REVIEWED,
    },
    select: { date: true },
    distinct: ['date'],
    orderBy: { date: 'desc' },
  });

  if (dates.length === 0) {
    return 0;
  }

  const dateSet = new Set(
    dates.map((d) => getLocalDayKey(d.date, timezone))
  );

  const today = getTodayInTimezone(timezone);
  let cursor = today;

  if (!dateSet.has(getLocalDayKey(today, timezone))) {
    cursor = shiftDateInTimezone(today, timezone, -1);
  }

  let streak = 0;

  while (dateSet.has(getLocalDayKey(cursor, timezone))) {
    streak += 1;
    cursor = shiftDateInTimezone(cursor, timezone, -1);
  }

  return streak;
}

/**
 * Kept for compatibility in places where subDays is still needed.
 * Prefer shiftDateInTimezone for user-local day transitions.
 */
export { subDays };
