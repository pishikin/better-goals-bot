import prisma from '../db/client.js';
import { startOfDay, subDays, format, eachDayOfInterval } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { UserStatistics } from '../types/index.js';

/**
 * Statistics service calculates user progress metrics.
 * Streak now includes both regular progress and check-in entries.
 */

/**
 * Get all unique dates with at least one entry (progress or check-in).
 */
async function getActivityDates(userId: string): Promise<Date[]> {
  const entries = await prisma.progressEntry.findMany({
    where: { userId },
    select: { date: true },
    distinct: ['date'],
    orderBy: { date: 'desc' },
  });

  return entries.map((e) => startOfDay(e.date));
}

/**
 * Calculate the current streak (consecutive days with activity).
 * Activity = any progress entry OR check-in entry.
 * A streak is broken if a day is missed.
 * Today counts if there's activity, otherwise check from yesterday.
 */
export async function calculateStreak(
  userId: string,
  timezone: string
): Promise<number> {
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  const today = startOfDay(zonedNow);

  const activityDates = await getActivityDates(userId);

  if (activityDates.length === 0) {
    return 0;
  }

  // Create a set of date strings for quick lookup
  const dateStrings = new Set(
    activityDates.map((d) => format(d, 'yyyy-MM-dd'))
  );

  let streak = 0;
  let currentDate = today;

  // Check if today has activity, if not start from yesterday
  const todayString = format(today, 'yyyy-MM-dd');
  if (!dateStrings.has(todayString)) {
    currentDate = subDays(today, 1);
  }

  // Count consecutive days backwards
  while (true) {
    const dateString = format(currentDate, 'yyyy-MM-dd');
    if (dateStrings.has(dateString)) {
      streak++;
      currentDate = subDays(currentDate, 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculate weekly activity (days with activity in last 7 days).
 */
export async function calculateWeeklyActivity(
  userId: string,
  timezone: string
): Promise<number> {
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  const today = startOfDay(zonedNow);
  const weekAgo = subDays(today, 6); // Last 7 days including today

  const activityDates = await getActivityDates(userId);
  const dateStrings = new Set(
    activityDates.map((d) => format(d, 'yyyy-MM-dd'))
  );

  // Count days in the last 7 days that have activity
  const daysInRange = eachDayOfInterval({ start: weekAgo, end: today });

  return daysInRange.filter((day) =>
    dateStrings.has(format(day, 'yyyy-MM-dd'))
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
 * Get the date of the last activity (progress or check-in).
 */
export async function getLastProgressDate(
  userId: string
): Promise<Date | null> {
  const lastEntry = await prisma.progressEntry.findFirst({
    where: { userId },
    orderBy: { date: 'desc' },
    select: { date: true },
  });

  return lastEntry?.date ?? null;
}

/**
 * Get progress stats for a specific date range.
 */
export async function getDateRangeStats(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{ daysWithProgress: number; totalEntries: number }> {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);

  const entries = await prisma.progressEntry.findMany({
    where: {
      userId,
      date: {
        gte: start,
        lte: end,
      },
    },
    select: { date: true },
  });

  const uniqueDates = new Set(
    entries.map((e) => format(e.date, 'yyyy-MM-dd'))
  );

  return {
    daysWithProgress: uniqueDates.size,
    totalEntries: entries.length,
  };
}
