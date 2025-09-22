const db = require('../config/database');
const cron = require('node-cron');

// Глобальная ссылка на бота
let globalBot = null;

class ReminderService {
  constructor(bot) {
    this.bot = bot;
    this.telegram = bot ? bot.telegram : null;
    this.scheduledJobs = new Map();

    // Сохраняем глобальную ссылку
    globalBot = bot;

    console.log('🔧 ReminderService initialized with telegram:', !!this.telegram);
  }

  // Инициализация сервиса
  async initialize() {
    console.log('⏰ Инициализация сервиса напоминаний...');
    // await this.loadAllReminders();
    this.startReminderChecker(); // Запускаем альтернативную проверку
  }

  // Загрузить все активные напоминания
  async loadAllReminders() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT r.*, COALESCE(u.timezone, 'Europe/Moscow') as timezone
         FROM reminders r
         LEFT JOIN notification_settings u ON r.chat_id = u.chat_id
         WHERE r.is_active = true`,
        (err, reminders) => {
          if (err) {
            console.error('❌ Ошибка загрузки напоминаний:', err);
            reject(err);
          } else {
            reminders.forEach(reminder => this.scheduleReminder(reminder));
            console.log(`✅ Загружено ${reminders.length} напоминаний`);
            resolve(reminders);
          }
        }
      );
    });
  }

  // Создать напоминание
  async createReminder(chatId, reminderData) {
    return new Promise((resolve, reject) => {
      const self = this;

      db.run(
        `INSERT INTO reminders (chat_id, supplement_name, dosage, time, days)
         VALUES (?, ?, ?, ?, ?)`,
        [chatId, reminderData.supplement_name, reminderData.dosage, reminderData.time, reminderData.days || '1111111'],
        function(err) {
          if (err) return reject(err);

          const reminderId = this.lastID;
          // Загружаем созданное напоминание и планируем его
          db.get('SELECT * FROM reminders WHERE id = ?', [reminderId], (err, reminder) => {
            if (err) return reject(err);

            if (reminder) {
              // Добавляем временную зону по умолчанию
              reminder.timezone = 'Europe/Moscow';
              self.scheduleReminder(reminder);
            }
            resolve(reminderId);
          });
        }
      );
    });
  }

  // Запланировать напоминание (cron)
  scheduleReminder(reminder) {
    try {
      const jobId = `reminder_${reminder.id}`;

      // Останавливаем существующее задание если есть
      if (this.scheduledJobs.has(jobId)) {
        this.scheduledJobs.get(jobId).stop();
      }

      // Парсим время (формат: "08:00")
      const [hours, minutes] = reminder.time.split(':').map(Number);

      if (isNaN(hours) || isNaN(minutes)) {
        console.error('❌ Неверный формат времени:', reminder.time);
        return;
      }

      // Создаем cron задание
      const job = cron.schedule(`${minutes} ${hours} * * *`, async () => {
        try {
          // Используем глобальную ссылку на бота
          const telegram = globalBot ? globalBot.telegram : null;

          if (!telegram) {
            console.error('❌ Telegram client не доступен (глобально)');
            return;
          }

          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Принял', callback_data: `intake_taken_${reminder.id}` },
                  { text: '⏰ Напомнить позже', callback_data: `intake_later_${reminder.id}` },
                  { text: '❌ Пропустить', callback_data: `intake_skipped_${reminder.id}` }
                ]
              ]
            }
          };

          await telegram.sendMessage(
            reminder.chat_id,
            `⏰ *Время приема!*\n\n💊 ${reminder.supplement_name}\n📏 ${reminder.dosage}\n\nПодтвердите прием:`,
            { parse_mode: 'Markdown', ...keyboard }
          );

          console.log(`📨 Отправлено напоминание пользователю ${reminder.chat_id}`);

        } catch (error) {
          console.error('❌ Ошибка отправки напоминания:', error);
          // Если пользователь заблокировал бота, деактивируем напоминание
          if (error.response && error.response.error_code === 403) {
            this.deactivateReminder(reminder.id);
          }
        }
      }, {
        timezone: reminder.timezone || 'Europe/Moscow'
      });

      this.scheduledJobs.set(jobId, job);
      console.log(`⏰ Напоминание запланировано: ${reminder.supplement_name} в ${reminder.time}`);

    } catch (error) {
      console.error('❌ Ошибка планирования напоминания:', error);
    }
  }

  // Альтернативный метод: проверка напоминаний каждые 30 секунд
  startReminderChecker() {
    setInterval(() => {
      this.checkDueReminders();
    }, 30000); // Проверяем каждые 30 секунд

    console.log('⏰ Запущен альтернативный проверщик напоминаний');
  }

  // Проверить due напоминания
  async checkDueReminders() {
    try {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

      const reminders = await this.getDueReminders(currentTime);

      if (reminders.length > 0) {
        console.log(`🔍 Найдено ${reminders.length} напоминаний для времени ${currentTime}`);

        for (const reminder of reminders) {
          await this.sendReminderNow(reminder);
        }
      }
    } catch (error) {
      console.error('❌ Ошибка проверки напоминаний:', error);
    }
  }

  // Получить напоминания для текущего времени
  async getDueReminders(currentTime) {
    return new Promise((resolve) => {
      db.all(
        'SELECT * FROM reminders WHERE time = ? AND is_active = true',
        [currentTime],
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
        return;
      }

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Принял', callback_data: `intake_taken_${reminder.id}` },
              { text: '⏰ Напомнить позже', callback_data: `intake_later_${reminder.id}` },
              { text: '❌ Пропустить', callback_data: `intake_skipped_${reminder.id}` }
            ]
          ]
        }
      };

      await telegram.sendMessage(
        reminder.chat_id,
        `⏰ *Время приема!*\n\n💊 ${reminder.supplement_name}\n📏 ${reminder.dosage}\n\nПодтвердите прием:`,
        { parse_mode: 'Markdown', ...keyboard }
      );

      console.log(`📨 Отправлено напоминание пользователю ${reminder.chat_id}`);

    } catch (error) {
      console.error('❌ Ошибка отправки напоминания:', error);
      // Если пользователь заблокировал бота, деактивируем напоминание
      if (error.response && error.response.error_code === 403) {
        this.deactivateReminder(reminder.id);
      }
    }
  }

  // Деактивировать напоминание
  async deactivateReminder(reminderId) {
    return new Promise((resolve) => {
      db.run('UPDATE reminders SET is_active = false WHERE id = ?', [reminderId], (err) => {
        if (err) {
          console.error('❌ Ошибка деактивации напоминания:', err);
        }

        const jobId = `reminder_${reminderId}`;
        if (this.scheduledJobs.has(jobId)) {
          this.scheduledJobs.get(jobId).stop();
          this.scheduledJobs.delete(jobId);
        }
        resolve();
      });
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

  // Получить напоминания пользователя
  async getUserReminders(chatId) {
    return new Promise((resolve) => {
      db.all(
        'SELECT * FROM reminders WHERE chat_id = ? ORDER BY time',
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

  // Удалить все напоминания пользователя
  async clearUserReminders(chatId) {
    return new Promise((resolve) => {
      // Останавливаем все jobs для этого пользователя
      for (const [jobId, job] of this.scheduledJobs.entries()) {
        if (jobId.includes(`reminder_`)) {
          job.stop();
        }
      }

      // Удаляем из базы
      db.run('DELETE FROM reminders WHERE chat_id = ?', [chatId], (err) => {
        if (err) {
          console.error('❌ Ошибка очистки напоминаний:', err);
        }
        resolve();
      });
    });
  }

  // Получить статистику за период
  async getIntakeStatsByPeriod(chatId, startDate, endDate) {
    return new Promise((resolve) => {
      db.all(
        `SELECT * FROM intake_history
        WHERE chat_id = ? AND taken_at BETWEEN ? AND ?
        ORDER BY taken_at DESC`,
        [chatId, startDate.toISOString(), endDate.toISOString()],
        (err, history) => {
          if (err) {
            console.error('❌ Ошибка получения статистики:', err);
            resolve({ taken: 0, skipped: 0, total: 0, compliance: 0 });
          } else {
            const stats = {
              total: history.length,
              taken: history.filter(item => item.status === 'taken').length,
              skipped: history.filter(item => item.status === 'skipped').length,
              compliance: 0
            };

            if (stats.total > 0) {
              stats.compliance = Math.round((stats.taken / stats.total) * 100);
            }

            resolve(stats);
          }
        }
      );
    });
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
}

module.exports = ReminderService;
