import type { MiddlewareFn, NextFunction } from 'grammy';
import { i18n } from '../../locales/index.js';
import { userService } from '../../services/user.service.js';
import type { BotContext } from '../../types/index.js';

/**
 * Middleware to set user's language from database
 * Must be applied after i18n.middleware()
 */
export function languageMiddleware(): MiddlewareFn<BotContext> {
  return async (ctx: BotContext, next: NextFunction) => {
    if (!ctx.from?.id) {
      return next();
    }

    try {
      const user = await userService.findByTelegramId(BigInt(ctx.from.id));

      if (user?.language) {
        ctx.i18n.useLocale(user.language);
      }
    } catch (error) {
      // Silently fail - will use default language
      console.error('Error loading user language:', error);
    }

    return next();
  };
}

export { i18n };
