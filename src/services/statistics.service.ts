import prisma from '../db/client.js';
import { eachDayOfInterval } from 'date-fns';
import type { UserStatistics } from '../types/index.js';
import {
  PLAN_STATUSES,
  getLocalDayKey,
  getTodayInTimezone,
  shiftDateInTimezone,
} from './daily-plan.service.js';

/**
 * Statistics service calculates user metrics.
 * New model streak uses reviewed daily plans.
 * If no reviewed plans exist yet, we fallback to legacy progress_entries activity.
 */

/**
 * Legacy activity day keys from progress entries.
 */
async function getLegacyActivityDayKeys(
  userId: string,
  timezone: string
): Promise<string[]> {
  const entries = await prisma.progressEntry.findMany({
    where: { userId },
    select: { date: true },
    distinct: ['date'],
    orderBy: { date: 'desc' },
  });

  return entries.map((e) => getLocalDayKey(e.date, timezone));
}

/**
 * New-model active day keys from reviewed daily plans.
 */
async function getReviewedPlanDayKeys(
  userId: string,
  timezone: string
): Promise<string[]> {
  const plans = await prisma.dailyPlan.findMany({
    where: {
      userId,
      status: PLAN_STATUSES.REVIEWED,
    },
    select: { date: true },
    distinct: ['date'],
    orderBy: { date: 'desc' },
  });

  return plans.map((plan) => getLocalDayKey(plan.date, timezone));
}

function toDateSet(dayKeys: string[]): Set<string> {
  return new Set(dayKeys);
}

function calculateStreakFromDateSet(
  today: Date,
  timezone: string,
  dateSet: Set<string>
): number {
  if (dateSet.size === 0) {
    return 0;
  }

  let streak = 0;
  let currentDate = today;

  // If today has no activity, start from yesterday.
  if (!dateSet.has(getLocalDayKey(today, timezone))) {
    currentDate = shiftDateInTimezone(today, timezone, -1);
  }

  while (dateSet.has(getLocalDayKey(currentDate, timezone))) {
    streak += 1;
    currentDate = shiftDateInTimezone(currentDate, timezone, -1);
  }

  return streak;
}

/**
 * Calculate current streak:
 * 1) reviewed plans streak if any exists;
 * 2) otherwise legacy progress streak.
 */
export async function calculateStreak(
  userId: string,
  timezone: string
): Promise<number> {
  const today = getTodayInTimezone(timezone);

  const reviewedPlanDayKeys = await getReviewedPlanDayKeys(userId, timezone);
  if (reviewedPlanDayKeys.length > 0) {
    return calculateStreakFromDateSet(
      today,
      timezone,
      toDateSet(reviewedPlanDayKeys)
    );
  }

  const legacyActivityDayKeys = await getLegacyActivityDayKeys(userId, timezone);
  return calculateStreakFromDateSet(
    today,
    timezone,
    toDateSet(legacyActivityDayKeys)
  );
}

/**
 * Calculate weekly activity (days with streak-activity in last 7 days).
 * Uses new reviewed plans if available; otherwise legacy progress dates.
 */
export async function calculateWeeklyActivity(
  userId: string,
  timezone: string
): Promise<number> {
  const today = getTodayInTimezone(timezone);
  const weekAgo = shiftDateInTimezone(today, timezone, -6); // Last 7 days including today

  const reviewedPlanDayKeys = await getReviewedPlanDayKeys(userId, timezone);
  const sourceDayKeys =
    reviewedPlanDayKeys.length > 0
      ? reviewedPlanDayKeys
      : await getLegacyActivityDayKeys(userId, timezone);

  const dateStrings = toDateSet(sourceDayKeys);
  const daysInRange = eachDayOfInterval({ start: weekAgo, end: today });

  return daysInRange.filter((day) =>
    dateStrings.has(getLocalDayKey(day, timezone))
  ).length;
}

/**
 * Get total number of progress entries for a user (excluding check-ins).
 */
export async function getTotalEntries(userId: string): Promise<number> {
  return prisma.progressEntry.count({
    where: {
      userId,
      areaId: { not: null }, // Exclude check-ins
      skipped: false, // Exclude skipped entries
    },
  });
}

/**
 * Get comprehensive user statistics.
 */
export async function getUserStatistics(
  userId: string,
  timezone: string
): Promise<UserStatistics> {
  const [currentStreak, weeklyActivity, totalEntries] = await Promise.all([
    calculateStreak(userId, timezone),
    calculateWeeklyActivity(userId, timezone),
    getTotalEntries(userId),
  ]);

  return {
    currentStreak,
    weeklyActivity,
    totalEntries,
  };
}

/**
 * Get the date of the last activity.
 * Prefers reviewed plan date when present; otherwise legacy progress date.
 */
export async function getLastProgressDate(
  userId: string
): Promise<Date | null> {
  const lastReviewedPlan = await prisma.dailyPlan.findFirst({
    where: {
      userId,
      status: PLAN_STATUSES.REVIEWED,
    },
    orderBy: { date: 'desc' },
    select: { date: true },
  });

  const lastEntry = await prisma.progressEntry.findFirst({
    where: { userId },
    orderBy: { date: 'desc' },
    select: { date: true },
  });

  if (lastReviewedPlan?.date && lastEntry?.date) {
    return lastReviewedPlan.date > lastEntry.date
      ? lastReviewedPlan.date
      : lastEntry.date;
  }

  return lastReviewedPlan?.date ?? lastEntry?.date ?? null;
}

/**
 * Get progress stats for a specific date range.
 * Legacy helper; keeps old behavior for progress entries.
 */
export async function getDateRangeStats(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{ daysWithProgress: number; totalEntries: number }> {
  const entries = await prisma.progressEntry.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: { date: true },
  });

  const uniqueDates = new Set(entries.map((e) => e.date.toISOString().slice(0, 10)));

  return {
    daysWithProgress: uniqueDates.size,
    totalEntries: entries.length,
  };
}
