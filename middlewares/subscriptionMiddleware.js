const subscriptionService = require('../services/subscriptionService');

// Middleware для проверки подписки
function requireSubscription(requiredPlan = 'premium') {
  return async (ctx, next) => {
    const chatId = ctx.chat.id;

    try {
      const hasAccess = await subscriptionService.isSubscriptionActive(chatId);

      if (hasAccess) {
        return next();
      } else {
        ctx.reply(`🚫 Для доступа к этой функции нужна подписка Premium!

💎 Премиум подписка включает:
• Расширенный опрос из 17+ вопросов
• Персональные дозировки добавок
• Напоминания о приеме
• Неограниченные опросы

Используйте /subscribe для получения доступа!`,
          require('../keyboards').getMainMenuKeyboard()
        );
      }
    } catch (error) {

      console.error('❌ Ошибка проверки подписки:', error);
      ctx.reply('⚠️ Ошибка проверки доступа. Попробуйте позже.');
    }
  };
}

// Middleware для инъекции данных подписки
async function injectSubscriptionData(ctx, next) {
  try {
    const chatId = ctx.chat.id;
    ctx.state.subscription = await subscriptionService.getUserSubscription(chatId);
  } catch (error) {
    console.error('❌ Ошибка инъекции данных подписки:', error);
    ctx.state.subscription = { plan: 'free', status: 'active' };
  }
  await next();
}

module.exports = {
  requireSubscription,
  injectSubscriptionData
};
