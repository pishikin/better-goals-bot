import { InlineKeyboard } from 'grammy';
import { TIMEZONE_OPTIONS } from '../../types/index.js';

/**
 * Settings-related keyboard factory functions.
 */

type TranslateFn = (key: string) => string;

/**
 * Create the main settings menu keyboard.
 */
export function createSettingsMenuKeyboard(t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard()
    .text(translate('btn-language'), 'settings:language')
    .row()
    .text(translate('btn-timezone'), 'settings:timezone')
    .row()
    .text(translate('btn-morning-plan-time'), 'settings:morning_plan')
    .row()
    .text(translate('btn-digest-reminders'), 'settings:digest')
    .row()
    .text(translate('btn-progress-reminder'), 'settings:progress_reminder')
    .row()
    .text(translate('btn-reset-all'), 'settings:reset')
    .row()
    .text(translate('btn-back'), 'action:back');
}

/**
 * Create a timezone selection keyboard.
 * Shows predefined options plus an "Other" option for custom input.
 */
export function createTimezoneKeyboard(t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  const keyboard = new InlineKeyboard();

  TIMEZONE_OPTIONS.forEach((tz) => {
    keyboard.text(tz.label, `timezone:${tz.value}`).row();
  });

  keyboard.text(translate('btn-other-custom'), 'timezone:custom').row();
  keyboard.text(translate('btn-back'), 'action:settings');

  return keyboard;
}

/**
 * Create a time selection keyboard for reminder settings.
 * Shows common times in a grid layout.
 */
export function createTimeSelectionKeyboard(
  settingType: 'morning' | 'evening' | 'digest',
  t?: TranslateFn
): InlineKeyboard {
  const translate = t || ((key: string) => key);
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
      .text(translate('btn-custom'), `${prefix}:custom`)
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
      .text(translate('btn-custom'), `${prefix}:custom`)
      .row();
  }

  if (settingType === 'evening') {
    keyboard.text(translate('btn-disable'), `${prefix}:disable`).row();
  }

  keyboard.text(translate('btn-back'), settingType === 'digest' ? 'settings:digest' : 'action:settings');

  return keyboard;
}

/**
 * Create a keyboard for managing digest times.
 * Shows current times with remove buttons, and add option if under limit.
 */
export function createDigestTimesKeyboard(currentTimes: string[], t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  const keyboard = new InlineKeyboard();
  const MAX_TIMES = 3;

  // Show current times with remove buttons
  currentTimes.forEach((time) => {
    keyboard.text(`🗑 ${time}`, `digest:remove:${time}`).row();
  });

  // Add button if under limit
  if (currentTimes.length < MAX_TIMES) {
    keyboard.text(translate('btn-add-time'), 'digest:add').row();
  }

  // Clear all if there are times
  if (currentTimes.length > 0) {
    keyboard.text(translate('btn-clear-all'), 'digest:clear').row();
  }

  keyboard.text(translate('btn-back'), 'action:settings');

  return keyboard;
}

/**
 * Create a reset confirmation keyboard.
 */
export function createResetConfirmKeyboard(t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard()
    .text(translate('reset-confirm-step1'), 'reset:confirm')
    .row()
    .text(translate('reset-confirm-step2'), 'reset:execute')
    .row()
    .text(translate('btn-cancel'), 'action:settings');
}

/**
 * Create a language selection keyboard.
 * Language names are intentionally not translated - shown in their native form.
 */
export function createLanguageKeyboard(currentLanguage: string, t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  const keyboard = new InlineKeyboard();

  const enLabel = currentLanguage === 'en' ? '🇬🇧 English ✓' : '🇬🇧 English';
  const ruLabel = currentLanguage === 'ru' ? '🇷🇺 Русский ✓' : '🇷🇺 Русский';

  keyboard.text(enLabel, 'language:en').row().text(ruLabel, 'language:ru').row();

  keyboard.text(translate('btn-back'), 'action:settings');

  return keyboard;
}

/**
 * Create a confirmation keyboard for settings changes.
 */
export function createSettingsConfirmKeyboard(
  confirmCallback: string,
  t?: TranslateFn
): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard()
    .text(translate('btn-confirm'), confirmCallback)
    .text(translate('btn-back'), 'action:settings');
}
