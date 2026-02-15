import { InlineKeyboard } from 'grammy';

/**
 * Progress logging keyboard factory functions.
 */

type TranslateFn = (key: string, params?: Record<string, any>) => string;

/**
 * Create the progress logging control keyboard.
 * Shows Skip and Cancel All options during logging.
 */
export function createProgressControlKeyboard(t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard()
    .text(translate('btn-skip'), 'progress:skip')
    .text(translate('btn-cancel-all'), 'progress:cancel');
}

/**
 * Create a simple skip keyboard.
 */
export function createSkipKeyboard(t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard().text(translate('btn-skip'), 'progress:skip');
}

/**
 * Create a "no areas need logging" keyboard.
 * Shown when all areas have been logged today.
 */
export function createAllLoggedKeyboard(t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard()
    .text(translate('btn-generate-summary'), 'action:summary')
    .row()
    .text(translate('btn-back'), 'action:back');
}

/**
 * Create a progress complete keyboard.
 */
export function createProgressCompleteKeyboard(t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard()
    .text(translate('btn-generate-summary'), 'action:summary')
    .text(translate('btn-back'), 'action:main_menu');
}

/**
 * Create a keyboard for selecting progress date.
 * Shows options: Today, Past Period, Back
 */
export function createProgressDateSelectionKeyboard(t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard()
    .text(translate('btn-today'), 'progress:date:today')
    .text(translate('btn-past-period'), 'progress:date:past')
    .row()
    .text(translate('btn-back'), 'action:back');
}

/**
 * Create a keyboard for selecting past date.
 * Shows last 3 days + custom date input option.
 */
export function createPastDateSelectionKeyboard(
  lastThreeDays: Array<{ date: Date; label: string }>,
  t?: TranslateFn
): InlineKeyboard {
  const translate = t || ((key: string) => key);
  const keyboard = new InlineKeyboard();

  // Add buttons for last 3 days
  for (const day of lastThreeDays) {
    keyboard.text(day.label, `progress:date:${day.date.toISOString()}`).row();
  }

  // Add custom date input button
  keyboard.text(translate('btn-custom-date'), 'progress:date:custom').row();
  keyboard.text(translate('btn-back'), 'progress:date:back');

  return keyboard;
}
