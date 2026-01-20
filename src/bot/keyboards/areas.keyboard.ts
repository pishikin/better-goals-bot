import { InlineKeyboard } from 'grammy';
import type { Area } from '@prisma/client';
import { VALIDATION_LIMITS } from '../utils/validators.js';

/**
 * Area-related keyboard factory functions.
 */

type TranslateFn = (key: string, params?: Record<string, any>) => string;

/**
 * Create a keyboard showing all areas for selection.
 * Used for editing or viewing individual areas.
 */
export function createAreasListKeyboard(
  areas: Area[],
  actionPrefix: string = 'area:select',
  t?: TranslateFn
): InlineKeyboard {
  const translate = t || ((key: string) => key);
  const keyboard = new InlineKeyboard();

  areas.forEach((area, index) => {
    const emoji = area.emoji ?? '📌';
    const label = `${index + 1}. ${emoji} ${area.title}`;
    keyboard.text(label, `${actionPrefix}:${area.id}`).row();
  });

  keyboard.text(translate('btn-back'), 'action:back');

  return keyboard;
}

/**
 * Create an area management keyboard.
 * Shows options to edit or delete a selected area.
 */
export function createAreaActionsKeyboard(areaId: string, t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard()
    .text(translate('btn-edit'), `area:edit:${areaId}`)
    .text(translate('btn-delete'), `area:delete:${areaId}`)
    .row()
    .text(translate('btn-back'), 'action:edit_areas');
}

/**
 * Create a delete confirmation keyboard for an area.
 */
export function createDeleteConfirmKeyboard(areaId: string, t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard()
    .text(translate('btn-confirm-delete'), `area:confirm_delete:${areaId}`)
    .text(translate('btn-cancel'), `area:select:${areaId}`);
}

/**
 * Create an edit area field selection keyboard.
 */
export function createEditFieldKeyboard(areaId: string, t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard()
    .text(translate('btn-edit-title'), `area:edit_title:${areaId}`)
    .text(translate('btn-edit-description'), `area:edit_body:${areaId}`)
    .row()
    .text(translate('btn-edit-emoji'), `area:edit_emoji:${areaId}`)
    .row()
    .text(translate('btn-back'), `area:select:${areaId}`);
}

/**
 * Create an areas overview keyboard with add option.
 * Shows if user can add more areas.
 */
export function createAreasOverviewKeyboard(currentCount: number, t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  const keyboard = new InlineKeyboard();

  if (currentCount < VALIDATION_LIMITS.MAX_AREAS_PER_USER) {
    keyboard.text(translate('btn-add-area'), 'action:add_area');
  }

  if (currentCount > 0) {
    keyboard.text(translate('btn-edit-areas'), 'action:edit_areas');
  }

  keyboard.row().text(translate('btn-back'), 'action:back');

  return keyboard;
}

/**
 * Create an "Add more areas?" keyboard during onboarding.
 */
export function createAddMoreAreasKeyboard(currentCount: number, t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  const keyboard = new InlineKeyboard();

  if (currentCount < VALIDATION_LIMITS.MAX_AREAS_PER_USER) {
    const remaining = VALIDATION_LIMITS.MAX_AREAS_PER_USER - currentCount;
    keyboard.text(translate('btn-add-another', { remaining }), 'onboarding:add_more');
  }

  keyboard.row().text(translate('btn-done-continue'), 'onboarding:done_areas');

  return keyboard;
}

/**
 * Create a skip body/description keyboard.
 */
export function createSkipBodyKeyboard(t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard()
    .text(translate('btn-skip-no-description'), 'input:skip_body')
    .row()
    .text(translate('btn-cancel'), 'action:cancel');
}

/**
 * Create a skip emoji keyboard.
 */
export function createSkipEmojiKeyboard(t?: TranslateFn): InlineKeyboard {
  const translate = t || ((key: string) => key);
  return new InlineKeyboard()
    .text(translate('btn-skip-no-emoji'), 'input:skip_emoji')
    .row()
    .text(translate('btn-cancel'), 'action:cancel');
}
