import { InlineKeyboard } from 'grammy';
import type { Area } from '@prisma/client';
import { VALIDATION_LIMITS } from '../utils/validators.js';

/**
 * Area-related keyboard factory functions.
 */

/**
 * Create a keyboard showing all areas for selection.
 * Used for editing or viewing individual areas.
 */
export function createAreasListKeyboard(
  areas: Area[],
  actionPrefix: string = 'area:select'
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  areas.forEach((area, index) => {
    const emoji = area.emoji ?? '📌';
    const label = `${index + 1}. ${emoji} ${area.title}`;
    keyboard.text(label, `${actionPrefix}:${area.id}`).row();
  });

  keyboard.text('← Back', 'action:back');

  return keyboard;
}

/**
 * Create an area management keyboard.
 * Shows options to edit or delete a selected area.
 */
export function createAreaActionsKeyboard(areaId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✏️ Edit', `area:edit:${areaId}`)
    .text('🗑 Delete', `area:delete:${areaId}`)
    .row()
    .text('← Back', 'action:edit_areas');
}

/**
 * Create a delete confirmation keyboard for an area.
 */
export function createDeleteConfirmKeyboard(areaId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('🗑 Yes, delete', `area:confirm_delete:${areaId}`)
    .text('← Cancel', `area:select:${areaId}`);
}

/**
 * Create an edit area field selection keyboard.
 */
export function createEditFieldKeyboard(areaId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('📝 Title', `area:edit_title:${areaId}`)
    .text('📄 Description', `area:edit_body:${areaId}`)
    .row()
    .text('😀 Emoji', `area:edit_emoji:${areaId}`)
    .row()
    .text('← Back', `area:select:${areaId}`);
}

/**
 * Create an areas overview keyboard with add option.
 * Shows if user can add more areas.
 */
export function createAreasOverviewKeyboard(currentCount: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (currentCount < VALIDATION_LIMITS.MAX_AREAS_PER_USER) {
    keyboard.text('➕ Add Area', 'action:add_area');
  }

  if (currentCount > 0) {
    keyboard.text('✏️ Edit Areas', 'action:edit_areas');
  }

  keyboard.row().text('← Back', 'action:back');

  return keyboard;
}

/**
 * Create an "Add more areas?" keyboard during onboarding.
 */
export function createAddMoreAreasKeyboard(currentCount: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (currentCount < VALIDATION_LIMITS.MAX_AREAS_PER_USER) {
    const remaining = VALIDATION_LIMITS.MAX_AREAS_PER_USER - currentCount;
    keyboard.text(`➕ Add another (${remaining} left)`, 'onboarding:add_more');
  }

  keyboard.row().text('✅ Done, continue', 'onboarding:done_areas');

  return keyboard;
}

/**
 * Create a skip body/description keyboard.
 */
export function createSkipBodyKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⏭ Skip (no description)', 'input:skip_body')
    .row()
    .text('❌ Cancel', 'action:cancel');
}

/**
 * Create a skip emoji keyboard.
 */
export function createSkipEmojiKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⏭ Skip (no emoji)', 'input:skip_emoji')
    .row()
    .text('❌ Cancel', 'action:cancel');
}
