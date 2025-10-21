const db = require('../config/database');
const subscriptionService = require('./subscriptionService');
const axios = require('axios');

class SimplePaymentService {
  constructor() {
    this.isRealPayments = false;
    this.auth = null;
    this.init();
  }

  init() {
    const hasShopId = process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SHOP_ID !== '123456';
    const hasSecretKey = process.env.YOOKASSA_SECRET_KEY &&
      (process.env.YOOKASSA_SECRET_KEY.startsWith('test_') ||
       process.env.YOOKASSA_SECRET_KEY.startsWith('live_'));

    if (hasShopId && hasSecretKey) {
      this.auth = {
        username: process.env.YOOKASSA_SHOP_ID,
        password: process.env.YOOKASSA_SECRET_KEY
      };
      this.isRealPayments = true;
      console.log('✅ Реальные платежи через API ЮKassa');
    } else {
      console.log('🔧 Тестовый режим платежей');
    }
  }

  async createPayment(chatId, plan) {
    if (this.isRealPayments) {
      return await this.createRealPayment(chatId, plan);
    } else {
      return await this.createTestPayment(chatId, plan);
    }
  }

  // Реальный платеж через прямое API
  async createRealPayment(chatId, plan) {
    try {
      const paymentData = {
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
          plan: plan.name
        },
        capture: true
      };

      const response = await axios.post(
        'https://api.yookassa.ru/v3/payments',
        paymentData,
        {
          auth: this.auth,
          headers: {
            'Idempotence-Key': `payment_${chatId}_${Date.now()}`
          }
        }
      );

      const payment = response.data;
      await this.savePayment(chatId, payment, plan);

      console.log('✅ Реальный платеж создан:', payment.id);
      return payment;

    } catch (error) {
      console.error('❌ Ошибка создания реального платежа:', error.response?.data || error.message);
      // При ошибке возвращаем тестовый платеж
      return await this.createTestPayment(chatId, plan);
    }
  }

  // Тестовый платеж
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
        plan: plan.name,
        is_test: true
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

  // Проверка статуса платежа через API
  async checkPaymentStatus(paymentId) {
    if (!this.isRealPayments) {
      return 'succeeded'; // Для тестов всегда успех
    }

    try {
      const response = await axios.get(
        `https://api.yookassa.ru/v3/payments/${paymentId}`,
        { auth: this.auth }
      );
      return response.data.status;
    } catch (error) {
      console.error('❌ Ошибка проверки статуса:', error.response?.data || error.message);
      return 'pending';
    }
  }

  // Обработка успешного платежа
  async processSuccessfulPayment(paymentId) {
    try {
      const payment = await this.getPaymentByYooKassaId(paymentId);
      if (!payment) {
        throw new Error('Платеж не найден в БД');
      }

      await this.activateSubscription(payment.chat_id, payment.plan);
      await this.updatePaymentStatus(paymentId, 'succeeded');

      console.log(`✅ Платеж обработан: ${paymentId}`);
      return true;

    } catch (error) {
      console.error('❌ Ошибка обработки платежа:', error);
      throw error;
    }
  }

  // Активация подписки
  async activateSubscription(chatId, planName) {
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    await subscriptionService.updateSubscription(chatId, {
      plan: 'premium',
      status: 'active',
      end_date: endDate.toISOString()
    });

    const surveyService = require('./surveyService');
    await surveyService.completeSurvey(chatId);

    console.log(`✅ Premium активирован для ${chatId}`);
  }

  // Вспомогательные методы для работы с БД
  async getPaymentByYooKassaId(yookassaId) {
    return new Promise((resolve) => {
      db.get(
        'SELECT * FROM payments WHERE yookassa_id = ?',
        [yookassaId],
        (err, row) => {
          if (err || !row) resolve(null);
          else resolve(row);
        }
      );
    });
  }

  async updatePaymentStatus(yookassaId, status) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE payments SET status = ? WHERE yookassa_id = ?',
        [status, yookassaId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }
}

module.exports = new SimplePaymentService();
