const subscriptionService = require('../services/subscriptionService');
const paymentService = require('../services/paymentService');
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

    message += `\n💳 *Для оформления подписки:* /subscribe`;

    ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard()
    });
  }

  // Обработчик команды /subscribe
  async handleSubscribe(ctx) {
    const plans = subscriptionService.getSubscriptionPlans();
    const premiumPlan = plans.premium;

    try {
      // Создаем тестовый платеж
      const paymentUrl = await paymentService.createTestPayment(ctx.chat.id, {
        name: 'Premium подписка',
        price: premiumPlan.price
      });

      ctx.reply(`🚀 *Оформление Premium подписки*\n\n` +
        `Стоимость: ${premiumPlan.price} руб/мес\n` +
        `Период: 30 дней\n\n` +
        `*ТЕСТОВЫЙ РЕЖИМ* - для активации нажмите "Я оплатил(а)"\n\n` +
        `В реальной версии вы будете перенаправлены на страницу оплаты.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Тестовая оплата', callback_data: 'test_payment' }],
            [{ text: '✅ Я оплатил(а)', callback_data: 'payment_confirmed' }],
            [{ text: '📋 Информация о подписках', callback_data: 'subscription_info' }],
            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
          ]
        }
      });

    } catch (error) {
      console.error('❌ Ошибка создания платежа:', error);
      ctx.reply('❌ Ошибка создания платежа. Попробуйте позже.');
    }
  }

  // Обработка подтверждения оплаты (ТЕСТОВАЯ)
  async handlePaymentConfirmation(ctx) {
    const chatId = ctx.chat.id;

    try {
      // В тестовом режиме сразу активируем подписку
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7); // 7 дней для теста

      await subscriptionService.updateSubscription(chatId, {
        plan: 'premium',
        status: 'active',
        end_date: endDate.toISOString()
      });

      // Очищаем текущую сессию опроса если есть
      const surveyService = require('../services/surveyService');
      await surveyService.completeSurvey(chatId);

      ctx.reply(`🎉 *Premium подписка активирована на 7 дней!*\n\n` +
        `Теперь вам доступны:\n` +
        `• 📋 Расширенный опрос (17+ вопросов)\n` +
        `• 💊 Персональные дозировки\n` +
        `• ⏰ Умные напоминания\n` +
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
    const paymentStatus = await paymentService.getPaymentStatus(chatId);

    let message = `📋 *Статус вашей подписки:*\n\n`;
    message += `• План: ${subscription.plan === 'premium' ? '💎 Premium' : '🎁 Free'}\n`;
    message += `• Статус: ${subscription.status || 'active'}\n`;

    if (subscription.end_date) {
      const endDate = new Date(subscription.end_date);
      message += `• Действует до: ${endDate.toLocaleDateString('ru-RU')}\n`;
    }

    if (paymentStatus) {
      message += `• Платеж: ${paymentStatus === 'succeeded' ? '✅ Успешно' : '⏳ Ожидание'}\n`;
    }

    if (subscription.plan === 'free') {
      message += `\n💡 Для получения Premium доступа: /subscribe`;
    }

    ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard()
    });
  }
}

module.exports = new SubscriptionController();
