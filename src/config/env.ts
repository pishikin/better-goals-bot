import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  DATABASE_URL: z.string().default('file:./data/app.db'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DEFAULT_TIMEZONE: z.string().default('UTC'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.flatten().fieldErrors;
  const errorMessages = Object.entries(errors)
    .map(([field, messages]) => `${field}: ${messages?.join(', ')}`)
    .join('\n');

  throw new Error(`Environment validation failed:\n${errorMessages}`);
}

export const env = parsed.data;

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
