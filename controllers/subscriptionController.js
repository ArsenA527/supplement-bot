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

    try {
      const paymentService = require('../services/telegramPaymentService');

      if (paymentService.providerToken) {
        // Режим REAL PAYMENTS
        const invoice = await paymentService.createInvoice(chatId, premiumPlan);
        await ctx.replyWithInvoice(invoice);
        console.log('✅ Инвойс отправлен (REAL PAYMENTS)');

      } else {
        // Режим MANUAL ACTIVATION
        await ctx.reply(
          `💎 *PREMIUM ПОДПИСКА*\n\n` +
          `Стоимость: ${premiumPlan.price} руб\n` +
          `Период: 30 дней\n\n` +
          `*Включает:*\n` +
          `• Расширенный опрос (17+ вопросов)\n` +
          `• Персональные дозировки\n` +
          `• Умные напоминания\n` +
          `• Неограниченные опросы\n\n` +
          `⚠️ *Система платежей в процессе настройки*\n` +
          `Для активации Premium нажмите кнопку:`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '✅ Активировать Premium', callback_data: 'manual_premium_activate' }]
              ]
            }
          }
        );
      }

    } catch (error) {
      console.error('❌ Ошибка создания инвойса:', error);

      // Fallback на ручную активацию
      await ctx.reply(
        `💎 *PREMIUM ПОДПИСКА*\n\n` +
        `Для активации Premium нажмите кнопку:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Активировать Premium', callback_data: 'manual_premium_activate' }]
            ]
          }
        }
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
