import { addDays, subDays } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import prisma from '../db/client.js';
import { PLAN_STATUSES, getLocalDayKey } from './daily-plan.service.js';
import { TASK_STATUSES } from './task.service.js';
import type { Language } from '../types/index.js';

interface WeekRange {
  start: Date;
  end: Date;
}

interface AreaWeeklyStat {
  areaId: string;
  title: string;
  emoji: string | null;
  total: number;
  done: number;
}

export interface WeeklyStatsResult {
  periodStart: Date;
  periodEnd: Date;
  daysWithPlan: number;
  avgTasksPerDay: number;
  completionRate: number;
  totalTasks: number;
  doneTasks: number;
  areaStats: AreaWeeklyStat[];
}

function fromLocalDayKey(localDayKey: string, timezone: string): Date {
  return fromZonedTime(`${localDayKey}T00:00:00`, timezone);
}

function shiftLocalDayKey(
  localDayKey: string,
  timezone: string,
  deltaDays: number
): string {
  const noonUtc = fromZonedTime(`${localDayKey}T12:00:00`, timezone);
  const shiftedNoonUtc =
    deltaDays >= 0 ? addDays(noonUtc, deltaDays) : subDays(noonUtc, -deltaDays);
  return formatInTimeZone(shiftedNoonUtc, timezone, 'yyyy-MM-dd');
}

function getWeekRangeInTimezone(date: Date, timezone: string): WeekRange {
  const localToday = getLocalDayKey(date, timezone);
  const isoDay = Number(formatInTimeZone(date, timezone, 'i')); // 1..7, Monday first

  const startDayKey = shiftLocalDayKey(localToday, timezone, -(isoDay - 1));
  const endDayKey = shiftLocalDayKey(localToday, timezone, 7 - isoDay);

  return {
    start: fromLocalDayKey(startDayKey, timezone),
    end: fromLocalDayKey(endDayKey, timezone),
  };
}

/**
 * Calendar week stats (Mon-Sun) for current week in user's timezone.
 */
export async function getCalendarWeekStats(
  userId: string,
  timezone: string,
  referenceDate: Date = new Date()
): Promise<WeeklyStatsResult> {
  const range = getWeekRangeInTimezone(referenceDate, timezone);

  const plans = await prisma.dailyPlan.findMany({
    where: {
      userId,
      date: {
        gte: range.start,
        lte: range.end,
      },
      status: {
        in: [
          PLAN_STATUSES.CONFIRMED,
          PLAN_STATUSES.REVIEW_PENDING,
          PLAN_STATUSES.REVIEWED,
        ],
      },
    },
    include: {
      tasks: {
        include: {
          area: {
            select: {
              id: true,
              title: true,
              emoji: true,
            },
          },
        },
      },
    },
  });

  const daysWithPlan = plans.length;
  const tasks = plans.flatMap((plan) => plan.tasks);
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((task) => task.status === TASK_STATUSES.DONE).length;
  const completionRate =
    totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const avgTasksPerDay =
    daysWithPlan > 0 ? Number((totalTasks / daysWithPlan).toFixed(1)) : 0;

  const areaMap = new Map<string, AreaWeeklyStat>();

  for (const task of tasks) {
    if (!task.areaId || !task.area) {
      continue;
    }

    const current = areaMap.get(task.areaId) ?? {
      areaId: task.areaId,
      title: task.area.title,
      emoji: task.area.emoji,
      total: 0,
      done: 0,
    };

    current.total += 1;
    if (task.status === TASK_STATUSES.DONE) {
      current.done += 1;
    }

    areaMap.set(task.areaId, current);
  }

  const areaStats = Array.from(areaMap.values()).sort((a, b) => b.total - a.total);

  return {
    periodStart: range.start,
    periodEnd: range.end,
    daysWithPlan,
    avgTasksPerDay,
    completionRate,
    totalTasks,
    doneTasks,
    areaStats,
  };
}

/**
 * Format weekly stats into user-readable message.
 */
export function formatCalendarWeekStatsMessage(
  stats: WeeklyStatsResult,
  language: Language,
  timezone: string
): string {
  const locale = language === 'ru' ? ru : enUS;
  const periodStart = formatInTimeZone(stats.periodStart, timezone, 'dd MMM', {
    locale,
  });
  const periodEnd = formatInTimeZone(stats.periodEnd, timezone, 'dd MMM', {
    locale,
  });
  const period = `${periodStart} - ${periodEnd}`;

  const lines: string[] = [];

  if (language === 'ru') {
    lines.push(`📊 *Статистика за неделю* (${period})`);
    lines.push('');
    lines.push(`• Дней с планом: ${stats.daysWithPlan}`);
    lines.push(`• Среднее задач в день: ${stats.avgTasksPerDay}`);
    lines.push(`• Выполнено: ${stats.doneTasks}/${stats.totalTasks} (${stats.completionRate}%)`);
    lines.push('');

    if (stats.areaStats.length > 0) {
      lines.push('*По направлениям:*');
      for (const area of stats.areaStats) {
        const emoji = area.emoji ?? '•';
        const pct = area.total > 0 ? Math.round((area.done / area.total) * 100) : 0;
        lines.push(`${emoji} ${area.title}: ${area.done}/${area.total} (${pct}%)`);
      }
    } else {
      lines.push('_Нет привязанных к направлениям задач за эту неделю._');
    }
  } else {
    lines.push(`📊 *Weekly stats* (${period})`);
    lines.push('');
    lines.push(`• Days with a plan: ${stats.daysWithPlan}`);
    lines.push(`• Avg tasks/day: ${stats.avgTasksPerDay}`);
    lines.push(`• Completed: ${stats.doneTasks}/${stats.totalTasks} (${stats.completionRate}%)`);
    lines.push('');

    if (stats.areaStats.length > 0) {
      lines.push('*By areas:*');
      for (const area of stats.areaStats) {
        const emoji = area.emoji ?? '•';
        const pct = area.total > 0 ? Math.round((area.done / area.total) * 100) : 0;
        lines.push(`${emoji} ${area.title}: ${area.done}/${area.total} (${pct}%)`);
      }
    } else {
      lines.push('_No tasks linked to areas this week._');
    }
  }

  return lines.join('\n');
}
