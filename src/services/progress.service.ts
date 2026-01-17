import prisma from '../db/client.js';
import type { ProgressEntry, Area } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/**
 * Progress service handles all progress entry operations.
 */

/**
 * Get today's date in user's timezone, normalized to start of day.
 */
export function getTodayInTimezone(timezone: string): Date {
  const now = new Date();
  const zonedTime = toZonedTime(now, timezone);
  return startOfDay(zonedTime);
}

/**
 * Get a progress entry for a specific area on a specific date.
 */
export async function getProgressEntry(
  userId: string,
  areaId: string,
  date: Date
): Promise<ProgressEntry | null> {
  return prisma.progressEntry.findUnique({
    where: {
      userId_areaId_date: {
        userId,
        areaId,
        date: startOfDay(date),
      },
    },
  });
}

/**
 * Get all progress entries for a user on a specific date.
 * Includes both regular entries and check-in entries.
 */
export async function getDayProgress(
  userId: string,
  date: Date
): Promise<ProgressEntry[]> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  return prisma.progressEntry.findMany({
    where: {
      userId,
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
  });
}

/**
 * Get areas that don't have a progress entry for today.
 */
export async function getAreasWithoutTodayProgress(
  userId: string,
  timezone: string
): Promise<Area[]> {
  const today = getTodayInTimezone(timezone);

  const allAreas = await prisma.area.findMany({
    where: { userId },
    orderBy: { position: 'asc' },
  });

  const todayEntries = await getDayProgress(userId, today);
  // Filter out check-in entries (areaId is null)
  const loggedAreaIds = new Set(
    todayEntries.filter((e) => e.areaId !== null).map((e) => e.areaId)
  );

  return allAreas.filter((area) => !loggedAreaIds.has(area.id));
}

/**
 * Check if user has logged any progress today (including check-ins).
 * This is used to determine if progress reminder should be sent.
 */
export async function hasProgressToday(
  userId: string,
  timezone: string
): Promise<boolean> {
  const today = getTodayInTimezone(timezone);
  const entries = await getDayProgress(userId, today);
  return entries.length > 0;
}

/**
 * Check if user has any real progress today (excluding check-ins).
 */
export async function hasRealProgressToday(
  userId: string,
  timezone: string
): Promise<boolean> {
  const today = getTodayInTimezone(timezone);
  const entries = await getDayProgress(userId, today);
  // Real progress = entries with content (not skipped, not check-in)
  return entries.some((e) => e.areaId !== null && !e.skipped && e.content);
}

/**
 * Log progress for a single area.
 * Uses upsert to handle both new entries and updates.
 */
export async function logProgress(
  userId: string,
  areaId: string,
  content: string,
  date: Date
): Promise<ProgressEntry> {
  const normalizedDate = startOfDay(date);

  return prisma.progressEntry.upsert({
    where: {
      userId_areaId_date: {
        userId,
        areaId,
        date: normalizedDate,
      },
    },
    update: { content, skipped: false },
    create: {
      userId,
      areaId,
      content,
      skipped: false,
      date: normalizedDate,
    },
  });
}

/**
 * Create a check-in entry (user skipped all areas but wanted to maintain streak).
 * Only one check-in per user per day.
 */
export async function createCheckIn(
  userId: string,
  date: Date
): Promise<ProgressEntry> {
  const normalizedDate = startOfDay(date);

  // Check if check-in already exists for this day
  const existing = await prisma.progressEntry.findFirst({
    where: {
      userId,
      areaId: null,
      date: normalizedDate,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.progressEntry.create({
    data: {
      userId,
      areaId: null,
      content: null,
      skipped: true,
      date: normalizedDate,
    },
  });
}

/**
 * Log progress for multiple areas in a single transaction.
 * If all entries are skipped, creates a check-in entry instead.
 */
export async function logProgressBatch(
  userId: string,
  entries: Array<{ areaId: string; content: string }>,
  skippedCount: number,
  date: Date
): Promise<ProgressEntry[]> {
  const normalizedDate = startOfDay(date);

  // If no real entries, create a check-in
  if (entries.length === 0 && skippedCount > 0) {
    const checkIn = await createCheckIn(userId, date);
    return [checkIn];
  }

  // Create regular entries
  const operations = entries.map((entry) =>
    prisma.progressEntry.upsert({
      where: {
        userId_areaId_date: {
          userId,
          areaId: entry.areaId,
          date: normalizedDate,
        },
      },
      update: { content: entry.content, skipped: false },
      create: {
        userId,
        areaId: entry.areaId,
        content: entry.content,
        skipped: false,
        date: normalizedDate,
      },
    })
  );

  return prisma.$transaction(operations);
}

/**
 * Get progress entries for a date range, grouped by date.
 * Useful for generating AI prompts and statistics.
 */
export async function getProgressForDateRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<ProgressEntry[]> {
  return prisma.progressEntry.findMany({
    where: {
      userId,
      areaId: { not: null }, // Exclude check-in entries
      date: {
        gte: startOfDay(startDate),
        lte: endOfDay(endDate),
      },
    },
    include: {
      area: true,
    },
    orderBy: [{ date: 'desc' }, { area: { position: 'asc' } }],
  });
}

/**
 * Get progress entries for the last N days.
 */
export async function getRecentProgress(
  userId: string,
  days: number
): Promise<ProgressEntry[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);

  return getProgressForDateRange(userId, startDate, endDate);
}

/**
 * Get the most recent progress entry for a user.
 */
export async function getLastProgressEntry(
  userId: string
): Promise<ProgressEntry | null> {
  return prisma.progressEntry.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Delete all progress entries for a user (used in reset).
 */
export async function deleteAllProgress(userId: string): Promise<void> {
  await prisma.progressEntry.deleteMany({
    where: { userId },
  });
}
