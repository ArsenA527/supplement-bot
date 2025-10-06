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


  // 📋 ЕЖЕДНЕВНЫЙ ОТЧЕТ ДЛЯ АДМИНА
  async sendReportToAdmin(report) {
    try {
      const adminId = process.env.ADMIN_CHAT_ID;
      if (!adminId) {
        logger.warn('ADMIN_CHAT_ID не установлен, отчет не отправлен');
        return;
      }

      if (typeof global.botInstance === 'undefined' || !global.botInstance.telegram) {
        logger.warn('Бот не инициализирован, отчет не отправлен');
        return;
      }

      await global.botInstance.telegram.sendMessage(adminId, report, {
        parse_mode: 'Markdown'
      });

      logger.info('Ежедневный отчет отправлен админу', { adminId });

    } catch (error) {
      logger.error('Ошибка отправки отчета админу', {
        error: error.message,
        adminId: process.env.ADMIN_CHAT_ID
      });
    }
  }

  formatDailyReport(metrics) {
    // Проверяем что metrics существует и имеет данные
    if (!metrics || Object.keys(metrics).length === 0) {
      return '📊 *ЕЖЕДНЕВНЫЙ ОТЧЕТ*\n\n❌ Данных за сегодня еще нет';
    }

    return `📊 *ЕЖЕДНЕВНЫЙ ОТЧЕТ* 📊

  👥 *Пользователи:*
  • Новые: ${metrics.newUsers || 0}
  • Активные: ${metrics.activeUsers || 0}
  • Всего: ${metrics.totalUsers || 0}

  📝 *Опросник:*
  • Начато: ${metrics.surveyStarts || 0}
  • Завершено: ${metrics.surveyCompletions || 0}
  • Конверсия: ${metrics.surveyCompletionRate || 0}%

  💎 *Premium:*
  • Конверсий: ${metrics.premiumConversions || 0}
  • Конверсия: ${metrics.premiumConversionRate || 0}%

  ⏰ *Напоминания:*
  • Отправлено: ${metrics.reminderSends || 0}
  • Взаимодействий: ${metrics.reminderInteractions || 0}
  • Engagement: ${metrics.reminderEngagementRate || 0}%

  ${this.getTrendEmoji(metrics)}`;
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

  // 📊 ДЕТАЛЬНАЯ АНАЛИТИКА ПО ОПРОСНИКУ
  async getSurveyAnalytics() {
    return {
      mostCommonGoals: await this.getMostCommonGoals(),
      averageQuestionsCompleted: await this.getAverageQuestionsCompleted(),
      surveyAbandonmentRate: await this.getSurveyAbandonmentRate(),
      popularSupplements: await this.getPopularSupplements()
    };
  }

  // 🎯 САМЫЕ ПОПУЛЯРНЫЕ ЦЕЛИ
  async getMostCommonGoals() {
    return new Promise((resolve) => {
      db.all(
        `SELECT
          json_extract(metadata, '$.goal') as goal,
          COUNT(*) as count
        FROM analytics
        WHERE event_name = 'survey_complete'
        AND json_extract(metadata, '$.goal') IS NOT NULL
        GROUP BY goal
        ORDER BY count DESC
        LIMIT 5`,
        (err, rows) => {
          if (err) {
            logger.error('Ошибка получения целей', { error: err.message });
            resolve([]);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  // 📝 СРЕДНЕЕ КОЛИЧЕСТВО ВОПРОСОВ
  async getAverageQuestionsCompleted() {
    return new Promise((resolve) => {
      db.get(
        `SELECT AVG(json_extract(metadata, '$.answers_count')) as avg_questions
        FROM analytics
        WHERE event_name = 'survey_complete'`,
        (err, row) => {
          resolve(row?.avg_questions ? Math.round(row.avg_questions) : 0);
        }
      );
    });
  }

  // ❌ ПРОЦЕНТ БРОСАЮЩИХ ОПРОС
  async getSurveyAbandonmentRate() {
    return new Promise((resolve) => {
      db.get(
        `SELECT
          (SELECT COUNT(*) FROM analytics WHERE event_name = 'survey_start') as starts,
          (SELECT COUNT(*) FROM analytics WHERE event_name = 'survey_complete') as completes`,
        (err, row) => {
          if (row?.starts > 0) {
            const rate = Math.round((1 - row.completes / row.starts) * 100);
            resolve(rate);
          } else {
            resolve(0);
          }
        }
      );
    });
  }

  // 💊 САМЫЕ ЧАСТО РЕКОМЕНДУЕМЫЕ ДОБАВКИ
  async getPopularSupplements() {
    return new Promise((resolve) => {
      db.all(
        `SELECT
          json_extract(metadata, '$.recommendations_count') as count
        FROM analytics
        WHERE event_name = 'survey_complete'
        ORDER BY count DESC
        LIMIT 10`,
        (err, rows) => {
          if (err) {
            logger.error('Ошибка получения добавок', { error: err.message });
            resolve([]);
          } else {
            // Группируем по количеству рекомендаций
            const distribution = {};
            rows.forEach(row => {
              const count = row.count || 0;
              distribution[count] = (distribution[count] || 0) + 1;
            });
            resolve(distribution);
          }
        }
      );
    });
  }

  // 👤 УДОВЛЕТВОРЕННОСТЬ ПОЛЬЗОВАТЕЛЕЙ (заглушка)
  async getUserSatisfaction() {
    // Пока возвращаем заглушку, можно добавить систему оценок позже
    return {
      estimated_satisfaction: 85, // в процентах
      based_on: 'completion_rate_and_retention'
    };
  }

  async generateDailyReport() {
    try {
      if (!global.botInstance || !global.botInstance.telegram) {
        logger.warn('Бот не готов для отправки отчета');
        return null;
      }

      const metrics = await this.getKeyMetrics(1); // За последние 24 часа

      if (!metrics || Object.keys(metrics).length === 0) {
        logger.warn('Нет данных для ежедневного отчета');
        return null;
      }

      const report = this.formatDailyReport(metrics);

      await this.sendReportToAdmin(report);
      logger.info('Ежедневный отчет сгенерирован и отправлен');
      return report;

    } catch (error) {
      logger.error('Ошибка генерации ежедневного отчета', {
        error: error.message
      });
      return null;
    }
  }

  async trackSettingsUsage(chatId, settingType, oldValue, newValue) {
    await this.trackEvent(chatId, 'settings_updated', {
      setting_type: settingType,
      old_value: oldValue,
      new_value: newValue,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new AnalyticsService();
