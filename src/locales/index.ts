import { I18n } from '@grammyjs/i18n';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize i18n with Fluent format
export const i18n = new I18n({
  defaultLocale: 'en',
  directory: join(__dirname),
  useSession: false, // We'll handle locale from database
  fluentBundleOptions: {
    useIsolating: false, // Remove Unicode isolating characters
  },
});

// Supported languages
export const SUPPORTED_LANGUAGES = ['en', 'ru'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

// Language display names
export const LANGUAGE_NAMES: Record<Language, { en: string; ru: string }> = {
  en: { en: 'English', ru: 'Английский' },
  ru: { en: 'Russian', ru: 'Русский' },
};

// Validate if language is supported
export function isValidLanguage(lang: string): lang is Language {
  return SUPPORTED_LANGUAGES.includes(lang as Language);
}
