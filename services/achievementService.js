const db = require('../config/database');
const logger = require('../utils/logger');

class AchievementService {
  constructor() {
    this.achievements = {
      first_steps: { name: 'Первые шаги', desc: 'Пройдите первый опрос', icon: '🎯' },
      week_streak: { name: 'Неделя дисциплины', desc: 'Принимайте добавки 7 дней подряд', icon: '🔥' },
      month_master: { name: 'Мастер месяца', desc: '90% соблюдения за месяц', icon: '🏆' },
      early_bird: { name: 'Жаворонок', desc: 'Примите утренние добавки 5 дней подряд', icon: '🌅' },
      supplement_expert: { name: 'Эксперт по БАДам', desc: 'Получите 10+ рекомендаций', icon: '💊' },
      premium_member: { name: 'Премиум статус', desc: 'Активируйте premium подписку', icon: '💎' }
    };
  }

  // Проверка и выдача достижений
  async checkAndAwardAchievements(chatId, action, context = {}) {
    const userAchievements = await this.getUserAchievements(chatId);
    const newAchievements = [];

    // Проверяем разные типы достижений
    switch(action) {
      case 'survey_complete':
        if (!userAchievements.includes('first_steps')) {
          await this.awardAchievement(chatId, 'first_steps');
          newAchievements.push('first_steps');
        }
        break;

      case 'premium_activated':
        if (!userAchievements.includes('premium_member')) {
          await this.awardAchievement(chatId, 'premium_member');
          newAchievements.push('premium_member');
        }
        break;

      case 'streak_updated':
        if (context.streak >= 7 && !userAchievements.includes('week_streak')) {
          await this.awardAchievement(chatId, 'week_streak');
          newAchievements.push('week_streak');
        }
        break;
    }

    return newAchievements;
  }

  // Выдать достижение
  async awardAchievement(chatId, achievementId) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO achievements (chat_id, achievement_id, awarded_at)
         VALUES (?, ?, datetime('now'))`,
        [chatId, achievementId],
        function(err) {
          if (err) {
            logger.error('Ошибка выдачи достижения', { chatId, achievementId, error: err.message });
            reject(err);
          } else {
            logger.info('Достижение выдано', { chatId, achievementId });
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // Получить достижения пользователя
  async getUserAchievements(chatId) {
    return new Promise((resolve) => {
      db.all(
        `SELECT achievement_id FROM achievements WHERE chat_id = ? ORDER BY awarded_at DESC`,
        [chatId],
        (err, rows) => {
          if (err) {
            logger.error('Ошибка получения достижений', { chatId, error: err.message });
            resolve([]);
          } else {
            const achievements = rows.map(row => row.achievement_id);
            resolve(achievements);
          }
        }
      );
    });
  }

  // Получить детальную информацию о достижениях
  async getAchievementsWithDetails(chatId) {
    const userAchievements = await this.getUserAchievements(chatId);

    return userAchievements.map(achievementId => ({
      id: achievementId,
      ...this.achievements[achievementId],
      awarded: true
    }));
  }

  // Получить все возможные достижения
  getAllAchievements() {
    return Object.keys(this.achievements).map(id => ({
      id,
      ...this.achievements[id]
    }));
  }

  // Отправить уведомление о новом достижении
  async notifyNewAchievement(ctx, achievementId) {
    const achievement = this.achievements[achievementId];
    if (!achievement) return;

    const message = `🎉 *Новое достижение!*\n\n${achievement.icon} *${achievement.name}*\n${achievement.desc}\n\nПродолжайте в том же духе! 💪`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }
}

module.exports = new AchievementService();
