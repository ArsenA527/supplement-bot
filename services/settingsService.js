
const db = require('../config/database');
const logger = require('../utils/logger');

class SettingsService {

  // Получить настройки пользователя
  async getUserSettings(chatId) {
    return new Promise((resolve) => {
      db.get(
        `SELECT * FROM notification_settings WHERE chat_id = ?`,
        [chatId],
        (err, row) => {
          if (err || !row) {
            // Создаем настройки по умолчанию
            this.createDefaultSettings(chatId).then(resolve);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  // Создать настройки по умолчанию
  async createDefaultSettings(chatId) {
    const defaultSettings = {
      chat_id: chatId,
      morning_time: '08:00',
      afternoon_time: '13:00',
      evening_time: '20:00',
      allow_notifications: true,
      timezone: 'Europe/Moscow',
      created_at: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO notification_settings
         (chat_id, morning_time, afternoon_time, evening_time, allow_notifications, timezone)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          chatId,
          defaultSettings.morning_time,
          defaultSettings.afternoon_time,
          defaultSettings.evening_time,
          defaultSettings.allow_notifications ? 1 : 0,
          defaultSettings.timezone
        ],
        function(err) {
          if (err) {
            logger.error('Ошибка создания настроек', { chatId, error: err.message });
            reject(err);
          } else {
            logger.info('Настройки по умолчанию созданы', { chatId });
            resolve(defaultSettings);
          }
        }
      );
    });
  }

  // Обновить настройки уведомлений
  async updateNotificationSettings(chatId, updates) {
    const oldSettings = await this.getUserSettings(chatId);

    const allowedFields = ['morning_time', 'afternoon_time', 'evening_time', 'allow_notifications', 'timezone'];
    const updateFields = [];
    const updateValues = [];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        updateValues.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('Нет полей для обновления');
    }

    updateValues.push(chatId);

    // Трекаем изменения
    for (const [key, value] of Object.entries(updates)) {
      if (oldSettings[key] !== value) {
        await analyticsService.trackSettingsUsage(chatId, key, oldSettings[key], value);
      }
    }

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE notification_settings
         SET ${updateFields.join(', ')}, updated_at = datetime('now')
         WHERE chat_id = ?`,
        updateValues,
        function(err) {
          if (err) {
            logger.error('Ошибка обновления настроек', { chatId, updates, error: err.message });
            reject(err);
          } else {
            logger.info('Настройки обновлены', { chatId, updates });
            resolve(this.changes);
          }
        }
      );
    });


  }

  // Переключить уведомления
  async toggleNotifications(chatId) {
    const currentSettings = await this.getUserSettings(chatId);
    const newStatus = !currentSettings.allow_notifications;

    await this.updateNotificationSettings(chatId, {
      allow_notifications: newStatus
    });

    return newStatus;
  }

  // Валидация времени
  validateTime(timeString) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(timeString)) {
      throw new Error('Неверный формат времени. Используйте HH:MM (например, 08:30)');
    }
    return true;
  }

  // Получить доступные временные слоты
  getAvailableTimeSlots() {
    return [
      '06:00', '07:00', '08:00', '09:00', '10:00',
      '11:00', '12:00', '13:00', '14:00', '15:00',
      '16:00', '17:00', '18:00', '19:00', '20:00',
      '21:00', '22:00'
    ];
  }

  // Очистить данные пользователя
  async clearUserData(chatId) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('DELETE FROM reminders WHERE chat_id = ?', [chatId]);
        db.run('DELETE FROM intake_history WHERE chat_id = ?', [chatId]);
        db.run('DELETE FROM user_goals WHERE chat_id = ?', [chatId]);
        db.run('DELETE FROM achievements WHERE chat_id = ?', [chatId]);
        db.run('DELETE FROM ai_consultations WHERE chat_id = ?', [chatId]);
        db.run('UPDATE users SET state = NULL, answers = NULL WHERE chat_id = ?', [chatId]);

        db.run('DELETE FROM analytics WHERE chat_id = ?', [chatId], (err) => {
          if (err) {
            logger.error('Ошибка очистки данных', { chatId, error: err.message });
            reject(err);
          } else {
            logger.info('Данные пользователя очищены', { chatId });
            resolve(true);
          }
        });
      });
    });
  }

  // Экспорт данных пользователя
  async exportUserData(chatId) {
    const userData = {};

    // Собираем все данные пользователя
    const promises = [
      this.getUserProfile(chatId),
      this.getUserReminders(chatId),
      this.getUserHistory(chatId),
      this.getUserGoals(chatId)
    ];

    const [profile, reminders, history, goals] = await Promise.all(promises);

    return {
      profile,
      reminders,
      history: history.slice(0, 100), // Ограничиваем историю
      goals,
      export_date: new Date().toISOString()
    };
  }

  async getUserProfile(chatId) {
    return new Promise((resolve) => {
      db.get('SELECT * FROM users WHERE chat_id = ?', [chatId], (err, row) => {
        resolve(row || {});
      });
    });
  }

  async getUserReminders(chatId) {
    return new Promise((resolve) => {
      db.all('SELECT * FROM reminders WHERE chat_id = ?', [chatId], (err, rows) => {
        resolve(rows || []);
      });
    });
  }

  async getUserHistory(chatId) {
    return new Promise((resolve) => {
      db.all(
        'SELECT * FROM intake_history WHERE chat_id = ? ORDER BY taken_at DESC LIMIT 200',
        [chatId],
        (err, rows) => {
          resolve(rows || []);
        }
      );
    });
  }

  async getUserGoals(chatId) {
    return new Promise((resolve) => {
      db.get('SELECT * FROM user_goals WHERE chat_id = ?', [chatId], (err, row) => {
        resolve(row || {});
      });
    });
  }
}

module.exports = new SettingsService();
