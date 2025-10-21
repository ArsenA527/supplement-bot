const db = require('../config/database');
const subscriptionService = require('./subscriptionService');

class UnifiedPaymentService {
  constructor() {
    this.yooKassa = null;
    this.isRealPayments = false;
    this.initYooKassa();
  }

  async initYooKassa() {
    console.log('🔧 Инициализация платежной системы...');

    // Проверяем наличие необходимых переменных
    const hasShopId = process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SHOP_ID !== '123456';
    const hasSecretKey = process.env.YOOKASSA_SECRET_KEY &&
      (process.env.YOOKASSA_SECRET_KEY.startsWith('test_') ||
      process.env.YOOKASSA_SECRET_KEY.startsWith('live_'));

    console.log('🔧 Проверка переменных:', {
      hasShopId,
      hasSecretKey,
      shopId: process.env.YOOKASSA_SHOP_ID ? 'установлен' : 'не установлен',
      secretKey: process.env.YOOKASSA_SECRET_KEY ? `${process.env.YOOKASSA_SECRET_KEY.substring(0, 10)}...` : 'не установлен'
    });

    if (hasShopId && hasSecretKey) {
      try {
        let YooKassa;
        let packageName = '';

        // Пробуем @a2seven/yoo-checkout (основной)
        try {
          YooKassa = require('@a2seven/yoo-checkout');
          packageName = '@a2seven/yoo-checkout';
          console.log('✅ Используется @a2seven/yoo-checkout');

          // Для @a2seven/yoo-checkout это функция, а не класс
          this.yooKassa = YooKassa({
            shopId: process.env.YOOKASSA_SHOP_ID,
            secretKey: process.env.YOOKASSA_SECRET_KEY
          });

        } catch (error) {
          console.log('❌ @a2seven/yoo-checkout не доступен:', error.message);

          // Пробуем официальный yookassa
          try {
            const { YooCheckout } = require('yookassa');
            packageName = 'yookassa';
            console.log('✅ Используется yookassa');

            // Для официального пакета это класс
            this.yooKassa = new YooCheckout({
              shopId: process.env.YOOKASSA_SHOP_ID,
              secretKey: process.env.YOOKASSA_SECRET_KEY
            });

          } catch (error2) {
            console.log('❌ yookassa не доступен:', error2.message);

            // Последняя попытка - yookassa как функция
            try {
              YooKassa = require('yookassa');
              packageName = 'yookassa (function)';
              console.log('✅ Используется yookassa как функция');

              this.yooKassa = YooKassa({
                shopId: process.env.YOOKASSA_SHOP_ID,
                secretKey: process.env.YOOKASSA_SECRET_KEY
              });

            } catch (error3) {
              console.log('❌ Все варианты не доступны');
              throw new Error('Нет доступного SDK ЮKassa');
            }
          }
        }

        this.isRealPayments = true;
        console.log(`✅ ЮKassa инициализирована через ${packageName}`);

        // Тестовая проверка подключения
        await this.testConnection();

      } catch (error) {
        console.error('❌ Ошибка инициализации ЮKassa:', error.message);
        console.log('🔧 Продолжаем в тестовом режиме');
        this.isRealPayments = false;
      }
    } else {
      console.log('🔧 Режим: ТЕСТОВЫЕ ПЛАТЕЖИ (не хватает данных ЮKassa)');
      this.isRealPayments = false;
    }
  }

  // Тест подключения к ЮKassa
  async testConnection() {
    try {
      // Простая проверка - пытаемся создать тестовый платеж
      const testPayment = await this.createRealPayment(999999, {
        name: 'Test Plan',
        price: 1
      });

      console.log('✅ Подключение к ЮKassa успешно. Тестовый платеж создан:', testPayment.id);

      // Отменяем тестовый платеж чтобы не висеть в ожидании
      if (this.yooKassa.cancelPayment) {
        await this.yooKassa.cancelPayment(testPayment.id);
      }

    } catch (error) {
      console.error('❌ Ошибка подключения к ЮKassa:', error.response?.data || error.message);
      this.isRealPayments = false;
    }
  }

  // Создание платежа (универсальный метод)
  async createPayment(chatId, plan) {
    try {
      console.log(`💳 Создание платежа для ${chatId}, план: ${plan.name}`);

      if (this.isRealPayments && this.yooKassa) {
        return await this.createRealPayment(chatId, plan);
      } else {
        return await this.createTestPayment(chatId, plan);
      }
    } catch (error) {
      console.error('❌ Ошибка создания платежа:', error);
      // При ошибке возвращаем тестовый платеж
      return await this.createTestPayment(chatId, plan);
    }
  }

  // Реальный платеж через ЮKassa
  async createRealPayment(chatId, plan) {
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

  // Проверка статуса платежа
  async checkPaymentStatus(paymentId) {
    if (!this.isRealPayments) {
      // Для тестовых платежей всегда возвращаем успех
      return 'succeeded';
    }

    try {
      const payment = await this.yooKassa.getPayment(paymentId);
      return payment.status;
    } catch (error) {
      console.error('❌ Ошибка проверки статуса платежа:', error);
      return 'pending';
    }
  }

  // Обработка успешного платежа
  async processSuccessfulPayment(paymentId) {
    try {
      // Находим платеж в БД
      const payment = await this.getPaymentByYooKassaId(paymentId);
      if (!payment) {
        throw new Error('Платеж не найден в БД');
      }

      // Активируем подписку
      await this.activateSubscription(payment.chat_id, payment.plan);

      // Обновляем статус платежа
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

    // Завершаем опрос если был
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

  // Получить последний платеж пользователя
  async getLastUserPayment(chatId) {
    return new Promise((resolve) => {
      db.get(
        `SELECT * FROM payments WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1`,
        [chatId],
        (err, row) => {
          if (err || !row) resolve(null);
          else resolve(row);
        }
      );
    });
  }
}

module.exports = new UnifiedPaymentService();
