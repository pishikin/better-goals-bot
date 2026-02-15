import prisma from '../db/client.js';
import type { User } from '@prisma/client';

/**
 * User service handles all user-related database operations.
 */

const MAX_REMINDER_TIMES = 3;
const DEFAULT_DAILY_REMINDERS = ['14:00'];

/**
 * Parse JSON array string of times (HH:mm) into string[].
 */
function parseTimeList(raw: string | null): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

/**
 * Serialize times list into JSON string with max-limit guard.
 */
function serializeTimeList(times: string[]): string | null {
  if (times.length === 0) {
    return null;
  }

  return JSON.stringify(times.slice(0, MAX_REMINDER_TIMES));
}

/**
 * Parse legacy digest times.
 */
export function parseDigestTimes(digestTimes: string | null): string[] {
  return parseTimeList(digestTimes);
}

/**
 * Parse new daily reminder times.
 */
export function parseDailyReminderTimes(
  dailyRemindersTimes: string | null
): string[] {
  return parseTimeList(dailyRemindersTimes);
}

/**
 * Return user's reminder times with fallback:
 * new field -> legacy digest field -> default.
 */
export function getUserDailyReminderTimes(user: User): string[] {
  const primary = parseDailyReminderTimes(user.dailyRemindersTimes);
  if (primary.length > 0) return primary;

  const legacy = parseDigestTimes(user.digestTimes);
  if (legacy.length > 0) return legacy;

  return [...DEFAULT_DAILY_REMINDERS];
}

/**
 * Legacy alias for existing code.
 */
export function getUserDigestTimes(user: User): string[] {
  return getUserDailyReminderTimes(user);
}

/**
 * Get or create a user by their Telegram ID.
 */
export async function getOrCreateUser(telegramId: bigint): Promise<User> {
  const existingUser = await prisma.user.findUnique({
    where: { telegramId },
  });

  if (existingUser) {
    return existingUser;
  }

  return prisma.user.create({
    data: { telegramId },
  });
}

/**
 * Get a user by their internal ID.
 */
export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id },
  });
}

/**
 * Get a user by their Telegram ID.
 */
export async function getUserByTelegramId(
  telegramId: bigint
): Promise<User | null> {
  return prisma.user.findUnique({
    where: { telegramId },
  });
}

/**
 * Alias for consistency with other services.
 */
export const findByTelegramId = getUserByTelegramId;

/**
 * Mark onboarding as complete.
 */
export async function completeOnboarding(userId: string): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { onboardingCompleted: true },
  });
}

/**
 * Mark new-model onboarding message as shown.
 */
export async function markNewModelOnboardingShown(
  userId: string
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { newModelOnboardingShownAt: new Date() },
  });
}

/**
 * Update language.
 */
export async function updateLanguage(
  userId: string,
  language: string
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { language },
  });
}

/**
 * Update timezone.
 */
export async function updateTimezone(
  userId: string,
  timezone: string
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { timezone },
  });
}

/**
 * Update morning plan reminder time.
 */
export async function updateMorningPlanTime(
  userId: string,
  time: string | null
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { morningPlanTime: time },
  });
}

/**
 * Update evening review time.
 * Also syncs legacy progressReminderTime for backward compatibility.
 */
export async function updateEveningReviewTime(
  userId: string,
  time: string | null
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      eveningReviewTime: time,
      progressReminderTime: time,
    },
  });
}

/**
 * Legacy alias: keep old API but sync with new evening field.
 */
export async function updateProgressReminderTime(
  userId: string,
  time: string | null
): Promise<User> {
  return updateEveningReviewTime(userId, time);
}

/**
 * Set daily reminder times.
 * Updates both new and legacy digest fields during transition.
 */
export async function setDailyReminderTimes(
  userId: string,
  times: string[]
): Promise<User> {
  const normalized = Array.from(new Set(times)).sort().slice(0, MAX_REMINDER_TIMES);

  return prisma.user.update({
    where: { id: userId },
    data: {
      dailyRemindersTimes: serializeTimeList(normalized),
      dailyRemindersCount: Math.max(1, normalized.length || 1),
      digestTimes: serializeTimeList(normalized),
    },
  });
}

