const db = require('../config/database');

// Глобальная ссылка на бота
let globalBot = null;

class ReminderService {
  constructor(bot) {
    this.bot = bot;
    this.telegram = bot ? bot.telegram : null;
    this.checkInterval = null;

    // Сохраняем глобальную ссылку
    globalBot = bot;
    console.log('🔧 ReminderService initialized with telegram:', !!this.telegram);
  }

  // Инициализация сервиса
  async initialize() {
    console.log('⏰ Инициализация упрощенного сервиса напоминаний...');
    this.startSimpleReminderChecker();
    return true;
  }

  // Запускаем простой проверщик напоминаний
  startSimpleReminderChecker() {
    // Останавливаем предыдущий интервал если был
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkDueReminders();
    }, 30000); // Проверяем каждые 30 секунд

    console.log('✅ Простой проверщик напоминаний запущен');
  }

  // Проверить due напоминания
  async checkDueReminders() {
    try {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
      const currentDay = now.getDay(); // 0-6 (воскресенье-суббота)

      console.log(`🔍 Проверка напоминаний для времени: ${currentTime}, день: ${currentDay}`);

      const reminders = await this.getDueReminders(currentTime, currentDay);

      if (reminders.length > 0) {
        console.log(`📨 Найдено ${reminders.length} напоминаний для отправки`);

        for (const reminder of reminders) {
          await this.sendReminderNow(reminder);
        }
      }
    } catch (error) {
      console.error('❌ Ошибка проверки напоминаний:', error);
    }
  }

  // Получить напоминания для текущего времени и дня
  async getDueReminders(currentTime, currentDay) {
    return new Promise((resolve) => {
      // Конвертируем день недели в формат базы (1-7, где 1=понедельник)
      const dbDayIndex = currentDay === 0 ? 7 : currentDay; // Воскресенье = 7

      db.all(
        `SELECT * FROM reminders
         WHERE time = ?
         AND substr(days, ?, 1) = '1'
         AND is_active = true`,
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
        return;
      }

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Принял', callback_data: `intake_taken_${reminder.id}` },
              { text: '⏰ Через 5 мин', callback_data: `intake_later_${reminder.id}` },
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

      console.log(`✅ Отправлено напоминание пользователю ${reminder.chat_id}: ${reminder.supplement_name}`);

    } catch (error) {
      console.error('❌ Ошибка отправки напоминания:', error);

      // Если пользователь заблокировал бота, деактивируем напоминание
      if (error.response && error.response.error_code === 403) {
        console.log(`🚫 Пользователь ${reminder.chat_id} заблокировал бота, деактивируем напоминания`);
        this.deactivateUserReminders(reminder.chat_id);
      }
    }
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
