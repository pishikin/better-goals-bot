import type { User, Area } from '@prisma/client';
import { getUserAreas } from './areas.service.js';
import { getUserStatistics, getLastProgressDate } from './statistics.service.js';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/**
 * Digest service handles digest (goals overview) generation.
 * Digests are always sent at configured times to help users stay focused.
 */

/**
 * Format an area for display in the digest.
 */
function formatArea(area: Area, index: number): string {
  const emoji = area.emoji ?? '•';
  const body = area.body ? `\n   → ${area.body}` : '';
  return `${index + 1}. ${emoji} ${area.title}${body}`;
}

/**
 * Generate the digest message for a user.
 * Shows their focus areas and current statistics.
 * This is sent to remind users of their goals throughout the day.
 */
export async function generateDigest(user: User): Promise<string> {
  const areas = await getUserAreas(user.id);
  const stats = await getUserStatistics(user.id, user.timezone);
  const lastProgressDate = await getLastProgressDate(user.id);

  // Get current time in user's timezone
  const now = new Date();
  const zonedNow = toZonedTime(now, user.timezone);
  const greeting = getTimeBasedGreeting(zonedNow.getHours());

  // Build the message
  const lines: string[] = [
    `${greeting}`,
    '',
    "📋 *It's time to review your goals*",
    '',
    '🎯 *Your Focus Areas*',
    '',
  ];

  if (areas.length === 0) {
    lines.push('_No areas defined yet. Use /areas to add some!_');
  } else {
    areas.forEach((area, index) => {
      lines.push(formatArea(area, index));
    });
  }

  lines.push('');
  lines.push('───────────────');

  // Stats line
  const statsLine = buildStatsLine(stats.currentStreak, lastProgressDate, user.timezone);
  lines.push(statsLine);

  lines.push('');
  lines.push('Stay focused and make progress! 💪');

  return lines.join('\n');
}

/**
 * Get a greeting based on the time of day.
 */
function getTimeBasedGreeting(hour: number): string {
  if (hour < 12) {
    return '☀️ Good morning!';
  } else if (hour < 17) {
    return '🌤 Good afternoon!';
  } else {
    return '🌙 Good evening!';
  }
}

/**
 * Build the statistics line for the digest.
 */
function buildStatsLine(
  streak: number,
  lastProgressDate: Date | null,
  timezone: string
): string {
  const parts: string[] = [];

  if (streak > 0) {
    parts.push(`🔥 ${streak} day${streak > 1 ? 's' : ''} streak`);
  }

  if (lastProgressDate) {
    const zonedDate = toZonedTime(lastProgressDate, timezone);
    const formattedDate = format(zonedDate, 'MMM d');
    parts.push(`Last: ${formattedDate}`);
  }

  if (parts.length === 0) {
    return '📊 Start your streak today!';
  }

  return parts.join(' | ');
}

// Keep old function name for backward compatibility
export const generateMorningDigest = generateDigest;
