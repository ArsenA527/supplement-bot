const subscriptionService = require('../services/subscriptionService');
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

    message += `\n💳 *Для оформления подписки:* /subscribe`;

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

    // Проверка плана
    if (!premiumPlan || !premiumPlan.name || !premiumPlan.price) {
      console.error('❌ Ошибка: план premium не определен', premiumPlan);
      await ctx.reply('❌ Ошибка конфигурации подписки.');
      return;
    }

    console.log(`🔍 Начинаем процесс подписки для ${chatId}`);

    try {
      const paymentService = require('../services/directPaymentService');
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
          `*Нажмите кнопку для перехода к оплате:*`,
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
          `1. Вернитесь в этого бота\n` +
          `2. Нажмите кнопку "✅ Я оплатил(а)"\n` +
          `3. Premium активируется автоматически\n\n` +
          `Если возникли проблемы - используйте кнопки ниже:`,
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
      await ctx.reply(
        '❌ Ошибка создания платежа. Попробуйте позже или обратитесь в поддержку.',
        getMainMenuKeyboard(isPremium)
      );
    }
  }

  async checkSubscriptionStatus(ctx) {
    const chatId = ctx.chat.id;
    const subscription = await subscriptionService.getUserSubscription(chatId);
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

  // Обработка callback от платежей
  async handlePaymentCallback(ctx) {
    const callbackData = ctx.callbackQuery.data;

    if (callbackData.startsWith('payment_confirm_')) {
      await this.handlePaymentConfirmation(ctx);
    } else if (callbackData.startsWith('payment_check_')) {
      await this.handlePaymentCheck(ctx);
    } else if (callbackData.startsWith('payment_status_')) {
      await this.handlePaymentStatus(ctx);
    }
  }

  async handlePaymentConfirmation(ctx) {
    const paymentId = ctx.callbackQuery.data.replace('payment_confirm_', '');
    const paymentService = require('../services/directPaymentService');

    try {
      await ctx.answerCbQuery('🔄 Активируем Premium...');

      // Для тестовых платежей сразу активируем
      if (paymentId.startsWith('test_payment_')) {
        await paymentService.processSuccessfulPayment(paymentId);
        await ctx.reply(`🎉 *Premium подписка активирована!*\n\nТеперь вам доступны все функции!`, {
          parse_mode: 'Markdown',
          ...getMainMenuKeyboard(true)
        });
      } else {
        // Для реальных платежей проверяем статус
        const status = await paymentService.checkPaymentStatus(paymentId);
        if (status === 'succeeded') {
          await paymentService.processSuccessfulPayment(paymentId);
          await ctx.reply(`🎉 *Платеж подтвержден! Premium активирован!*`, {
            parse_mode: 'Markdown',
            ...getMainMenuKeyboard(true)
          });
        } else {
          await ctx.reply(`⏳ Платеж еще обрабатывается. Статус: ${status}\n\nПопробуйте проверить позже.`);
        }
      }

      // Удаляем сообщение с кнопками
      await ctx.deleteMessage();

    } catch (error) {
      console.error('❌ Ошибка активации:', error);
      await ctx.answerCbQuery('❌ Ошибка активации');
    }
  }

  async handlePaymentCheck(ctx) {
    const paymentId = ctx.callbackQuery.data.replace('payment_check_', '');
    await ctx.answerCbQuery('🔍 Проверяем статус...');
    await this.handlePaymentConfirmation(ctx); // Та же логика
  }

  async handlePaymentStatus(ctx) {
    const paymentId = ctx.callbackQuery.data.replace('payment_status_', '');
    const paymentService = require('../services/directPaymentService');

    try {
      await ctx.answerCbQuery('🔍 Проверяем статус платежа...');
      const status = await paymentService.checkPaymentStatus(paymentId);

      await ctx.reply(`📊 *Статус платежа:* ${status}\n\n` +
        `Если статус "succeeded" - Premium уже активирован.\n` +
        `Если "pending" - платеж еще обрабатывается.`);

    } catch (error) {
      console.error('❌ Ошибка проверки:', error);
      await ctx.answerCbQuery('❌ Ошибка проверки');
    }
  }
}

module.exports = new SubscriptionController();
