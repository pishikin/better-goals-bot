import { mkdir, open, readFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { env, isDev } from './config/env.js';
import { bot } from './bot/bot.js';
import { prisma } from './db/client.js';
import { startScheduler } from './scheduler/jobs.js';
import { registerTelegramCommands } from './bot/telegram-commands.js';

const BOT_LOCK_PATH = process.env.BOT_LOCK_FILE_PATH ?? 'data/bot.instance.lock';

let releaseInstanceLock: (() => Promise<void>) | null = null;
let isShuttingDown = false;

interface TelegramErrorLike {
  method?: unknown;
  error_code?: unknown;
  description?: unknown;
}

function isTelegramPollingConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as TelegramErrorLike;

  return (
    candidate.method === 'getUpdates' &&
    candidate.error_code === 409
  );
}

function isInstanceLockError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('Another local bot instance is already running')
  );
}

async function isPidAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ESRCH'
    ) {
      return false;
    }
    return true;
  }
}

async function readLockPid(lockPath: string): Promise<number | null> {
  try {
    const raw = await readFile(lockPath, 'utf8');
    const pid = Number.parseInt(raw.trim(), 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

async function acquireInstanceLock(): Promise<() => Promise<void>> {
  await mkdir(dirname(BOT_LOCK_PATH), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(BOT_LOCK_PATH, 'wx');
      await handle.writeFile(String(process.pid));
      await handle.close();

      let released = false;
      return async () => {
        if (released) return;
        released = true;
        await rm(BOT_LOCK_PATH, { force: true });
      };
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST') {
        throw error;
      }

      const existingPid = await readLockPid(BOT_LOCK_PATH);
      if (existingPid && (await isPidAlive(existingPid))) {
        throw new Error(
          `Another local bot instance is already running (pid ${existingPid}). Stop it before starting a new one.`
        );
      }

      await rm(BOT_LOCK_PATH, { force: true });
    }
  }

  throw new Error('Failed to acquire local instance lock.');
}

async function cleanup(exitCode: number): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    bot.stop();
  } catch {
    // ignore stop errors
  }

  try {
    await prisma.$disconnect();
  } catch {
    // ignore disconnect errors
  }

  if (releaseInstanceLock) {
    try {
      await releaseInstanceLock();
    } catch {
      // ignore lock release errors
    }
  }

  process.exit(exitCode);
}

async function main(): Promise<void> {
  // Test database connection
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }

  releaseInstanceLock = await acquireInstanceLock();
  console.log(`Instance lock acquired at ${BOT_LOCK_PATH}`);

  // Start scheduler for periodic tasks
  startScheduler();

  try {
    await registerTelegramCommands(bot);
    console.log('Telegram command menu synced');
  } catch (error) {
    console.error('Failed to sync Telegram command menu:', error);
  }

  // Start bot
  console.log(`Starting bot in ${env.NODE_ENV} mode...`);

  const onStart = (botInfo: { username: string }) => {
    console.log(`Bot @${botInfo.username} started successfully!`);
  };

  if (isDev) {
    await bot.start({ onStart });
  } else {
    await bot.start({ onStart });
  }
}

process.on('SIGINT', () => {
  console.log('Shutting down...');
  void cleanup(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  void cleanup(0);
});

void main().catch(async (error) => {
  if (isInstanceLockError(error)) {
    console.error(error.message);
  } else if (isTelegramPollingConflict(error)) {
    console.error(
      'Telegram polling conflict (409): another bot instance with this token is running. Stop duplicate local/VPS process and restart.'
    );
  } else {
    console.error('Fatal error:', error);
  }

  await cleanup(1);
});
