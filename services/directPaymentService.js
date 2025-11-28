const db = require('../config/database');
const subscriptionService = require('./subscriptionService');
const axios = require('axios');

class DirectPaymentService {
  constructor() {
    this.isRealPayments = false;
    this.authToken = null;
    this.init();
  }

  init() {

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;

    console.log('🔧 YOOKASSA_SHOP_ID:', shopId);
    console.log('🔧 YOOKASSA_SECRET_KEY:', secretKey ? secretKey.substring(0, 10) + '...' : 'не установлен');

    const hasShopId = shopId && shopId !== '123456' && shopId.length > 3;
    const hasSecretKey = secretKey &&
      (secretKey.startsWith('test_') || secretKey.startsWith('live_'));

    if (hasShopId && hasSecretKey) {
      this.shopId = shopId;
      this.secretKey = secretKey;
      this.authBasic = Buffer.from(`${shopId}:${secretKey}`).toString('base64');
      this.authBearer = secretKey;
      this.isRealPayments = true;

      this.testConnection();
    } else {
      console.log('🔧 Режим: ТЕСТОВЫЕ ПЛАТЕЖИ');
      this.isRealPayments = false;
    }
  }

  async testConnection() {
    const methods = [
      { name: 'Bearer Token', header: `Bearer ${this.secretKey}` },
      { name: 'Basic Auth', header: `Basic ${this.authBasic}` },
      { name: 'Shop ID + Secret Key', header: `Basic ${Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64')}` }
    ];

    for (const method of methods) {
      try {
        console.log(`🔧 Тестируем метод: ${method.name}...`);

        const response = await axios.get('https://api.yookassa.ru/v3/me', {
          headers: {
            'Authorization': method.header,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });

        console.log(`✅ Метод "${method.name}" РАБОТАЕТ! Магазин:`, response.data.account_id);
        this.authHeader = method.header;
        return;

      } catch (error) {
        console.log(`❌ Метод "${method.name}" не работает:`, error.response?.data?.description || error.message);
      }
    }

    console.log('❌ Ни один метод аутентификации не сработал');
    this.isRealPayments = false;
  }

  async createPayment(chatId, plan) {
    try {
      console.log(`💳 Создание платежа для ${chatId}, план: ${plan.name}, цена: ${plan.price} руб`);

      if (this.isRealPayments) {
        return await this.createRealPayment(chatId, plan);
      } else {
        return await this.createTestPayment(chatId, plan);
      }
    } catch (error) {
      console.error('❌ Ошибка создания платежа:', error);
      return await this.createTestPayment(chatId, plan);
    }
  }

  async createRealPayment(chatId, plan) {
    if (!this.authHeader) {
      throw new Error('Аутентификация не настроена');
    }

    const idempotenceKey = `payment_${chatId}_${Date.now()}`;

    const paymentData = {
      amount: {
        value: plan.price.toFixed(2),
        currency: 'RUB'
      },
      payment_method_data: {
        type: 'bank_card'
      },
      confirmation: {
        type: 'redirect',
        return_url: `https://t.me/${process.env.BOT_USERNAME}`
      },
      description: `Premium подписка БАД-планировщик на 30 дней`,
      metadata: {
        chat_id: chatId.toString(),
        plan: plan.name
      },
      capture: true
    };

    console.log('📦 Создание реального платежа через API...');

    try {
      const response = await axios.post(
        'https://api.yookassa.ru/v3/payments',
        paymentData,
        {
          headers: {
            'Authorization': this.authHeader,
            'Idempotence-Key': idempotenceKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const payment = response.data;
      await this.savePayment(chatId, payment, plan);
      console.log('✅ Реальный платеж создан через API:', payment.id);

      return payment;
    } catch (error) {
      console.error('❌ Ошибка создания реального платежа через API:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  }

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
        chat_id: chatId.toString(),
        plan: plan.name,
        is_test: true
      }
    };

    await this.savePayment(chatId, testPayment, plan);
    console.log(`🔧 Тестовый платеж создан: ${testPayment.id}`);
    return testPayment;
  }

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

  async checkPaymentStatus(paymentId) {
    if (!this.isRealPayments) {
      return 'pending';
    }

    try {
      const response = await axios.get(
        `https://api.yookassa.ru/v3/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data.status;
    } catch (error) {
      console.error('❌ Ошибка проверки статуса платежа:', error.response?.data || error.message);
      return 'pending';
    }
  }

  async processSuccessfulPayment(paymentId) {
    try {
      const payment = await this.getPaymentByYooKassaId(paymentId);
      if (!payment) {
        throw new Error('Платеж не найден в БД');
      }

      await this.activateSubscription(payment.chat_id, payment.plan);
      await this.updatePaymentStatus(paymentId, 'succeeded');

      return true;

    } catch (error) {
      console.error('❌ Ошибка обработки платежа:', error);
      throw error;
    }
  }

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

  async getPaymentByYooKassaId(yookassaId) {
    return new Promise((resolve) => {
      db.get(
        'SELECT * FROM payments WHERE yookassa_id = ?',
        [yookassaId],
        (err, row) => {
          if (err || !row) {
            console.log('❌ Платеж не найден в БД:', yookassaId);
            resolve(null);
          } else {
            resolve(row);
          }
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

  getPaymentSystemInfo() {
    return {
      isRealPayments: this.isRealPayments,
      method: 'Bearer Token API',
      shopId: process.env.YOOKASSA_SHOP_ID ? 'установлен' : 'не установлен',
      secretKey: process.env.YOOKASSA_SECRET_KEY ? 'установлен' : 'не установлен'
    };
  }
}

module.exports = new DirectPaymentService();
