// /middlewares/antiSpamMiddleware.js
const antiSpam = require('../utils/antiSpam');

function withAntiSpam(handler, actionType = 'default') {
  return async (ctx) => {
    const chatId = ctx.chat.id;
    const requestKey = actionType;

    if (!antiSpam.canProcess(chatId, requestKey)) {
      const remaining = antiSpam.getRemainingTime(chatId, requestKey);

      if (ctx.answerCbQuery) {
        await ctx.answerCbQuery(`⏳ Подождите ${Math.ceil(remaining/1000)}сек...`);
      } else {
        await ctx.reply(`⏳ Подождите немного перед следующим действием...`);
      }
      return;
    }

    try {
      await handler(ctx);
    } finally {
      // Не освобождаем сразу - защита на все время timeoutMs
      // antiSpam.release(chatId, requestKey);
    }
  };
}

module.exports = { withAntiSpam };
