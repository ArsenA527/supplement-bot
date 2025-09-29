const db = require('../config/database');

// Глобальная ссылка на бота
let globalBot = null;

class ReminderService {
  constructor(bot) {
    this.bot = bot;
    this.telegram = bot ? bot.telegram : null;
    this.checkInterval = null;
    this.lastCheckTime = null;
    global.reminderBot = bot;
    console.log('🔧 ReminderService initialized with bot:', !!bot);
    console.log('🔧 Telegram client available:', !!this.telegram);
  }

  // Инициализация сервиса
  async initialize() {
    console.log('⏰ Инициализация упрощенного сервиса напоминаний...');

    // Проверяем доступность Telegram client
    if (!this.telegram) {
      console.error('❌ Telegram client не доступен при инициализации!');
      return false;
    }

    await this.startEnhancedReminderChecker();
    console.log('✅ Сервис напоминаний успешно инициализирован');
    return true;
  }

  // Запускаем улучшенный проверщик напоминаний
  async startEnhancedReminderChecker() {
    // Останавливаем предыдущий интервал если был
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Проверяем напоминания сразу при старте
    console.log('🔍 Первоначальная проверка напоминаний...');
    await this.checkDueReminders();

    // Затем каждые 30 секунд
    this.checkInterval = setInterval(async () => {
      await this.checkDueReminders();
    }, 30000); // Проверяем каждые 30 секунд

    console.log('✅ Улучшенный проверщик напоминаний запущен');
  }

  // Проверить due напоминания
  async checkDueReminders() {
    try {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
      const currentDay = now.getDay(); // 0-6 (воскресенье-суббота)

      // Логируем только если время изменилось
      if (!this.lastCheckTime || this.lastCheckTime !== currentTime) {
        console.log(`🔍 Проверка напоминаний для: ${currentTime}, день: ${currentDay}`);
        this.lastCheckTime = currentTime;
      }

      const reminders = await this.getDueReminders(currentTime, currentDay);

      if (reminders.length > 0) {
        console.log(`📨 Найдено ${reminders.length} напоминаний для отправки`);

        let sentCount = 0;
        for (const reminder of reminders) {
          const sent = await this.sendReminderNow(reminder);
          if (sent) sentCount++;
        }

        console.log(`✅ Отправлено ${sentCount} из ${reminders.length} напоминаний`);
      }
    } catch (error) {
      console.error('❌ Ошибка проверки напоминаний:', error);
    }
  }

  // Получить напоминания для текущего времени и дня
  async getDueReminders(currentTime, currentDay) {
    return new Promise((resolve) => {
      // Конвертируем день недели в формат базы (1-7, где 1=понедельник)
      const dbDayIndex = currentDay === 0 ? 7 : currentDay;

      // Ищем напоминания с точным временем И которые активны
      db.all(
        `SELECT r.*
         FROM reminders r
         WHERE r.time = ?
         AND substr(r.days, ?, 1) = '1'
         AND r.is_active = true
         AND NOT EXISTS (
           SELECT 1 FROM intake_history ih
           WHERE ih.chat_id = r.chat_id
           AND ih.supplement_name = r.supplement_name
           AND DATE(ih.taken_at) = DATE('now')
           AND ih.status = 'taken'
         )`, // Не показываем если уже приняли сегодня
        [currentTime, dbDayIndex],
        (err, reminders) => {
          if (err) {
            console.error('❌ Ошибка получения due напоминаний:', err);
            resolve([]);
          } else {
            resolve(reminders || []);
          }
        }
      );
    });
  }

  // Отправить напоминание сразу
  async sendReminderNow(reminder) {
    try {
      const telegram = globalBot ? globalBot.telegram : this.telegram;

      if (!telegram) {
        console.error('❌ Telegram client не доступен');
        return false;
      }

      // Проверяем не отправляли ли уже напоминание сегодня
      const alreadySent = await this.checkIfReminderSentToday(reminder);
      if (alreadySent) {
        console.log(`⚠️ Напоминание уже отправлено сегодня: ${reminder.supplement_name}`);
        return false;
      }

      const { getReminderActionsKeyboard } = require('../keyboards');
      const keyboard = getReminderActionsKeyboard(reminder.id);

      await telegram.sendMessage(
        reminder.chat_id,
        `⏰ *Время приема!*\n\n💊 ${reminder.supplement_name}\n📏 ${reminder.dosage}\n\nПодтвердите прием:`,
        { parse_mode: 'Markdown', ...keyboard }
      );

      console.log(`✅ Отправлено напоминание пользователю ${reminder.chat_id}: ${reminder.supplement_name}`);

      // Помечаем как отправленное сегодня
      await this.markReminderSent(reminder);
      return true;

    } catch (error) {
      console.error('❌ Ошибка отправки напоминания:', error);

      // Если пользователь заблокировал бота, деактивируем напоминание
      if (error.response && error.response.error_code === 403) {
        console.log(`🚫 Пользователь ${reminder.chat_id} заблокировал бота, деактивируем напоминания`);
        await this.deactivateUserReminders(reminder.chat_id);
      }
      return false;
    }
  }

  // Проверить отправляли ли напоминание сегодня
  async checkIfReminderSentToday(reminder) {
    return new Promise((resolve) => {
      db.get(
        `SELECT 1 FROM intake_history
         WHERE chat_id = ? AND supplement_name = ?
         AND DATE(taken_at) = DATE('now')
         AND status IN ('taken', 'skipped')`,
        [reminder.chat_id, reminder.supplement_name],
        (err, row) => {
          resolve(!!row);
        }
      );
    });
  }

