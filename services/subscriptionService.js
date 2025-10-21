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
    try {
      const subscription = await this.getUserSubscription(chatId);
      console.log(`🔍 Проверка подписки ${chatId}:`, subscription);

      if (!subscription) {
        console.log('❌ Подписка не найдена');
        return false;
      }

      // Проверяем план
      const isPremiumPlan = subscription.plan === 'premium';
      console.log(`📋 План: ${subscription.plan}, Premium: ${isPremiumPlan}`);

      // Проверяем статус
      const isActiveStatus = subscription.status === 'active';
      console.log(`📊 Статус: ${subscription.status}, Активен: ${isActiveStatus}`);

      // Проверяем дату окончания - ИСПРАВЛЯЕМ БАГ!
      let isNotExpired = true;
      if (subscription.end_date) {
        const now = new Date();
        const endDate = new Date(subscription.end_date);

        // ДЕБАГ: выводим обе даты для сравнения
        console.log(`📅 Сейчас: ${now.toISOString()}`);
        console.log(`📅 Окончание: ${endDate.toISOString()}`);
        console.log(`📅 endDate > now: ${endDate > now}`);

        isNotExpired = endDate > now;
        console.log(`📅 Не истекла: ${isNotExpired}`);
      }

      const result = isPremiumPlan && isActiveStatus && isNotExpired;
      console.log(`🎯 Итог проверки Premium: ${result}`);

      return result;

    } catch (error) {
      console.error('❌ Ошибка проверки подписки:', error);
      return false;
    }
  }

  // Получить информацию о тарифах
  getSubscriptionPlans() {
    return {
      free: {
        name: 'Free',
        price: 0,
        features: [
          'Базовый опрос (8 вопросов)',
          'Общие рекомендации',
          'Одноразовое прохождение'
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
