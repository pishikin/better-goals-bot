import prisma from '../db/client.js';
import type { User } from '@prisma/client';

/**
 * User service handles all user-related database operations.
 */

// Maximum number of digest reminder times
const MAX_DIGEST_TIMES = 3;

/**
 * Parse digestTimes JSON string to array.
 */
export function parseDigestTimes(digestTimes: string | null): string[] {
  if (!digestTimes) return [];
  try {
    const parsed = JSON.parse(digestTimes) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((t): t is string => typeof t === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Serialize digest times array to JSON string.
 */
function serializeDigestTimes(times: string[]): string | null {
  if (times.length === 0) return null;
  return JSON.stringify(times.slice(0, MAX_DIGEST_TIMES));
}

/**
 * Get or create a user by their Telegram ID.
 * This is the primary method for user lookup, automatically creating
 * a new user record if one doesn't exist.
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
 * Alias for getUserByTelegramId (for consistency with other services)
 */
export const findByTelegramId = getUserByTelegramId;

/**
 * Mark user's onboarding as completed.
 */
export async function completeOnboarding(userId: string): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { onboardingCompleted: true },
  });
}

/**
 * Update user's language.
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
 * Update user's timezone.
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
 * Get user's digest times as array.
 */
export function getUserDigestTimes(user: User): string[] {
  return parseDigestTimes(user.digestTimes);
}

/**
 * Add a digest time for a user.
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

  const currentTimes = parseDigestTimes(user.digestTimes);

  if (currentTimes.length >= MAX_DIGEST_TIMES) {
    return { success: false, user };
  }

  // Avoid duplicates
  if (currentTimes.includes(time)) {
    return { success: true, user };
  }

  const newTimes = [...currentTimes, time].sort();
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { digestTimes: serializeDigestTimes(newTimes) },
  });

  return { success: true, user: updatedUser };
}

/**
 * Remove a digest time for a user.
 */
export async function removeDigestTime(
  userId: string,
  time: string
): Promise<User> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const currentTimes = parseDigestTimes(user.digestTimes);
  const newTimes = currentTimes.filter((t) => t !== time);

  return prisma.user.update({
    where: { id: userId },
    data: { digestTimes: serializeDigestTimes(newTimes) },
  });
}

/**
 * Set all digest times at once (replaces existing).
 */
export async function setDigestTimes(
  userId: string,
  times: string[]
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { digestTimes: serializeDigestTimes(times) },
  });
}

/**
 * Clear all digest times.
 */
export async function clearDigestTimes(userId: string): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { digestTimes: null },
  });
}

/**
 * Update user's progress reminder time.
 * Set to null to disable.
 */
export async function updateProgressReminderTime(
  userId: string,
  time: string | null
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { progressReminderTime: time },
  });
}

/**
 * Update user's pinned message ID.
 * This is used to track the pinned summary message in the chat.
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
 * Full reset - delete all user data and reset settings.
 * This is a destructive operation!
 */
export async function fullReset(userId: string): Promise<User> {
  // Delete all areas (progress entries cascade automatically)
  await prisma.area.deleteMany({
    where: { userId },
  });

  // Delete any orphaned progress entries (check-ins)
  await prisma.progressEntry.deleteMany({
    where: { userId },
  });

  // Reset user settings (keep language)
  return prisma.user.update({
    where: { id: userId },
    data: {
      digestTimes: null,
      progressReminderTime: null,
      pinnedMessageId: null,
      onboardingCompleted: false,
    },
  });
}

/**
 * Get all users who should receive digest at the current time.
 * Checks each user's digestTimes array.
 */
export async function getUsersForDigest(): Promise<User[]> {
  // Get all users with digest times configured
  const users = await prisma.user.findMany({
    where: {
      digestTimes: { not: null },
      onboardingCompleted: true,
    },
  });

  return users;
}

/**
 * Get all users who should receive progress reminder at the current time.
 */
export async function getUsersForProgressReminder(): Promise<User[]> {
  return prisma.user.findMany({
    where: {
      progressReminderTime: { not: null },
      onboardingCompleted: true,
    },
  });
}

// Default export for convenience
export const userService = {
  getOrCreateUser,
  getUserById,
  getUserByTelegramId,
  findByTelegramId,
  completeOnboarding,
  updateLanguage,
  updateTimezone,
  getUserDigestTimes,
  addDigestTime,
  removeDigestTime,
  setDigestTimes,
  clearDigestTimes,
  updateProgressReminderTime,
  updatePinnedMessageId,
  fullReset,
  getUsersForDigest,
  getUsersForProgressReminder,
};