  // Пометить напоминание как отправленное
  async markReminderSent(reminder) {
    return new Promise((resolve) => {
      db.run(
        `INSERT INTO intake_history (chat_id, supplement_name, dosage, status, taken_at)
         VALUES (?, ?, ?, 'pending', datetime('now'))`,
        [reminder.chat_id, reminder.supplement_name, reminder.dosage],
        (err) => {
          if (err) console.error('❌ Ошибка отметки напоминания:', err);
          resolve();
        }
      );
    });
  }

    // Создать тестовое напоминание
  async createTestReminder(chatId, supplementName, dosage, time, days = '1111111') {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO reminders (chat_id, supplement_name, dosage, time, days)
         VALUES (?, ?, ?, ?, ?)`,
        [chatId, supplementName, dosage, time, days],
        function(err) {
          if (err) {
            reject(err);
          } else {
            console.log(`✅ Тестовое напоминание создано: ${supplementName} в ${time}`);

            // Возвращаем данные созданного напоминания
            db.get('SELECT * FROM reminders WHERE id = ?', [this.lastID], (err, reminder) => {
              if (err) reject(err);
              else resolve(reminder);
            });
          }
        }
      );
    });
  }

  // Деактивировать все напоминания пользователя
  async deactivateUserReminders(chatId) {
    return new Promise((resolve) => {
      db.run('UPDATE reminders SET is_active = false WHERE chat_id = ?', [chatId], (err) => {
        if (err) {
          console.error('❌ Ошибка деактивации напоминаний:', err);
        } else {
          console.log(`✅ Напоминания пользователя ${chatId} деактивированы`);
        }
        resolve();
      });
    });
  }

  // Создать напоминание
  async createReminder(chatId, reminderData) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO reminders (chat_id, supplement_name, dosage, time, days)
         VALUES (?, ?, ?, ?, ?)`,
        [chatId, reminderData.supplement_name, reminderData.dosage, reminderData.time, reminderData.days || '1111111'],
        function(err) {
          if (err) {
            reject(err);
          } else {
            console.log(`✅ Создано напоминание: ${reminderData.supplement_name} в ${reminderData.time}`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // Получить напоминания пользователя
  async getUserReminders(chatId) {
    return new Promise((resolve) => {
      db.all(
        'SELECT * FROM reminders WHERE chat_id = ? AND is_active = true ORDER BY time',
        [chatId],
        (err, reminders) => {
          if (err) {
            console.error('❌ Ошибка получения напоминаний:', err);
            resolve([]);
          } else {
            resolve(reminders);
          }
        }
      );
    });
  }

    // Удалить тестовые напоминания
  async clearTestReminders(chatId) {
    return new Promise((resolve) => {
      db.run(
        'DELETE FROM reminders WHERE chat_id = ? AND supplement_name LIKE "Тест:%"',
        [chatId],
        (err) => {
          if (err) {
            console.error('❌ Ошибка удаления тестовых напоминаний:', err);
          } else {
            console.log(`✅ Тестовые напоминания пользователя ${chatId} очищены`);
          }
          resolve();
        }
      );
    });
  }

  // Получить историю приема
  async getIntakeHistory(chatId, days = 7) {
    return new Promise((resolve) => {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);

      db.all(
        `SELECT * FROM intake_history
        WHERE chat_id = ? AND datetime(taken_at) >= datetime(?)
        ORDER BY taken_at DESC`,
        [chatId, sinceDate.toISOString()],
        (err, history) => {
          if (err) {
            console.error('❌ Ошибка получения истории:', err);
            resolve([]);
          } else {
            resolve(history);
          }
        }
      );
    });
  }

  // Получить статистику приема
  async getIntakeStats(chatId, days = 30) {
    const history = await this.getIntakeHistory(chatId, days);

    const stats = {
      total: history.length,
      taken: history.filter(item => item.status === 'taken').length,
      skipped: history.filter(item => item.status === 'skipped').length,
      missed: history.filter(item => item.status === 'missed').length,
      compliance: 0
    };

    if (stats.total > 0) {
      stats.compliance = Math.round((stats.taken / stats.total) * 100);
    }

    return stats;
  }

  // Получить самые частые пропуски
  async getMostSkippedSupplements(chatId, days = 30) {
    return new Promise((resolve) => {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);

      db.all(
        `SELECT supplement_name, COUNT(*) as skip_count
        FROM intake_history
        WHERE chat_id = ? AND status = 'skipped' AND taken_at >= ?
        GROUP BY supplement_name
        ORDER BY skip_count DESC
        LIMIT 5`,
        [chatId, sinceDate.toISOString()],
        (err, results) => {
          if (err) {
            console.error('❌ Ошибка получения статистики пропусков:', err);
            resolve([]);
          } else {
            resolve(results);
          }
        }
      );
    });
  }

  // Записать прием добавки
  async recordIntake(chatId, intakeData) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO intake_history (chat_id, supplement_name, dosage, status)
         VALUES (?, ?, ?, ?)`,
        [chatId, intakeData.supplement_name, intakeData.dosage, intakeData.status || 'taken'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  // Очистить напоминания пользователя
  async clearUserReminders(chatId) {
    return new Promise((resolve) => {
      db.run('DELETE FROM reminders WHERE chat_id = ?', [chatId], (err) => {
        if (err) {
          console.error('❌ Ошибка очистки напоминаний:', err);
        } else {
          console.log(`✅ Напоминания пользователя ${chatId} очищены`);
        }
        resolve();
      });
    });
  }

  // Остановить сервис
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      console.log('✅ Сервис напоминаний остановлен');
    }
  }
}

module.exports = ReminderService;
