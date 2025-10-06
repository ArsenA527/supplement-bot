const db = require('../config/database');

class SubscriptionService {
  // Получить подписку пользователя
  async getUserSubscription(chatId) {
    return new Promise((resolve) => {
      db.get(
        `SELECT plan, status, end_date FROM subscriptions WHERE chat_id = ?`,
        [chatId],
        (err, row) => {
          if (err) {
            console.error('❌ Ошибка получения подписки:', err);
            resolve({ plan: 'free', status: 'active' });
          } else {
            resolve(row || { plan: 'free', status: 'active' });
          }
        }
      );
    });
  }

  // Создать/обновить подписку
  async updateSubscription(chatId, planData) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO subscriptions (chat_id, plan, status, end_date)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(chat_id)
         DO UPDATE SET plan = ?, status = ?, end_date = ?`,
        [
          chatId,
          planData.plan,
          planData.status,
          planData.end_date,
          planData.plan,
          planData.status,
          planData.end_date
        ],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  // Проверить активна ли подписка
  async isSubscriptionActive(chatId) {
    const subscription = await this.getUserSubscription(chatId);

    if (subscription.plan === 'free') return false;
    if (subscription.status !== 'active') return false;

    // Проверяем дату окончания
    if (subscription.end_date) {
      const endDate = new Date(subscription.end_date);
      return endDate > new Date();
    }

    return true;
  }

  // Получить информацию о тарифах
  getSubscriptionPlans() {
    return {
      free: {
        price: 0,
        features: [
          'Базовый опрос (8 вопросов)',
          'Общие рекомендации',
          'Одноразовое прохождение'
        ]
      },
      premium: {
        price: 590,
        period: 'month',
        features: [
          'Расширенный опрос (17+ вопросов)',
          'Персональные дозировки',
          'Напоминания о приеме',
          'Неограниченные опросы',
          'Приоритетная поддержка'
        ]
      }
    };
  }
}

module.exports = new SubscriptionService();
