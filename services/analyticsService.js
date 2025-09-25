const db = require('../config/database');
const logger = require('../utils/logger');

class AnalyticsService {

  // 📊 ОСНОВНЫЕ СОБЫТИЯ ДЛЯ ТРЕКИНГА
  async trackEvent(chatId, eventName, metadata = {}) {
    try {
      await this.saveEvent(chatId, eventName, metadata);
      logger.debug('Событие записано', { chatId, eventName });
    } catch (error) {
      logger.error('Ошибка записи события', { error: error.message });
    }
  }

  // 💾 СОХРАНЕНИЕ СОБЫТИЯ В БД
  async saveEvent(chatId, eventName, metadata) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO analytics (chat_id, event_name, metadata) VALUES (?, ?, ?)`,
        [chatId, eventName, JSON.stringify(metadata)],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  // 📈 КЛЮЧЕВЫЕ МЕТРИКИ СИСТЕМЫ
  async getKeyMetrics(days = 30) {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    return {
      // 👥 ПОЛЬЗОВАТЕЛИ
      totalUsers: await this.getTotalUsers(),
      newUsers: await this.getNewUsers(dateThreshold),
      activeUsers: await this.getActiveUsers(dateThreshold),

      // 📝 ОПРОСНИК
      surveyStarts: await this.getEventCount('survey_start', dateThreshold),
      surveyCompletions: await this.getEventCount('survey_complete', dateThreshold),
      surveyCompletionRate: await this.getSurveyCompletionRate(dateThreshold),

      // 💎 PREMIUM
      premiumConversions: await this.getEventCount('premium_conversion', dateThreshold),
      premiumConversionRate: await this.getPremiumConversionRate(dateThreshold),

      // ⏰ НАПОМИНАНИЯ
      reminderSends: await this.getEventCount('reminder_sent', dateThreshold),
      reminderInteractions: await this.getEventCount('reminder_interaction', dateThreshold),
      reminderEngagementRate: await this.getReminderEngagementRate(dateThreshold)
    };
  }

  // 👥 МЕТРИКИ ПОЛЬЗОВАТЕЛЕЙ
  async getTotalUsers() {
    return new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        resolve(row?.count || 0);
      });
    });
  }

  async getNewUsers(sinceDate) {
    return new Promise((resolve) => {
      db.get(
        'SELECT COUNT(*) as count FROM users WHERE created_at > ?',
        [sinceDate.toISOString()],
        (err, row) => {
          resolve(row?.count || 0);
        }
      );
    });
  }

  async getActiveUsers(sinceDate) {
    return new Promise((resolve) => {
      db.get(
        `SELECT COUNT(DISTINCT chat_id) as count FROM analytics
         WHERE created_at > ?`,
        [sinceDate.toISOString()],
        (err, row) => {
          resolve(row?.count || 0);
        }
      );
    });
  }

  // 📝 МЕТРИКИ ОПРОСНИКА
  async getEventCount(eventName, sinceDate) {
    return new Promise((resolve) => {
      db.get(
        `SELECT COUNT(*) as count FROM analytics
         WHERE event_name = ? AND created_at > ?`,
        [eventName, sinceDate.toISOString()],
        (err, row) => {
          resolve(row?.count || 0);
        }
      );
    });
  }

  async getSurveyCompletionRate(sinceDate) {
    const starts = await this.getEventCount('survey_start', sinceDate);
    const completions = await this.getEventCount('survey_complete', sinceDate);

    return starts > 0 ? Math.round((completions / starts) * 100) : 0;
  }

  // 💎 МЕТРИКИ PREMIUM
  async getPremiumConversionRate(sinceDate) {
    const surveyCompletions = await this.getEventCount('survey_complete', sinceDate);
    const premiumConversions = await this.getEventCount('premium_conversion', sinceDate);

    return surveyCompletions > 0 ? Math.round((premiumConversions / surveyCompletions) * 100) : 0;
  }

  // ⏰ МЕТРИКИ НАПОМИНАНИЙ
  async getReminderEngagementRate(sinceDate) {
    const sends = await this.getEventCount('reminder_sent', sinceDate);
    const interactions = await this.getEventCount('reminder_interaction', sinceDate);

    return sends > 0 ? Math.round((interactions / sends) * 100) : 0;
  }

  // 📊 ДЕТАЛЬНАЯ АНАЛИТИКА ПО ОПРОСНИКУ
  async getSurveyAnalytics() {
    return {
      averageTimeToComplete: await this.getAverageSurveyTime(),
      mostCommonGoals: await this.getMostCommonGoals(),
      questionDropoffPoints: await this.getQuestionDropoffPoints(),
      userSatisfaction: await this.getUserSatisfaction()
    };
  }

  async getMostCommonGoals() {
    return new Promise((resolve) => {
      db.all(
        `SELECT metadata->>'$.goal' as goal, COUNT(*) as count
         FROM analytics
         WHERE event_name = 'survey_complete'
         AND metadata->>'$.goal' IS NOT NULL
         GROUP BY goal
         ORDER BY count DESC
         LIMIT 5`,
        (err, rows) => {
          resolve(rows || []);
        }
      );
    });
  }

  // 📋 ЕЖЕДНЕВНЫЙ ОТЧЕТ ДЛЯ АДМИНА
  async generateDailyReport() {
    const metrics = await this.getKeyMetrics(1); // За последние 24 часа
    const report = this.formatDailyReport(metrics);

    await this.sendReportToAdmin(report);
    return report;
  }

  formatDailyReport(metrics) {
    return `📊 *ЕЖЕДНЕВНЫЙ ОТЧЕТ* 📊

👥 *Пользователи:*
• Новые: ${metrics.newUsers}
• Активные: ${metrics.activeUsers}
• Всего: ${metrics.totalUsers}

📝 *Опросник:*
• Начато: ${metrics.surveyStarts}
• Завершено: ${metrics.surveyCompletions}
• Конверсия: ${metrics.surveyCompletionRate}%

💎 *Premium:*
• Конверсий: ${metrics.premiumConversions}
• Конверсия: ${metrics.premiumConversionRate}%

⏰ *Напоминания:*
• Отправлено: ${metrics.reminderSends}
• Взаимодействий: ${metrics.reminderInteractions}
• Engagement: ${metrics.reminderEngagementRate}%

📈 *Тренды:* ${this.getTrendEmoji(metrics)}`;
  }

  getTrendEmoji(metrics) {
    // Простая логика для трендов (можно улучшить)
    return metrics.newUsers > 0 ? '📈' : '📉';
  }

  async sendReportToAdmin(report) {
    try {
      const adminId = process.env.ADMIN_CHAT_ID;
      if (!adminId) return;

      const bot = require('../bot');
      await bot.telegram.sendMessage(adminId, report, { parse_mode: 'Markdown' });

      logger.info('Ежедневный отчет отправлен админу');
    } catch (error) {
      logger.error('Ошибка отправки отчета админу', { error: error.message });
    }
  }
}

module.exports = new AnalyticsService();
