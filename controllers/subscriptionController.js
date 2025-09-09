const subscriptionService = require('../services/subscriptionService');
const { getMainMenuKeyboard } = require('../keyboards');

class SubscriptionController {
  // Показать информацию о подписках
  async showSubscriptionPlans(ctx) {
    const plans = subscriptionService.getSubscriptionPlans();

    let message = `💎 *Доступные подписки:*\n\n`;

    // Free план
    message += `🎁 *Бесплатно:*\n`;
    plans.free.features.forEach(feat => {
      message += `✓ ${feat}\n`;
    });

    message += `\n💎 *Premium - ${plans.premium.price} руб/мес:*\n`;
    plans.premium.features.forEach(feat => {
      message += `✓ ${feat}\n`;
    });

    message += `\n🎯 *Для оформления подписки используйте:* /subscribe`;

    ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard()
    });
  }

  // Обработчик команды /subscribe
  async handleSubscribe(ctx) {
    const plans = subscriptionService.getSubscriptionPlans();

    ctx.reply(`🚀 *Оформление Premium подписки*\n\n` +
      `Стоимость: ${plans.premium.price} руб/мес\n` +
      `Период: 30 дней\n\n` +
      `Для оплаты используйте кнопку ниже 👇`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Оплатить 299 руб', pay: true }],
          [{ text: '📋 Информация о подписках', callback_data: 'subscription_info' }]
        ]
      }
    });
  }

  // Обработка успешной оплаты
  async handleSuccessfulPayment(ctx) {
    const chatId = ctx.chat.id;
    const paymentInfo = ctx.message.successful_payment;

    try {
      // Обновляем подписку пользователя
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      await subscriptionService.updateSubscription(chatId, {
        plan: 'premium',
        status: 'active',
        end_date: endDate.toISOString()
      });

      ctx.reply(`🎉 *Подписка активирована!*\n\n` +
        `Теперь вам доступны:\n` +
        `• Расширенный опрос\n` +
        `• Персональные дозировки\n` +
        `• Премиум функции\n\n` +
        `Используйте /survey для нового опроса!`,
      {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard()
      });

    } catch (error) {
      console.error('❌ Ошибка активации подписки:', error);
      ctx.reply('❌ Ошибка активации подписки. Обратитесь в поддержку.');
    }
  }
}

module.exports = new SubscriptionController();
