import type { BotContext, BotConversation } from '../../types/index.js';

const GLOBAL_INTERRUPT_CALLBACKS = new Set([
  'plan:start',
  'plan:start:tomorrow',
  'review:start:today',
  'review:start:yesterday',
  'task:done_all_confirm',
  'task:done_all_cancel',
  'action:progress',
  'action:settings',
  'action:summary',
  'action:main_menu',
  'action:back',
]);

interface PassThroughOptions {
  answerUnhandledCallback?: boolean;
}

export function isGlobalInterruptCallbackData(data: string | undefined): boolean {
  if (!data) {
    return false;
  }

  return GLOBAL_INTERRUPT_CALLBACKS.has(data);
}

function isSlashCommand(text: string | undefined): boolean {
  return Boolean(text?.trim().startsWith('/'));
}

/**
 * Let slash-commands and key global callbacks break out of active conversations.
 */
export async function passThroughGlobalInterruptIfAny(
  conversation: BotConversation,
  ctx: BotContext,
  options: PassThroughOptions = {}
): Promise<void> {
  if (isSlashCommand(ctx.message?.text)) {
    await conversation.halt({ next: true });
  }

  const callbackData = ctx.callbackQuery?.data;
  if (!callbackData) {
    return;
  }

  if (isGlobalInterruptCallbackData(callbackData)) {
    await conversation.halt({ next: true });
  }

  if (options.answerUnhandledCallback) {
    await ctx.answerCallbackQuery();
  }
}
