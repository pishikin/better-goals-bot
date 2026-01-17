import { InlineKeyboard } from 'grammy';

/**
 * Main menu keyboard factory functions.
 * Uses inline keyboards for better UX and callback handling.
 */

/**
 * Create the main menu keyboard for the pinned message.
 * Shows primary actions: Log Progress, Add Area, Edit, Settings
 */
export function createMainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📝 Log Progress', 'action:progress')
    .text('➕ Add', 'action:add_area')
    .row()
    .text('✏️ Edit', 'action:edit_areas')
    .text('⚙️ Settings', 'action:settings');
}

/**
 * Create a simple back button keyboard.
 */
export function createBackKeyboard(callbackData: string = 'action:back'): InlineKeyboard {
  return new InlineKeyboard().text('← Back', callbackData);
}

/**
 * Create a cancel button keyboard.
 */
export function createCancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('❌ Cancel', 'action:cancel');
}

/**
 * Create a confirmation keyboard (Yes/No).
 */
export function createConfirmKeyboard(
  confirmCallback: string,
  cancelCallback: string = 'action:cancel'
): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Yes', confirmCallback)
    .text('❌ No', cancelCallback);
}

/**
 * Create a done/continue keyboard for multi-step flows.
 */
export function createDoneKeyboard(doneCallback: string = 'action:done'): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Done', doneCallback)
    .text('❌ Cancel', 'action:cancel');
}
