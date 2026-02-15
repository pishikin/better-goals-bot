import type { Bot } from 'grammy';
import type { BotContext } from '../types/index.js';

const commandsEn = [
  { command: 'start', description: 'Open main menu' },
  { command: 'plan', description: 'Plan today (or /plan tomorrow)' },
  { command: 'tomorrow', description: 'Create or open tomorrow plan' },
  { command: 'add', description: 'Add tasks to today plan' },
  { command: 'remove', description: 'Remove task: /remove N' },
  { command: 'done', description: 'Mark task done: /done or /done N' },
  { command: 'review', description: 'Run evening review now' },
  { command: 'stats', description: 'Calendar week statistics' },
  { command: 'settings', description: 'Reminder and time settings' },
  { command: 'help', description: 'Show command list' },
  { command: 'summary', description: 'Legacy AI summary prompt' },
  { command: 'progress', description: 'Legacy progress logging flow' },
];

const commandsRu = [
  { command: 'start', description: 'Открыть главное меню' },
  { command: 'plan', description: 'План на сегодня (/plan tomorrow для завтра)' },
  { command: 'tomorrow', description: 'Создать или открыть план на завтра' },
  { command: 'add', description: 'Добавить задачи в план на сегодня' },
  { command: 'remove', description: 'Удалить задачу: /remove N' },
  { command: 'done', description: 'Отметить: /done или /done N' },
  { command: 'review', description: 'Запустить вечернюю подбивку' },
  { command: 'stats', description: 'Статистика за календарную неделю' },
  { command: 'settings', description: 'Настройки времени и напоминаний' },
  { command: 'help', description: 'Показать список команд' },
  { command: 'summary', description: 'Legacy AI prompt (старая модель)' },
  { command: 'progress', description: 'Legacy логирование прогресса' },
];

export async function registerTelegramCommands(
  bot: Bot<BotContext>
): Promise<void> {
  await bot.api.setMyCommands(commandsEn);
  await bot.api.setMyCommands(commandsRu, {
    language_code: 'ru',
  });
}
