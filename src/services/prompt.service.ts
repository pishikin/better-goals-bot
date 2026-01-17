import type { User, Area, ProgressEntry } from '@prisma/client';
import { getUserAreas } from './areas.service.js';
import { getRecentProgress } from './progress.service.js';
import { getUserStatistics } from './statistics.service.js';
import { format, subDays, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/**
 * Prompt service generates AI analysis prompts for users.
 * No AI API integration - users copy the prompt to ChatGPT/Claude manually.
 */

interface ProgressWithArea extends ProgressEntry {
  area: Area;
}

/**
 * Generate an AI analysis prompt based on user's progress.
 * Default is 7 days of data.
 */
export async function generateAnalysisPrompt(
  user: User,
  days: number = 7
): Promise<string> {
  const areas = await getUserAreas(user.id);
  const progress = (await getRecentProgress(
    user.id,
    days
  )) as ProgressWithArea[];
  const stats = await getUserStatistics(user.id, user.timezone);

  // Get date range for context
  const now = new Date();
  const zonedNow = toZonedTime(now, user.timezone);
  const today = startOfDay(zonedNow);
  const startDate = subDays(today, days - 1);

  const dateRange = `${format(startDate, 'MMM d')} - ${format(today, 'MMM d, yyyy')}`;

  const lines: string[] = [
    '='.repeat(50),
    'PERSONAL PROGRESS ANALYSIS REQUEST',
    '='.repeat(50),
    '',
    `Period: ${dateRange} (${days} days)`,
    '',
  ];

  // Section 1: Focus Areas
  lines.push('## MY FOCUS AREAS');
  lines.push('');
  if (areas.length === 0) {
    lines.push('No areas defined.');
  } else {
    areas.forEach((area, index) => {
      const emoji = area.emoji ?? '•';
      lines.push(`${index + 1}. ${emoji} ${area.title}`);
      if (area.body) {
        lines.push(`   Description: ${area.body}`);
      }
    });
  }
  lines.push('');

  // Section 2: Progress Entries
  lines.push('## DAILY PROGRESS LOG');
  lines.push('');

  if (progress.length === 0) {
    lines.push('No progress entries in this period.');
  } else {
    // Group by date
    const groupedByDate = groupProgressByDate(progress, user.timezone);

    for (const [dateStr, entries] of Object.entries(groupedByDate)) {
      lines.push(`### ${dateStr}`);
      entries.forEach((entry) => {
        const emoji = entry.area.emoji ?? '•';
        lines.push(`- ${emoji} ${entry.area.title}: ${entry.content}`);
      });
      lines.push('');
    }
  }

  // Section 3: Statistics
  lines.push('## STATISTICS');
  lines.push('');
  lines.push(`- Current streak: ${stats.currentStreak} days`);
  lines.push(`- Weekly activity: ${stats.weeklyActivity}/7 days`);
  lines.push(`- Total entries logged: ${stats.totalEntries}`);
  lines.push('');

  // Section 4: Analysis Request
  lines.push('## ANALYSIS REQUEST');
  lines.push('');
  lines.push('Based on the above progress log, please provide:');
  lines.push('');
  lines.push('1. **Patterns & Trends**');
  lines.push('   - Which areas am I consistently working on?');
  lines.push('   - Which areas are being neglected?');
  lines.push('   - Are there any notable patterns in my activity?');
  lines.push('');
  lines.push('2. **Progress Assessment**');
  lines.push('   - What am I doing well?');
  lines.push('   - Where could I improve?');
  lines.push('   - Am I making meaningful progress toward my goals?');
  lines.push('');
  lines.push('3. **Recommendations**');
  lines.push('   - Specific, actionable suggestions for the next week');
  lines.push('   - Any areas that need more attention');
  lines.push('   - Ways to maintain momentum');
  lines.push('');
  lines.push('4. **Questions to Consider**');
  lines.push('   - Thought-provoking questions about my priorities');
  lines.push('   - Are my current areas aligned with my long-term goals?');
  lines.push('');
  lines.push('='.repeat(50));

  return lines.join('\n');
}

/**
 * Group progress entries by date for display.
 */
function groupProgressByDate(
  progress: ProgressWithArea[],
  timezone: string
): Record<string, ProgressWithArea[]> {
  const grouped: Record<string, ProgressWithArea[]> = {};

  for (const entry of progress) {
    const zonedDate = toZonedTime(entry.date, timezone);
    const dateStr = format(zonedDate, 'EEEE, MMM d');

    if (!grouped[dateStr]) {
      grouped[dateStr] = [];
    }
    grouped[dateStr].push(entry);
  }

  return grouped;
}

/**
 * Generate a shorter summary prompt (for quick insights).
 */
export async function generateQuickSummary(user: User): Promise<string> {
  const areas = await getUserAreas(user.id);
  const progress = (await getRecentProgress(user.id, 3)) as ProgressWithArea[];
  const stats = await getUserStatistics(user.id, user.timezone);

  const lines: string[] = [
    'Quick progress summary for the last 3 days:',
    '',
    `Areas: ${areas.map((a) => a.emoji ?? a.title).join(' ')}`,
    `Streak: ${stats.currentStreak} days`,
    '',
  ];

  if (progress.length > 0) {
    lines.push('Recent activity:');
    progress.slice(0, 5).forEach((entry) => {
      const emoji = entry.area.emoji ?? '•';
      lines.push(`- ${emoji} ${entry.content}`);
    });
  } else {
    lines.push('No recent activity. Time to log some progress!');
  }

  return lines.join('\n');
}
