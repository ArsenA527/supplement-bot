const db = require('../config/database');
const logger = require('../utils/logger');

class GoalService {
  // 📅 Инициализация целей пользователя
  async initializeUserGoals(chatId, surveyAnswers) {
    const goals = this.extractGoalsFromSurvey(surveyAnswers);

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO user_goals (
          chat_id, main_goal, secondary_goals, created_at, updated_at
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [chatId, goals.mainGoal, JSON.stringify(goals.secondaryGoals)],
        function(err) {
          if (err) {
            logger.error('Ошибка инициализации целей', { chatId, error: err.message });
            reject(err);
          } else {
            logger.info('Цели пользователя инициализированы', { chatId, goals });
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // 🎯 Извлечение целей из опросника
  extractGoalsFromSurvey(answers) {
    const mainGoal = answers.goal || 'Общее оздоровление';

    const secondaryGoals = [];
    if (answers.energy && answers.energy.includes('усталость')) {
      secondaryGoals.push('Повышение энергии');
    }
    if (answers.sleep && !answers.sleep.includes('Хороший')) {
      secondaryGoals.push('Улучшение сна');
    }
    if (answers.stress && ['Часто', 'Постоянно'].includes(answers.stress)) {
      secondaryGoals.push('Снижение стресса');
    }
    if (answers.symptoms && answers.symptoms.includes('Проблемы с кожей')) {
      secondaryGoals.push('Улучшение состояния кожи');
    }

    return { mainGoal, secondaryGoals };
  }

  // 📊 Получение целей пользователя
  async getUserGoals(chatId) {
    return new Promise((resolve) => {
      db.get(
        `SELECT main_goal, secondary_goals, created_at, updated_at
         FROM user_goals WHERE chat_id = ?`,
        [chatId],
        (err, row) => {
          if (err || !row) {
            // Если целей нет, создаем на основе опроса
            this.createGoalsFromSurvey(chatId).then(resolve);
          } else {
            try {
              resolve({
                mainGoal: row.main_goal,
                secondaryGoals: JSON.parse(row.secondary_goals || '[]'),
                createdAt: row.created_at,
                updatedAt: row.updated_at
              });
            } catch (parseError) {
              resolve(this.createDefaultGoals());
            }
          }
        }
      );
    });
  }

  // 🎯 Создание целей на основе опроса
  async createGoalsFromSurvey(chatId) {
    const surveyService = require('./surveyService');
    const answers = await surveyService.getSurveyResults(chatId);

    if (!answers) {
      return this.createDefaultGoals();
    }

    return this.extractGoalsFromSurvey(answers);
  }

  // 🎯 Цели по умолчанию
  createDefaultGoals() {
    return {
      mainGoal: 'Общее оздоровление',
      secondaryGoals: ['Регулярный прием добавок', 'Улучшение самочувствия']
    };
  }

  // 📈 Прогресс по целям
  async getGoalProgress(chatId, days = 30) {
    const reminderService = require('./reminderService');
    const service = new reminderService();

    const stats = await service.getIntakeStats(chatId, days);
    const goals = await this.getUserGoals(chatId);

    return {
      goals,
      compliance: stats.compliance,
      streak: await this.getCurrentStreak(chatId),
      totalIntakes: stats.total,
      successfulIntakes: stats.taken,
      period: `${days} дней`
    };
  }

  // 🔥 Текущая серия (streak)
  async getCurrentStreak(chatId) {
    return new Promise((resolve) => {
      db.get(
        `SELECT COUNT(*) as streak_days
         FROM (
           SELECT DATE(taken_at) as intake_date
           FROM intake_history
           WHERE chat_id = ? AND status = 'taken'
           GROUP BY DATE(taken_at)
           ORDER BY intake_date DESC
         )`,
        [chatId],
        (err, row) => {
          resolve(row?.streak_days || 0);
        }
      );
    });
  }

  // 💪 Детальная статистика прогресса
  async getDetailedProgress(chatId) {
    const weeklyStats = await this.getGoalProgress(chatId, 7);
    const monthlyStats = await this.getGoalProgress(chatId, 30);
    const goals = await this.getUserGoals(chatId);

    return {
      goals,
      weekly: weeklyStats,
      monthly: monthlyStats,
      recommendations: this.generateProgressRecommendations(weeklyStats, monthlyStats)
    };
  }

  // 💡 Рекомендации по улучшению
  generateProgressRecommendations(weekly, monthly) {
    const recommendations = [];

    if (weekly.compliance < 70) {
      recommendations.push('Старайтесь принимать добавки регулярнее - это ключ к результату!');
    }

    if (weekly.streak < 3) {
      recommendations.push('Попробуйте создать привычку - принимайте добавки в одно и то же время.');
    }

    if (monthly.compliance >= 90) {
      recommendations.push('Отличная дисциплина! Продолжайте в том же духе! 🎉');
    }

    if (weekly.compliance > monthly.compliance) {
      recommendations.push('Ваша дисциплина улучшается - так держать! 📈');
    }

    return recommendations.length > 0 ? recommendations : ['Продолжайте регулярный прием для достижения целей! 💪'];
  }
}

module.exports = new GoalService();
