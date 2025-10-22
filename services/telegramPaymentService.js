const db = require('../config/database');
const subscriptionService = require('./subscriptionService');

class TelegramPaymentService {
  constructor() {
    this.providerToken = process.env.YOOKASSA_PROVIDER_TOKEN;
    console.log('🔧 Инициализация Telegram Payments...');
    console.log('🔧 Provider Token:', this.providerToken ? 'LIVE ✅' : 'не установлен ❌');

    if (this.providerToken) {
      console.log('✅ Готов к приему реальных платежей через Telegram!');
    }
  }

  // Создание инвойса (счета) через Telegram API
  async createInvoice(chatId, plan) {
    try {
      console.log(`💳 Создание инвойса для ${chatId}, план: ${plan.name}`);

      const invoice = {
        chat_id: chatId,
        title: `💎 ${plan.name} Подписка`,
        description: this.getPlanDescription(plan),
        payload: `subscription_${chatId}_${Date.now()}`,
        provider_token: this.providerToken,
        currency: 'RUB',
        prices: [
          {
            label: plan.name,
            amount: plan.price * 100 // В копейках
          }
        ],
        need_name: false,
        need_phone_number: false,
        need_email: false,
        need_shipping_address: false,
        is_flexible: false,
        send_phone_number_to_provider: false,
        send_email_to_provider: false,
        photo_url: 'https://via.placeholder.com/300/0088cc/FFFFFF?text=Premium+Subscription',
        photo_size: 300,
        photo_width: 300,
        photo_height: 200
      };

      return invoice;

    } catch (error) {
      console.error('❌ Ошибка создания инвойса:', error);
      throw error;
    }
  }

  // Описание плана
  getPlanDescription(plan) {
    return `Premium подписка на 30 дней\n\nВключает:\n${plan.features.map(f => `• ${f}`).join('\n')}`;
  }

  // Обработка успешного платежа
  async processSuccessfulPayment(successfulPayment, chatId) {
    try {
      console.log('💰 Обработка успешного платежа:', successfulPayment);

      // Сохраняем информацию о платеже
      await this.savePayment(chatId, successfulPayment);

      // Активируем подписку (даже если сохранение платежа не удалось)
      await this.activateSubscription(chatId, 'Premium');

      console.log(`✅ Платеж обработан, Premium активирован для ${chatId}`);
      return true;

    } catch (error) {
      console.error('❌ Ошибка обработки платежа:', error);

      // Все равно пытаемся активировать Premium
      try {
        await this.activateSubscription(chatId, 'Premium');
        console.log(`✅ Premium активирован несмотря на ошибку сохранения платежа`);
      } catch (activationError) {
        console.error('❌ Критическая ошибка активации Premium:', activationError);
      }

      throw error;
    }
  }

  // Сохранение платежа в БД
  async savePayment(chatId, payment, plan = 'Premium') {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO payments (
          chat_id, amount, currency, status,
          yookassa_id, plan, provider_payload,
          telegram_payment_charge_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          chatId,
          payment.total_amount / 100, // Конвертируем обратно в рубли
          payment.currency,
          'succeeded',
          payment.provider_payment_charge_id,
          plan,
          payment.invoice_payload,
          payment.telegram_payment_charge_id
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

  // Активация подписки
  async activateSubscription(chatId, planName) {
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    console.log(`🎯 Активация Premium для ${chatId} до ${endDate}`);

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

  // Получить информацию о платежной системе
  getPaymentSystemInfo() {
    return {
      method: 'Telegram Payments',
      providerToken: this.providerToken ? 'LIVE ✅' : 'не установлен ❌',
      status: this.providerToken ? 'Готов к реальным платежам' : 'Не настроен',
      note: 'Secret Key не требуется для Telegram Payments'
    };
  }
}

module.exports = new TelegramPaymentService();
