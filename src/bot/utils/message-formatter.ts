import type { Area, User } from '@prisma/client';
import type { UserStatistics } from '../../types/index.js';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/**
 * Message formatter utility for consistent bot message formatting.
 * Uses Telegram MarkdownV2 formatting where applicable.
 */

/**
 * Format an area for display in a list.
 */
export function formatAreaListItem(area: Area, index: number): string {
  const emoji = area.emoji ?? '•';
  const body = area.body ? `\n   → ${area.body}` : '';
  return `${index + 1}. ${emoji} ${area.title}${body}`;
}

/**
 * Format multiple areas as a numbered list.
 */
export function formatAreasList(areas: Area[]): string {
  if (areas.length === 0) {
    return '_No focus areas defined yet._';
  }

  return areas.map((area, index) => formatAreaListItem(area, index)).join('\n\n');
}

/**
 * Format the pinned message with all areas and statistics.
 * This is the main summary message that gets pinned in the chat.
 */
export function formatPinnedMessage(
  areas: Area[],
  stats: UserStatistics,
  lastProgressDate: Date | null,
  timezone: string
): string {
  const lines: string[] = ['🎯 YOUR FOCUS AREAS', ''];

  if (areas.length === 0) {
    lines.push('_No areas yet. Add your first focus area!_');
  } else {
    areas.forEach((area, index) => {
      lines.push(formatAreaListItem(area, index));
    });
  }

  lines.push('');
  lines.push('───────────────');

  // Build stats line
  const statsParts: string[] = [];

  if (stats.currentStreak > 0) {
    statsParts.push(`🔥 ${stats.currentStreak} days`);
  }

  if (lastProgressDate) {
    const zonedDate = toZonedTime(lastProgressDate, timezone);
    const now = new Date();
    const zonedNow = toZonedTime(now, timezone);
    const todayStr = format(zonedNow, 'yyyy-MM-dd');
    const lastStr = format(zonedDate, 'yyyy-MM-dd');

    if (todayStr === lastStr) {
      const timeStr = format(zonedDate, 'HH:mm');
      statsParts.push(`Last: Today ${timeStr}`);
    } else {
      const dateStr = format(zonedDate, 'MMM d');
      statsParts.push(`Last: ${dateStr}`);
    }
  }

  if (statsParts.length > 0) {
    lines.push(statsParts.join(' | '));
  } else {
    lines.push('📊 Start your streak today!');
  }

  return lines.join('\n');
}

/**
 * Format a progress logging session header.
 * Shows which area is being logged and progress through the session.
 */
export function formatProgressHeader(
  currentIndex: number,
  totalAreas: number,
  area: Area
): string {
  const emoji = area.emoji ?? '📝';
  const body = area.body ? `\n→ ${area.body}` : '';

  return [
    `${currentIndex}/${totalAreas} ${emoji} *${escapeMarkdown(area.title)}*${body}`,
    '',
    'What did you accomplish?',
  ].join('\n');
}

/**
 * Format a progress session summary after completion.
 */
export function formatProgressSummary(
  loggedCount: number,
  skippedCount: number,
  streak: number
): string {
  const lines: string[] = ['✅ *Progress logged!*', ''];

  if (loggedCount > 0) {
    lines.push(`📝 ${loggedCount} area${loggedCount > 1 ? 's' : ''} updated`);
  }

  if (skippedCount > 0) {
    lines.push(`⏭ ${skippedCount} area${skippedCount > 1 ? 's' : ''} skipped`);
  }

  if (streak > 0) {
    lines.push('');
    lines.push(`🔥 Current streak: ${streak} day${streak > 1 ? 's' : ''}`);
  }

  return lines.join('\n');
}

/**
 * Format the onboarding welcome message.
 */
export function formatWelcomeMessage(): string {
  return [
    '👋 *Welcome to Better Goals!*',
    '',
    "This bot helps you track progress on up to 7 key life areas. The philosophy is simple: *less is more*.",
    '',
    'Focus on what truly matters, log your daily progress, and build momentum through consistency.',
    '',
    "Let's set up your focus areas to get started.",
  ].join('\n');
}

/**
 * Format the onboarding completion message.
 */
export function formatOnboardingComplete(areasCount: number): string {
  return [
    '🎉 *Setup Complete!*',
    '',
    `You've defined ${areasCount} focus area${areasCount > 1 ? 's' : ''}.`,
    '',
    '*What\'s next:*',
    '• Use /progress to log your daily activities',
    '• Check /summary for AI-powered insights',
    '• Adjust settings with /settings',
    '',
    'Your pinned message will show your areas and streak.',
    '',
    'Good luck on your journey! 🚀',
  ].join('\n');
}

/**
 * Format an area confirmation after creation.
 */
export function formatAreaCreated(area: Area): string {
  const emoji = area.emoji ?? '✓';
  const body = area.body ? `\n→ ${area.body}` : '';

  return `${emoji} *${escapeMarkdown(area.title)}* added${body}`;
}

/**
 * Format a deletion warning for an area.
 */
export function formatDeleteWarning(area: Area): string {
  const emoji = area.emoji ?? '📌';

  return [
    `Delete "${emoji} ${area.title}"?`,
    '',
    '⚠️ All progress history for this area will be permanently deleted.',
  ].join('\n');
}

/**
 * Format an error message for the user.
 */
export function formatErrorMessage(error: string): string {
  return `❌ ${error}`;
}

/**
 * Format a validation error message.
 */
export function formatValidationError(field: string, error: string): string {
  return `⚠️ *${field}:* ${error}`;
}

/**
 * Format a success message.
 */
export function formatSuccessMessage(message: string): string {
  return `✅ ${message}`;
}

/**
 * Format a skip confirmation during progress logging.
 */
export function formatSkipConfirmation(area: Area): string {
  const emoji = area.emoji ?? '📌';
  return `⏭ Skipped ${emoji} ${area.title}`;
}

/**
 * Format the settings menu header.
 */
export function formatSettingsMenu(user: User, digestTimes: string[] = []): string {
  const lines: string[] = ['⚙️ *Settings*', ''];

  lines.push(`🌍 *Timezone:* ${user.timezone}`);

  if (digestTimes.length > 0) {
    lines.push(`📋 *Digest times:* ${digestTimes.join(', ')}`);
  } else {
    lines.push('📋 *Digest reminders:* Disabled');
  }

  if (user.progressReminderTime) {
    lines.push(`📝 *Progress reminder:* ${user.progressReminderTime}`);
  } else {
    lines.push('📝 *Progress reminder:* Disabled');
  }

  return lines.join('\n');
}

/**
 * Escape special characters for Telegram MarkdownV2.
 * Use this for user-provided content that might contain special chars.
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * Format a prompt generation success message.
 */
export function formatPromptGenerated(days: number): string {
  return [
    '📋 *AI Analysis Prompt Generated*',
    '',
    `Based on your last ${days} days of progress.`,
    '',
    'Copy the prompt below and paste it into ChatGPT or Claude for personalized insights.',
    '',
    '_Tip: The more detailed your daily logs, the better the analysis!_',
  ].join('\n');
}
