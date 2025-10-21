const db = require('../config/database');
const subscriptionService = require('./subscriptionService');

class RealPaymentService {
  constructor() {
    this.yooKassa = null;
    this.initYooKassa();
  }

  initYooKassa() {
    try {
      // Пробуем разные варианты инициализации
      if (process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY) {

        // Вариант 1: Стандартный пакет yookassa
        try {
          const { YooKassa } = require('yookassa');
          this.yooKassa = new YooKassa({
            shopId: process.env.YOOKASSA_SHOP_ID,
            secretKey: process.env.YOOKASSA_SECRET_KEY
          });
          console.log('✅ ЮKassa инициализирована (стандартный пакет)');
          return;
        } catch (error) {
          console.log('⚠️ Стандартный пакет не загружен:', error.message);
        }

        // Вариант 2: Пакет @a2seven/yoo-checkout
        try {
          const YooKassa = require('@a2seven/yoo-checkout');
          this.yooKassa = new YooKassa({
            shopId: process.env.YOOKASSA_SHOP_ID,
            secretKey: process.env.YOOKASSA_SECRET_KEY
          });
          console.log('✅ ЮKassa инициализирована (@a2seven/yoo-checkout)');
          return;
        } catch (error) {
          console.log('⚠️ Пакет @a2seven/yoo-checkout не загружен:', error.message);
        }

        // Вариант 3: Другие возможные пакеты
        try {
          const yookassa = require('yookassa');
          // Если это функция, а не класс
          if (typeof yookassa === 'function') {
            this.yooKassa = yookassa({
              shopId: process.env.YOOKASSA_SHOP_ID,
              secretKey: process.env.YOOKASSA_SECRET_KEY
            });
            console.log('✅ ЮKassa инициализирована (функция)');
            return;
          }
        } catch (error) {
          console.log('⚠️ Другие пакеты не загружены');
        }
      }

      // Если ничего не сработало
      console.log('🔧 Режим: ТЕСТОВЫЕ ПЛАТЕЖИ (без реальной ЮKassa)');

    } catch (error) {
      console.error('❌ Ошибка инициализации ЮKassa:', error);
      console.log('🔧 Продолжаем в тестовом режиме');
    }
  }

  // Создание платежа
  async createPayment(chatId, plan) {
    try {
      console.log(`💳 Создание платежа для ${chatId}, план: ${plan.name}`);

      // Если ЮKassa не настроена или тестовый режим - создаем тестовый платеж
      if (!this.yooKassa || process.env.YOOKASSA_TEST_MODE === 'true') {
        return this.createTestPayment(chatId, plan);
      }

      // Реальный платеж через ЮKassa
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
        description: `Premium подписка БАД-планировщик: ${plan.name}`,
        metadata: {
          chatId: chatId,
          plan: plan.name,
          product: 'premium_subscription'
        },
        capture: true
      });

      await this.savePayment(chatId, payment, plan);
      console.log(`✅ Реальный платеж создан: ${payment.id}`);
      return payment;

    } catch (error) {
      console.error('❌ Ошибка создания реального платежа:', error);
      // При ошибке возвращаем тестовый платеж
      return this.createTestPayment(chatId, plan);
    }
  }

  // Тестовый платеж (заглушка)
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
        confirmation_url: `https://t.me/${process.env.BOT_USERNAME}`
      },
      metadata: {
        chatId: chatId,
        plan: plan.name
      }
    };

    await this.savePayment(chatId, testPayment, plan);
    console.log(`🔧 Тестовый платеж создан: ${testPayment.id}`);
    return testPayment;
  }

  // Сохранение платежа в БД
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
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  // Активация подписки после успешной оплаты
  async activateSubscription(chatId, planName) {
    try {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1); // 30 дней

      await subscriptionService.updateSubscription(chatId, {
        plan: 'premium',
        status: 'active',
        end_date: endDate.toISOString()
      });

      // Завершаем опрос если был
      const surveyService = require('./surveyService');
      await surveyService.completeSurvey(chatId);

      console.log(`✅ Premium активирован для ${chatId}`);
      return true;

    } catch (error) {
      console.error('❌ Ошибка активации подписки:', error);
      throw error;
    }
  }

  // Тестовый платеж (заглушка)
  async createTestPayment(chatId, plan) {
    const testPayment = {
      id: 'test_payment_' + Date.now(),
      status: 'pending',
      amount: {
        value: plan.price.toFixed(2),
        currency: 'RUB'
      },
      // Для тестового режима делаем URL который ведет обратно в бота
      confirmation: {
        type: "redirect",
        confirmation_url: `https://t.me/${process.env.BOT_USERNAME}?start=test_payment_${Date.now()}`
      },
      metadata: {
        chatId: chatId,
        plan: plan.name,
        is_test: true // Помечаем как тестовый
      }
    };

    await this.savePayment(chatId, testPayment, plan);
    console.log(`🔧 Тестовый платеж создан: ${testPayment.id}`);
    return testPayment;
  }
}

module.exports = new RealPaymentService();
