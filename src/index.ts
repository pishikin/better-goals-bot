import { env, isDev } from './config/env.js';
import { bot } from './bot/bot.js';
import { prisma } from './db/client.js';
import { startScheduler } from './scheduler/jobs.js';

async function main(): Promise<void> {
  // Test database connection
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }

  // Start scheduler for periodic tasks
  startScheduler();

  // Start bot
  console.log(`Starting bot in ${env.NODE_ENV} mode...`);

  if (isDev) {
    // Development: use long polling
    await bot.start({
      onStart: (botInfo) => {
        console.log(`Bot @${botInfo.username} started successfully!`);
      },
    });
  } else {
    // Production: could use webhooks
    // For now, use polling in production too
    await bot.start({
      onStart: (botInfo) => {
        console.log(`Bot @${botInfo.username} started successfully!`);
      },
    });
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('Shutting down...');
  bot.stop();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
