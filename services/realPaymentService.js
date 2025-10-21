// Пробуем разные варианты импорта
let yookassa;
try {
  // Вариант 1: стандартный пакет
  yookassa = require('yookassa');
} catch (error) {
  try {
    // Вариант 2: пакет который у тебя есть
    yookassa = require('@a2seven/yoo-checkout');
  } catch (error2) {
    console.error('❌ Не найден пакет ЮKassa. Установи: npm install yookassa');
    throw error2;
  }
}

const db = require('../config/database');
const subscriptionService = require('./subscriptionService');

class RealPaymentService {
  constructor() {
    // Инициализация в зависимости от пакета
    if (typeof yookassa === 'function') {
      // Стандартный yookassa
      this.yooKassa = yookassa({
        shopId: process.env.YOOKASSA_SHOP_ID,
        secretKey: process.env.YOOKASSA_SECRET_KEY
      });
    } else {
      // @a2seven/yoo-checkout
      this.yooKassa = yookassa;
    }
  }

  // Создание реального платежа
  async createPayment(chatId, plan) {
    try {
      console.log(`💳 Создание платежа для ${chatId}, план: ${plan.name}`);

      // Для тестирования - если тестовый режим, создаем заглушку
      if (process.env.YOOKASSA_TEST_MODE === 'true') {
        console.log('🔧 Тестовый режим - создаем заглушку платежа');
        return this.createTestPayment(chatId, plan);
      }

      const payment = await this.yooKassa.createPayment({
        amount: {
          value: plan.price.toFixed(2),
          currency: "RUB"
        },
        payment_method_data: {
          type: "bank_card"
        },
        confirmation: {
          type: "redirect",
          return_url: `https://t.me/${process.env.BOT_USERNAME}`
        },
        description: `Premium подписка на БАД-планировщик: ${plan.name}`,
        metadata: {
          chatId: chatId,
          plan: plan.name,
          product: 'premium_subscription'
        },
        capture: true
      });

      // Сохраняем платеж в БД
      await this.savePayment(chatId, payment, plan);

      console.log(`✅ Платеж создан: ${payment.id}`);
      return payment;

    } catch (error) {
      console.error('❌ Ошибка создания платежа:', error);
      throw error;
    }
  }

  // Заглушка для тестового режима
  async createTestPayment(chatId, plan) {
    const testPayment = {
      id: 'test_payment_' + Date.now(),
      status: 'pending',
      amount: {
        value: plan.price.toFixed(2),
        currency: 'RUB'
      },
      confirmation: {
        type: "redirect",
        confirmation_url: `https://t.me/${process.env.BOT_USERNAME}?start=test_payment`
      },
      metadata: {
        chatId: chatId,
        plan: plan.name
      }
    };

    await this.savePayment(chatId, testPayment, plan);
    return testPayment;
  }

  // Сохранение платежа в БД (остается таким же)
  async savePayment(chatId, payment, plan) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO payments (chat_id, amount, currency, status, yookassa_id, plan, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          chatId,
          plan.price,
          'RUB',
          payment.status,
          payment.id,
          plan.name
        ],
        function(err) {
          if (err) {
            console.error('❌ Ошибка сохранения платежа:', err);
            reject(err);
          } else {
            console.log('✅ Платеж сохранен в БД, ID:', this.lastID);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  async handleWebhook(paymentData) {
    try {
      console.log('🔔 Webhook от ЮKassa:', paymentData.event);

      if (paymentData.event === 'payment.succeeded') {
        const payment = paymentData.object;
        const chatId = payment.metadata.chatId;
        const planName = payment.metadata.plan;

        console.log(`✅ Платеж успешен: ${payment.id} для ${chatId}`);

        // Активируем подписку
        await this.activateSubscription(chatId, planName);

        // Отправляем уведомление пользователю
        await this.notifyUser(chatId, payment);

        return { success: true };
      }

      return { success: false, reason: 'event_not_handled' };

    } catch (error) {
      console.error('❌ Ошибка обработки webhook:', error);
      throw error;
    }
  }

  // Активация подписки
  async activateSubscription(chatId, planName) {
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // 30 дней

    await subscriptionService.updateSubscription(chatId, {
      plan: 'premium',
      status: 'active',
      end_date: endDate.toISOString()
    });

    // Завершаем опрос если был незавершенный
    const surveyService = require('./surveyService');
    await surveyService.completeSurvey(chatId);

    console.log(`✅ Premium активирован для ${chatId}`);
  }

  // Уведомление пользователя
  async notifyUser(chatId, payment) {
    try {
      const bot = require('../bot');
      const { getMainMenuKeyboard } = require('../keyboards');

      await bot.telegram.sendMessage(
        chatId,
        `🎉 *Оплата прошла успешно! Premium подписка активирована на 30 дней!*\n\n` +
        `ID платежа: ${payment.id}\n` +
        `Сумма: ${payment.amount.value} ${payment.amount.currency}\n\n` +
        `Теперь вам доступны все Premium функции!`,
        {
          parse_mode: 'Markdown',
          ...getMainMenuKeyboard(true)
        }
      );
    } catch (error) {
      console.error('❌ Ошибка отправки уведомления:', error);
    }
  }

  // Проверка статуса платежа
  async getPaymentStatus(paymentId) {
    try {
      const payment = await this.yooKassa.getPayment(paymentId);
      return payment.status;
    } catch (error) {
      console.error('❌ Ошибка проверки статуса платежа:', error);
      return null;
    }
  }
}

module.exports = new RealPaymentService();
