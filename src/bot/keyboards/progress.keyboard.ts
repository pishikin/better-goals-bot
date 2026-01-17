import { InlineKeyboard } from 'grammy';

/**
 * Progress logging keyboard factory functions.
 */

/**
 * Create the progress logging control keyboard.
 * Shows Skip and Cancel All options during logging.
 */
export function createProgressControlKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⏭ Skip', 'progress:skip')
    .text('❌ Cancel All', 'progress:cancel');
}

/**
 * Create a simple skip keyboard.
 */
export function createSkipKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('⏭ Skip', 'progress:skip');
}

/**
 * Create a "no areas need logging" keyboard.
 * Shown when all areas have been logged today.
 */
export function createAllLoggedKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📋 View Summary', 'action:summary')
    .row()
    .text('← Back', 'action:back');
}

/**
 * Create a progress complete keyboard.
 */
export function createProgressCompleteKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📋 Generate AI Prompt', 'action:summary')
    .text('🏠 Main Menu', 'action:main_menu');
}
