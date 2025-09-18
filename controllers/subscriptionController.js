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

    message += `\n💳 *Для оформления подписки нажмите:* /subscribe`;

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
          // ИСПРАВЛЯЕМ callback_data на 'payment_confirmed'
          [{ text: '💳 Оплатить 299 руб', callback_data: 'payment_confirmed' }],
          [{ text: '📋 Информация о подписках', callback_data: 'subscription_info' }],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ]
      }
    });
  }

  // Обработка подтверждения оплаты
  async handlePaymentConfirmation(ctx) {
    const chatId = ctx.chat.id;

    try {
      // Активируем подписку на 7 дней для теста
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      await subscriptionService.updateSubscription(chatId, {
        plan: 'premium',
        status: 'active',
        end_date: endDate.toISOString()
      });

      // Очищаем текущую сессию опроса если она есть
      const surveyService = require('../services/surveyService');
      await surveyService.completeSurvey(chatId);

      ctx.reply(`🎉 *Подписка активирована на 7 дней!*\n\n` +
        `Теперь вам доступны:\n` +
        `• 📋 Расширенный опрос (17+ вопросов)\n` +
        `• 💊 Персональные дозировки\n` +
        `• ⏰ Напоминания о приеме\n` +
        `• 🔄 Неограниченные опросы\n\n` +
        `*Используйте /survey для нового расширенного опроса!*`,
      {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard()
      });

    } catch (error) {
      console.error('❌ Ошибка активации подписки:', error);
      ctx.reply('❌ Ошибка активации подписки. Обратитесь в поддержку.');
    }
  }
  // Проверить статус подписки
  async checkSubscriptionStatus(ctx) {
    const chatId = ctx.chat.id;
    const subscription = await subscriptionService.getUserSubscription(chatId);

    let message = `📋 *Статус вашей подписки:*\n\n`;
    message += `• План: ${subscription.plan === 'premium' ? '💎 Premium' : '🎁 Free'}\n`;
    message += `• Статус: ${subscription.status || 'active'}\n`;

    if (subscription.end_date) {
      const endDate = new Date(subscription.end_date);
      message += `• Действует до: ${endDate.toLocaleDateString('ru-RU')}\n`;
    }

    if (subscription.plan === 'free') {
      message += `\n💡 Для получения Premium доступа используйте: /subscribe`;
    } else {
      message += `\n✨ Вы наслаждаетесь всеми преимуществами Premium подписки!`;
    }

    ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard()
    });
  }
}

module.exports = new SubscriptionController();
