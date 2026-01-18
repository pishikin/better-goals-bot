import { InlineKeyboard } from 'grammy';

/**
 * Main menu keyboard factory functions.
 * Uses inline keyboards for better UX and callback handling.
 */

type TranslateFn = (key: string) => string;

/**
 * Create the main menu keyboard for the pinned message.
 * Shows primary actions: Log Progress, Add Area, Edit, Settings
 */
export function createMainMenuKeyboard(t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);

  return new InlineKeyboard()
    .text(translate('common.btn-log-progress'), 'action:progress')
    .text(translate('common.btn-add-area'), 'action:add_area')
    .row()
    .text(translate('common.btn-edit'), 'action:edit_areas')
    .text(translate('common.btn-settings'), 'action:settings');
}

/**
 * Create a simple back button keyboard.
 */
export function createBackKeyboard(
  t?: TranslateFn,
  callbackData: string = 'action:back'
): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard().text(translate('common.btn-back'), callbackData);
}

/**
 * Create a cancel button keyboard.
 */
export function createCancelKeyboard(t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard().text(translate('common.btn-cancel'), 'action:cancel');
}

/**
 * Create a confirmation keyboard (Yes/No).
 */
export function createConfirmKeyboard(
  confirmCallback: string,
  t?: TranslateFn,
  cancelCallback: string = 'action:cancel'
): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard()
    .text(translate('common.btn-confirm-delete'), confirmCallback)
    .text(translate('common.btn-cancel'), cancelCallback);
}

/**
 * Create a done/continue keyboard for multi-step flows.
 */
export function createDoneKeyboard(
  t?: TranslateFn,
  doneCallback: string = 'action:done'
): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard()
    .text(translate('common.btn-done') || '✅ Done', doneCallback)
    .text(translate('common.btn-cancel'), 'action:cancel');
}
