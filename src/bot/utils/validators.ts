import { z } from 'zod';

/**
 * Validation constants for the application.
 * These limits are defined in the product specification.
 */
export const VALIDATION_LIMITS = {
  AREA_TITLE_MAX: 50,
  AREA_BODY_MAX: 200,
  PROGRESS_CONTENT_MAX: 200,
  MAX_AREAS_PER_USER: 7,
} as const;

/**
 * Schema for area title.
 * Required, 1-50 characters, trimmed.
 */
export const areaTitleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(
    VALIDATION_LIMITS.AREA_TITLE_MAX,
    `Title must be ${VALIDATION_LIMITS.AREA_TITLE_MAX} characters or less`
  );

/**
 * Schema for area body/description.
 * Optional, max 200 characters, trimmed.
 */
export const areaBodySchema = z
  .string()
  .trim()
  .max(
    VALIDATION_LIMITS.AREA_BODY_MAX,
    `Description must be ${VALIDATION_LIMITS.AREA_BODY_MAX} characters or less`
  )
  .optional()
  .transform((val) => val || undefined);

/**
 * Schema for emoji.
 * Optional, single emoji character or short emoji sequence.
 */
export const emojiSchema = z
  .string()
  .trim()
  .regex(/^[\p{Emoji}]{1,2}$/u, 'Please enter a valid emoji')
  .optional()
  .transform((val) => val || undefined);

/**
 * Schema for progress entry content.
 * Required, 1-200 characters, trimmed.
 */
export const progressContentSchema = z
  .string()
  .trim()
  .min(1, 'Progress entry cannot be empty')
  .max(
    VALIDATION_LIMITS.PROGRESS_CONTENT_MAX,
    `Progress entry must be ${VALIDATION_LIMITS.PROGRESS_CONTENT_MAX} characters or less`
  );

/**
 * Schema for IANA timezone string.
 * Validates that the timezone is recognized by the system.
 */
export const timezoneSchema = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid timezone. Please use IANA format (e.g., Europe/London)' }
);

/**
 * Schema for time in HH:mm format (24-hour).
 * Used for reminder and digest times.
 */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:mm format (e.g., 09:00, 21:30)');

/**
 * Schema for creating a new area.
 */
export const createAreaSchema = z.object({
  title: areaTitleSchema,
  body: areaBodySchema,
  emoji: emojiSchema,
});

/**
 * Schema for updating an existing area.
 */
export const updateAreaSchema = z
  .object({
    title: areaTitleSchema.optional(),
    body: areaBodySchema,
    emoji: emojiSchema,
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

/**
 * Validation result type for consistent error handling.
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Validates input against a Zod schema and returns a consistent result.
 * Use this for user input validation in conversations.
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): ValidationResult<T> {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Return the first error message (Zod v4 uses 'issues' instead of 'errors')
  const errorMessage = result.error.issues[0]?.message ?? 'Invalid input';
  return { success: false, error: errorMessage };
}

/**
 * Validates area title input.
 */
export function validateAreaTitle(input: string): ValidationResult<string> {
  return validate(areaTitleSchema, input);
}

/**
 * Validates area body input.
 */
export function validateAreaBody(
  input: string
): ValidationResult<string | undefined> {
  return validate(areaBodySchema, input);
}

/**
 * Validates emoji input.
 */
export function validateEmoji(
  input: string
): ValidationResult<string | undefined> {
  return validate(emojiSchema, input);
}

/**
 * Validates progress entry content.
 */
export function validateProgressContent(input: string): ValidationResult<string> {
  return validate(progressContentSchema, input);
}

/**
 * Validates timezone string.
 */
export function validateTimezone(input: string): ValidationResult<string> {
  return validate(timezoneSchema, input);
}

/**
 * Validates time string in HH:mm format.
 */
export function validateTime(input: string): ValidationResult<string> {
  return validate(timeSchema, input);
}