/**
 * Add a daily reminder time.
 * Returns false if max limit reached.
 */
export async function addDigestTime(
  userId: string,
  time: string
): Promise<{ success: boolean; user: User }> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const currentTimes = getUserDailyReminderTimes(user);

  if (currentTimes.length >= MAX_REMINDER_TIMES) {
    return { success: false, user };
  }

  if (currentTimes.includes(time)) {
    return { success: true, user };
  }

  const newTimes = [...currentTimes, time].sort();
  const updatedUser = await setDailyReminderTimes(userId, newTimes);
  return { success: true, user: updatedUser };
}

/**
 * Remove one reminder time.
 */
export async function removeDigestTime(
  userId: string,
  time: string
): Promise<User> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const currentTimes = getUserDailyReminderTimes(user);
  const newTimes = currentTimes.filter((value) => value !== time);

  if (newTimes.length === 0) {
    // Keep at least one reminder in new model defaults
    return setDailyReminderTimes(userId, DEFAULT_DAILY_REMINDERS);
  }

  return setDailyReminderTimes(userId, newTimes);
}

/**
 * Legacy alias.
 */
export async function setDigestTimes(
  userId: string,
  times: string[]
): Promise<User> {
  return setDailyReminderTimes(userId, times);
}

/**
 * Clear reminder times (resets to default one reminder).
 */
export async function clearDigestTimes(userId: string): Promise<User> {
  return setDailyReminderTimes(userId, DEFAULT_DAILY_REMINDERS);
}

/**
 * Update pinned message ID.
 */
export async function updatePinnedMessageId(
  userId: string,
  messageId: bigint | null
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { pinnedMessageId: messageId },
  });
}

/**
 * Full reset - destructive operation.
 */
export async function fullReset(userId: string): Promise<User> {
  // Keep language/timezone, wipe user-generated content.
  await prisma.task.deleteMany({
    where: { userId },
  });

  await prisma.dailyPlan.deleteMany({
    where: { userId },
  });

  await prisma.area.deleteMany({
    where: { userId },
  });

  await prisma.progressEntry.deleteMany({
    where: { userId },
  });

  return prisma.user.update({
    where: { id: userId },
    data: {
      digestTimes: serializeTimeList(DEFAULT_DAILY_REMINDERS),
      progressReminderTime: '21:00',
      morningPlanTime: '09:00',
      eveningReviewTime: '21:00',
      dailyRemindersCount: 1,
      dailyRemindersTimes: serializeTimeList(DEFAULT_DAILY_REMINDERS),
      taskAreaLinkingEnabled: false,
      newModelOnboardingShownAt: null,
      pinnedMessageId: null,
      onboardingCompleted: false,
    },
  });
}

/**
 * Get all onboarded users.
 */
export async function getOnboardedUsers(): Promise<User[]> {
  return prisma.user.findMany({
    where: {
      onboardingCompleted: true,
    },
  });
}

/**
 * Legacy API: users with digest settings.
 */
export async function getUsersForDigest(): Promise<User[]> {
  return prisma.user.findMany({
    where: {
      onboardingCompleted: true,
    },
  });
}

/**
 * Legacy API: users with progress reminder.
 */
export async function getUsersForProgressReminder(): Promise<User[]> {
  return prisma.user.findMany({
    where: {
      onboardingCompleted: true,
    },
  });
}

export const userService = {
  getOrCreateUser,
  getUserById,
  getUserByTelegramId,
  findByTelegramId,
  completeOnboarding,
  markNewModelOnboardingShown,
  updateLanguage,
  updateTimezone,
  updateMorningPlanTime,
  updateEveningReviewTime,
  updateProgressReminderTime,
  parseDigestTimes,
  parseDailyReminderTimes,
  getUserDigestTimes,
  getUserDailyReminderTimes,
  addDigestTime,
  removeDigestTime,
  setDigestTimes,
  setDailyReminderTimes,
  clearDigestTimes,
  updatePinnedMessageId,
  fullReset,
  getOnboardedUsers,
  getUsersForDigest,
  getUsersForProgressReminder,
};

