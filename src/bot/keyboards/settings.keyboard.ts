import { InlineKeyboard } from 'grammy';
import { TIMEZONE_OPTIONS } from '../../types/index.js';

/**
 * Settings-related keyboard factory functions.
 */

/**
 * Create the main settings menu keyboard.
 */
export function createSettingsMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🌍 Timezone', 'settings:timezone')
    .row()
    .text('📋 Digest Reminders', 'settings:digest')
    .row()
    .text('📝 Progress Reminder', 'settings:progress_reminder')
    .row()
    .text('🗑 Reset All Data', 'settings:reset')
    .row()
    .text('← Back', 'action:back');
}

/**
 * Create a timezone selection keyboard.
 * Shows predefined options plus an "Other" option for custom input.
 */
export function createTimezoneKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  TIMEZONE_OPTIONS.forEach((tz) => {
    keyboard.text(tz.label, `timezone:${tz.value}`).row();
  });

  keyboard.text('📝 Other (type manually)', 'timezone:custom').row();
  keyboard.text('← Back', 'action:settings');

  return keyboard;
}

/**
 * Create a time selection keyboard for reminder settings.
 * Shows common times in a grid layout.
 */
export function createTimeSelectionKeyboard(
  settingType: 'morning' | 'evening' | 'digest'
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const prefix = `time:${settingType}`;

  if (settingType === 'morning' || settingType === 'digest') {
    // Morning/Digest options: spread throughout the day
    keyboard
      .text('07:00', `${prefix}:07:00`)
      .text('09:00', `${prefix}:09:00`)
      .text('12:00', `${prefix}:12:00`)
      .row()
      .text('14:00', `${prefix}:14:00`)
      .text('17:00', `${prefix}:17:00`)
      .text('📝 Custom', `${prefix}:custom`)
      .row();
  } else {
    // Evening options: 18:00 - 22:00
    keyboard
      .text('18:00', `${prefix}:18:00`)
      .text('19:00', `${prefix}:19:00`)
      .text('20:00', `${prefix}:20:00`)
      .row()
      .text('21:00', `${prefix}:21:00`)
      .text('22:00', `${prefix}:22:00`)
      .text('📝 Custom', `${prefix}:custom`)
      .row();
  }

  if (settingType === 'evening') {
    keyboard.text('🚫 Disable', `${prefix}:disable`).row();
  }

  keyboard.text('← Back', settingType === 'digest' ? 'settings:digest' : 'action:settings');

  return keyboard;
}

/**
 * Create a keyboard for managing digest times.
 * Shows current times with remove buttons, and add option if under limit.
 */
export function createDigestTimesKeyboard(currentTimes: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const MAX_TIMES = 3;

  // Show current times with remove buttons
  currentTimes.forEach((time) => {
    keyboard.text(`🗑 ${time}`, `digest:remove:${time}`).row();
  });

  // Add button if under limit
  if (currentTimes.length < MAX_TIMES) {
    keyboard.text('➕ Add Time', 'digest:add').row();
  }

  // Clear all if there are times
  if (currentTimes.length > 0) {
    keyboard.text('🗑 Clear All', 'digest:clear').row();
  }

  keyboard.text('← Back', 'action:settings');

  return keyboard;
}

/**
 * Create a reset confirmation keyboard.
 */
export function createResetConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⚠️ Yes, I understand', 'reset:confirm')
    .row()
    .text('🚨 DELETE EVERYTHING', 'reset:execute')
    .row()
    .text('← Cancel', 'action:settings');
}

/**
 * Create a confirmation keyboard for settings changes.
 */
export function createSettingsConfirmKeyboard(
  confirmCallback: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Confirm', confirmCallback)
    .text('← Back', 'action:settings');
}
