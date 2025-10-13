const db = require('../config/database');
const subscriptionService = require('./subscriptionService');

class PaymentService {
  async createTestPayment(chatId, plan) {
    try {
      const paymentId = 'test_' + Date.now();

      await this.savePayment(chatId, {
        id: paymentId,
        amount: plan.price,
        status: 'pending'
      }, plan);

      return `https://t.me/${process.env.BOT_USERNAME}?start=payment_${paymentId}`;

    } catch (error) {
      console.error('❌ Ошибка создания платежа:', error);
      throw error;
    }
  }

  async savePayment(chatId, payment, plan) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO payments (chat_id, amount, currency, status, yookassa_id, plan)
        VALUES (?, ?, ?, ?, ?, ?)`,
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

  async confirmTestPayment(paymentId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM payments WHERE yookassa_id = ?', [paymentId], async (err, payment) => {
        if (err || !payment) {
          reject(new Error('Платеж не найден'));
          return;
        }

        db.run('UPDATE payments SET status = ? WHERE yookassa_id = ?',
          ['succeeded', paymentId], async (err) => {
            if (err) {
              reject(err);
              return;
            }

            await this.activateSubscription(payment.chat_id, payment.plan);
            resolve(true);
          });
      });
    });
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

    console.log(`✅ Подписка активирована для пользователя ${chatId}`);
  }

  async getPaymentStatus(chatId) {
    return new Promise((resolve) => {
      db.get(
        `SELECT status FROM payments WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1`,
        [chatId],
        (err, row) => {
          if (err || !row) resolve(null);
          else resolve(row.status);
        }
      );
    });
  }
}

module.exports = new PaymentService();
