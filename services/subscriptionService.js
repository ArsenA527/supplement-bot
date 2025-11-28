const db = require('../config/database');

class SubscriptionService {
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

  async isSubscriptionActive(chatId) {
    try {
      const subscription = await this.getUserSubscription(chatId);

      if (!subscription) {
        console.log('❌ Подписка не найдена');
        return false;
      }

      const isPremiumPlan = subscription.plan === 'premium';
      const isActiveStatus = subscription.status === 'active';

      let isNotExpired = true;
      if (subscription.end_date) {
        const now = new Date();
        const endDate = new Date(subscription.end_date);

        isNotExpired = endDate > now;
      }

      const result = isPremiumPlan && isActiveStatus && isNotExpired;

      return result;
    } catch (error) {
      console.error('❌ Ошибка проверки подписки:', error);
      return false;
    }
  }

  getSubscriptionPlans() {
    return {
      free: {
        name: 'Free',
        price: 0,
        features: [
          'Базовый опрос (9 вопросов)',
          'Общие рекомендации по БАДам',
          'Однократное прохождение'
        ]
      },
      premium: {
        name: 'Premium',
        price: 490,
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
