const db = require('../config/database');
const cron = require('node-cron');
const { Telegraf } = require('telegraf');

class ReminderService {
  constructor(bot) {
    this.bot = bot;
    this.scheduledJobs = new Map();
  }

  // Инициализация сервиса
  async initialize() {
    console.log('⏰ Инициализация сервиса напоминаний...');
    await this.loadAllReminders();
  }

  // Загрузить все активные напоминания
  async loadAllReminders() {
    return new Promise((resolve) => {
      db.all(
        `SELECT r.*, u.timezone
         FROM reminders r
         LEFT JOIN notification_settings u ON r.chat_id = u.chat_id
         WHERE r.is_active = true AND u.allow_notifications = true`,
        (err, reminders) => {
          if (err) {
            console.error('❌ Ошибка загрузки напоминаний:', err);
            resolve([]);
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
      db.run(
        `INSERT INTO reminders (chat_id, supplement_name, dosage, time, days)
         VALUES (?, ?, ?, ?, ?)`,
        [chatId, reminderData.supplement_name, reminderData.dosage, reminderData.time, reminderData.days],
        function(err) {
          if (err) return reject(err);

          const reminderId = this.lastID;
          // Загружаем созданное напоминание и планируем его
          db.get('SELECT * FROM reminders WHERE id = ?', [reminderId], (err, reminder) => {
            if (!err && reminder) {
              this.scheduleReminder(reminder);
            }
            resolve(reminderId);
          });
        }
      );
    });
  }

  // Запланировать напоминание
  scheduleReminder(reminder) {
    const jobId = `reminder_${reminder.id}`;

    // Останавливаем существующее задание если есть
    if (this.scheduledJobs.has(jobId)) {
      this.scheduledJobs.get(jobId).stop();
    }

    // Парсим время (формат: "08:00")
    const [hours, minutes] = reminder.time.split(':').map(Number);

    // Создаем cron задание (каждый день в указанное время)
    const job = cron.schedule(`${minutes} ${hours} * * *`, () => {
      this.sendReminder(reminder);
    }, {
      timezone: reminder.timezone || 'Europe/Moscow'
    });

    this.scheduledJobs.set(jobId, job);
    console.log(`⏰ Напоминание запланировано: ${reminder.supplement_name} в ${reminder.time}`);
  }

  // Отправить напоминание
  async sendReminder(reminder) {
    try {
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

      await this.bot.telegram.sendMessage(
        reminder.chat_id,
        `⏰ *Время приема!*\n\n💊 ${reminder.supplement_name}\n📏 ${reminder.dosage}\n\nПодтвердите прием:`,
        { parse_mode: 'Markdown', ...keyboard }
      );

      // Записываем в историю как "ожидание подтверждения"
      await this.recordIntake(reminder.chat_id, {
        supplement_name: reminder.supplement_name,
        dosage: reminder.dosage,
        status: 'pending'
      });

    } catch (error) {
      console.error('❌ Ошибка отправки напоминания:', error);
    }
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
         WHERE chat_id = ? AND taken_at >= ?
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
}

module.exports = ReminderService;
