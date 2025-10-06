
const db = require('../config/database');
const logger = require('../utils/logger');
const analyticsService = require('./analyticsService');
const TimeHelper = require('../utils/timeHelper');

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

            const normalizedRow = { ...row };
            if (normalizedRow.morning_time) {
              normalizedRow.morning_time = TimeHelper.normalizeTime(normalizedRow.morning_time);
            }
            if (normalizedRow.afternoon_time) {
              normalizedRow.afternoon_time = TimeHelper.normalizeTime(normalizedRow.afternoon_time);
            }
            if (normalizedRow.evening_time) {
              normalizedRow.evening_time = TimeHelper.normalizeTime(normalizedRow.evening_time);
            }
            resolve(normalizedRow);
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

        // Если это поле времени - нормализуем
        if (key.includes('_time')) {
          updateValues.push(TimeHelper.normalizeTime(updates[key]));
        } else {
          updateValues.push(updates[key]);
        }
      }
    });

    if (updateFields.length === 0) {
      throw new Error('Нет полей для обновления');
    }

    updateValues.push(chatId);

    return new Promise((resolve, reject) => {
      // Пробуем без updated_at (как у вас работает)
      const sqlWithoutUpdated = `UPDATE notification_settings
                                SET ${updateFields.join(', ')}
                                WHERE chat_id = ?`;

      db.run(sqlWithoutUpdated, updateValues, async (err2) => {
        if (err2) {
          console.error('❌ Ошибка обновления настроек:', err2);
          reject(err2);
        } else {
          console.log('✅ Настройки обновлены (без updated_at)');

          let remindersUpdatedCount = 0;

          try {
          // Для каждого измененного времени обновляем напоминания
            for (const [key, value] of Object.entries(updates)) {
              if (key.includes('_time') && oldSettings[key] !== value) {
                const period = key.replace('_time', '');
                const oldTime = TimeHelper.normalizeTime(oldSettings[key]);
                const newTime = TimeHelper.normalizeTime(value);

                if (oldTime !== newTime) {
                  const updated = await this.updateRemindersForPeriod(chatId, period, oldTime, newTime);
                  remindersUpdatedCount += updated;

                  // Трекаем изменения
                  await analyticsService.trackSettingsUsage(chatId, key, oldTime, newTime);
                }
              }
            }
          } catch (trackError) {
            console.error('❌ Ошибка синхронизации напоминаний:', trackError);
          }

          resolve({
            settingsUpdated: this.changes,
            remindersUpdated: remindersUpdatedCount
          });

        }
      });
    });
  }

  // Синхронизация напоминаний с новым временем
  async syncRemindersWithNewTime(chatId, updates, oldSettings) {
    try {
      const reminderService = require('./reminderService');
      const service = new reminderService(); // Без бота, только для БД операций

      let updatedReminders = 0;

      // Для каждого измененного периода времени
      for (const [timeType, newTime] of Object.entries(updates)) {
        if (!timeType.includes('_time')) continue;

        const period = timeType.replace('_time', '');
        const oldTime = oldSettings[timeType];

        if (oldTime !== newTime) {
          console.log(`🔄 Синхронизируем напоминания для ${period}: ${oldTime} → ${newTime}`);

          const updated = await this.updateRemindersForPeriod(chatId, period, oldTime, newTime);
          updatedReminders += updated;
        }
      }

      if (updatedReminders > 0) {
        console.log(`✅ Синхронизировано ${updatedReminders} напоминаний`);
      }

      return updatedReminders;
    } catch (error) {
      console.error('❌ Ошибка синхронизации напоминаний:', error);
      return 0;
    }
  }

  // Обновляем напоминания для конкретного периода
  async updateRemindersForPeriod(chatId, period, oldTime, newTime) {
    return new Promise((resolve) => {
      const db = require('../config/database');

      // Определяем временной диапазон для периода
      const timeRanges = {
        morning: { start: '06:00', end: '11:00' },
        afternoon: { start: '12:00', end: '17:00' },
        evening: { start: '18:00', end: '22:00' }
      };

      const range = timeRanges[period];
      if (!range) {
        resolve(0);
        return;
      }

      // Обновляем напоминания в этом диапазоне
      db.run(
        `UPDATE reminders
        SET time = ?
        WHERE chat_id = ?
        AND time BETWEEN ? AND ?
        AND time != ?`, // Не обновляем если уже новое время
        [newTime, chatId, range.start, range.end, newTime],
        function(err) {
          if (err) {
            console.error('❌ Ошибка обновления напоминаний:', err);
            resolve(0);
          } else {
            console.log(`✅ Обновлено ${this.changes} напоминаний для периода ${period}`);
            resolve(this.changes);
          }
        }
      );
    });
  }

  // Выносим трекинг в отдельную функцию
  async trackSettingsChanges(chatId, updates, oldSettings) {
    try {
      if (typeof analyticsService.trackSettingsUsage === 'function') {
        for (const [key, value] of Object.entries(updates)) {
          const normalizedValue = key.includes('_time') ? TimeHelper.normalizeTime(value) : value;
          const normalizedOldValue = key.includes('_time') ? TimeHelper.normalizeTime(oldSettings[key]) : oldSettings[key];

          if (normalizedOldValue !== normalizedValue) {
            await analyticsService.trackSettingsUsage(chatId, key, normalizedOldValue, normalizedValue);
          }
        }
        console.log('✅ Трекинг настроек выполнен');
      }
    } catch (trackError) {
      console.error('❌ Ошибка трекинга настроек:', trackError);
    }
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
    if (!TimeHelper.isValidTime(timeString)) {
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
