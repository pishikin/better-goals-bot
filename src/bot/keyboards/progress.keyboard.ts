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
