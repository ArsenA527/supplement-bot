const subscriptionService = require('../services/subscriptionService');
const paymentService = require('../services/paymentService');
const { getMainMenuKeyboard } = require('../keyboards');

class SubscriptionController {
  async showSubscriptionPlans(ctx) {
    const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id);

    const plans = subscriptionService.getSubscriptionPlans();

    let message = `💎 *Доступные подписки:*\n\n`;

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
      ...getMainMenuKeyboard(isPremium)
    });
  }

  async handleSubscribe(ctx) {
    const chatId = ctx.chat.id;
    const isPremium = await subscriptionService.isSubscriptionActive(chatId);

    if (isPremium) {
      await this.checkSubscriptionStatus(ctx);
      return;
    }


    const plans = subscriptionService.getSubscriptionPlans();
    const premiumPlan = plans.premium;

    // ДОБАВЬТЕ ЭТУ ПРОВЕРКУ
    if (!premiumPlan || !premiumPlan.name || !premiumPlan.price) {
      console.error('❌ Ошибка: план premium не определен правильно', premiumPlan);
      await ctx.reply('❌ Ошибка конфигурации подписки. Обратитесь в поддержку.');
      return;
    }

    console.log(`🔍 Создание платежа для ${chatId}, план:`, premiumPlan);

    try {
      const paymentService = require('../services/simplePaymentService');
      const payment = await paymentService.createPayment(chatId, premiumPlan);

      const isTestPayment = payment.metadata?.is_test;

      if (isTestPayment) {
        // ТЕСТОВЫЙ РЕЖИМ
        await ctx.reply(
          `🧪 *ТЕСТОВАЯ ОПЛАТА PREMIUM*\n\n` +
          `Стоимость: ${premiumPlan.price} руб/мес\n` +
          `Период: 30 дней\n\n` +
          `Для активации Premium нажмите кнопку:`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '✅ Активировать Premium', callback_data: `payment_confirm_${payment.id}` }],
                [{ text: '❌ Отмена', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      } else {
        // РЕАЛЬНЫЙ РЕЖИМ
        await ctx.reply(
          `🚀 *ОФОРМЛЕНИЕ PREMIUM ПОДПИСКИ*\n\n` +
          `💎 План: ${premiumPlan.name}\n` +
          `💰 Стоимость: ${premiumPlan.price} руб\n` +
          `📅 Период: 30 дней\n\n` +
          `*Нажмите кнопку для оплаты:*`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💳 Оплатить', url: payment.confirmation.confirmation_url }]
              ]
            }
          }
        );

        await ctx.reply(
          `📋 *После оплаты:*\n\n` +
          `1. Вернитесь в бота\n` +
          `2. Нажмите "✅ Я оплатил(а)"\n` +
          `3. Premium активируется автоматически\n\n` +
          `Или проверьте статус:`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '✅ Я оплатил(а)', callback_data: `payment_check_${payment.id}` }],
                [{ text: '🔄 Проверить статус', callback_data: `payment_status_${payment.id}` }],
                [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }

    } catch (error) {
      console.error('❌ Ошибка создания платежа:', error);
      ctx.reply('❌ Ошибка создания платежа. Попробуйте позже.',
        getMainMenuKeyboard(isPremium)
      );
    }
  }

  async checkSubscriptionStatus(ctx) {
    const chatId = ctx.chat.id;
    const subscription = await subscriptionService.getUserSubscription(chatId);
    const paymentStatus = await paymentService.getPaymentStatus(chatId);
    const isPremium = await subscriptionService.isSubscriptionActive(chatId);

    let message = `📋 *Статус вашей подписки:*\n\n`;
    message += `• План: ${subscription.plan === 'premium' ? '💎 Premium' : '🎁 Free'}\n`;
    message += `• Статус: ${subscription.status || 'active'}\n`;

    if (subscription.end_date) {
      const endDate = new Date(subscription.end_date);
      const today = new Date();
      const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

      message += `• Действует до: ${endDate.toLocaleDateString('ru-RU')}\n`;
      message += `• Осталось дней: ${daysLeft}\n`;
    }

    if (paymentStatus) {
      message += `• Платеж: ${paymentStatus === 'succeeded' ? '✅ Успешно' : '⏳ Ожидание'}\n`;
    }

    if (subscription.plan === 'free') {
      message += `\n💡 Для получения Premium доступа: /subscribe`;
    } else {
      message += `\n✨ Вы наслаждаетесь всеми преимуществами Premium подписки!`;
    }

    ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard(isPremium)
    });
  }

  async handlePaymentConfirmation(ctx) {
    const chatId = ctx.chat.id;

    try {
      console.log(`🔵 Активация Premium для ${chatId}`);

      const endDate = new Date();
      console.log(`📅 Текущая дата: ${endDate.toISOString()}`);

      endDate.setMonth(endDate.getMonth() + 1); // +1 месяц
      console.log(`📅 Дата после +1 месяц: ${endDate.toISOString()}`);

      // 1. Обновляем подписку
      await subscriptionService.updateSubscription(chatId, {
        plan: 'premium',
        status: 'active',
        end_date: endDate.toISOString()
      });

      // 2. Проверяем что сохранилось - ИСПРАВЛЯЕМ ОШИБКУ!
      const updatedSub = await subscriptionService.getUserSubscription(chatId); // БЫЛО: updated
      console.log(`🔍 Сохраненная дата: ${updatedSub.end_date}`);

      // 3. Завершаем опрос (если был незавершенный)
      const surveyService = require('../services/surveyService');
      await surveyService.completeSurvey(chatId);

      // 4. Проверяем активацию
      const isPremiumNow = await subscriptionService.isSubscriptionActive(chatId);
      console.log(`🔍 Проверка Premium после активации: ${isPremiumNow}`);

      ctx.reply(`🎉 *Premium подписка активирована на 30 дней!*\n\n` +
        `Теперь вам доступны:\n` +
        `• 📋 Расширенный опрос (17+ вопросов)\n` +
        `• 💊 Персональные дозировки\n` +
        `• ⏰ Умные напоминания\n` +
        `• 🔄 Неограниченные опросы\n\n` +
        `*Используйте /survey для нового расширенного опроса!*`,
      {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard(true)
      });

    } catch (error) {
      console.error('❌ Ошибка активации подписки:', error);
      const isPremium = await subscriptionService.isSubscriptionActive(chatId);
      ctx.reply('❌ Ошибка активации подписки. Обратитесь в поддержку.',
        getMainMenuKeyboard(isPremium)
      );
    }
  }
}

module.exports = new SubscriptionController();
