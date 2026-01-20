import type { Context, SessionFlavor } from 'grammy';
import type { ConversationFlavor, Conversation } from '@grammyjs/conversations';
import type { I18nFlavor } from '@grammyjs/i18n';
import type { User, Area, ProgressEntry } from '@prisma/client';

// Session data stored between updates
export interface SessionData {
  // User data cached in session
  userId?: string;
}

// Base context without conversations to avoid circular dependency
type MyBaseContext = Context & I18nFlavor & SessionFlavor<SessionData>;

// Bot context type with session, conversation and i18n support
export type BotContext = MyBaseContext & ConversationFlavor<MyBaseContext>;

// Conversation type for Grammy conversations plugin
export type BotConversation = Conversation<BotContext, BotContext>;

// Re-export Prisma types for convenience
export type { User, Area, ProgressEntry };

// Area creation input
export interface CreateAreaInput {
  title: string;
  body?: string;
  emoji?: string;
}

// Area update input
export interface UpdateAreaInput {
  title?: string;
  body?: string;
  emoji?: string;
}

// Progress entry input
export interface ProgressEntryInput {
  areaId: string;
  content: string;
}

// Statistics
export interface UserStatistics {
  currentStreak: number;
  weeklyActivity: number;
  totalEntries: number;
}

// Timezone option for keyboard
export interface TimezoneOption {
  label: string;
  value: string;
}

// Common timezone options
export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { label: 'Moscow (MSK)', value: 'Europe/Moscow' },
  { label: 'London (GMT)', value: 'Europe/London' },
  { label: 'New York (EST)', value: 'America/New_York' },
  { label: 'Tokyo (JST)', value: 'Asia/Tokyo' },
  { label: 'UTC', value: 'UTC' },
];

// Language type
export type Language = 'en' | 'ru';
