const db = require('../config/database');
const TimeHelper = require('../utils/timeHelper');

class ReminderService {
  constructor(bot) {
    // Защита от множественной инициализации
    if (global.reminderServiceInstance) {
      console.log('⚠️ ReminderService уже инициализирован, возвращаем существующий экземпляр');
      return global.reminderServiceInstance;
    }

    this.bot = bot;
    this.telegram = bot ? bot.telegram : null;
    this.checkInterval = null;
    this.lastCheckTime = null;
    this.isInitialized = false;

    // Сохраняем экземпляр глобально
    global.reminderServiceInstance = this;

    console.log('🔧 ReminderService initialized with bot:', !!bot);
    console.log('🔧 Telegram client available:', !!this.telegram);
  }

  // Инициализация сервиса
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ ReminderService уже инициализирован');
      return true;
    }

    console.log('⏰ Инициализация упрощенного сервиса напоминаний...');

    // Проверяем доступность Telegram client
    if (!this.telegram) {
      console.error('❌ Telegram client не доступен при инициализации!');
      return false;
    }

    // Останавливаем предыдущий интервал если был
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    await this.startEnhancedReminderChecker();
    this.isInitialized = true;

    console.log('✅ Сервис напоминаний успешно инициализирован');
    return true;
  }

  // Запускаем улучшенный проверщик напоминаний
  async startEnhancedReminderChecker() {
    console.log('🔍 Запуск проверщика напоминаний...');

    // Проверяем напоминания сразу при старте
    await this.checkDueReminders();

    // Затем каждые 30 секунд с защитой от наложения
    this.checkInterval = setInterval(async () => {
      // Проверяем что предыдущая проверка завершилась
      if (!this.checkInProgress) {
        this.checkInProgress = true;
        try {
          await this.checkDueReminders();
        } catch (error) {
          console.error('❌ Ошибка в проверке напоминаний:', error);
        } finally {
          this.checkInProgress = false;
        }
      } else {
        console.log('⚠️ Проверка напоминаний уже выполняется, пропускаем...');
      }
    }, 30000); // 30 секунд

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
    const normalizedCurrentTime = TimeHelper.normalizeTime(currentTime);

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
        [normalizedCurrentTime, dbDayIndex],
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
      // 🔒 ЗАЩИТА ОТ ДУБЛИРОВАНИЯ - проверяем не отправляли ли уже это напоминание
      const reminderKey = `sent_${reminder.chat_id}_${reminder.supplement_name}_${reminder.time}`;

      if (global.sentReminders && global.sentReminders[reminderKey]) {
        console.log(`⚠️ Напоминание уже отправлено: ${reminder.supplement_name} для ${reminder.chat_id}`);
        return false;
      }

      // Помечаем как отправленное
      if (!global.sentReminders) global.sentReminders = {};
      global.sentReminders[reminderKey] = Date.now();

      // Очищаем через 5 минут (на случай если бот перезапустится)
      setTimeout(() => {
        if (global.sentReminders && global.sentReminders[reminderKey]) {
          delete global.sentReminders[reminderKey];
        }
      }, 5 * 60 * 1000);

      // Проверяем разрешены ли уведомления
      const canSend = await this.canSendNotification(reminder.chat_id);
      if (!canSend) {
        console.log(`🔕 Уведомления отключены для пользователя ${reminder.chat_id}`);
        return false;
      }

      // Проверяем не отправляли ли уже напоминание сегодня
      const alreadySent = await this.checkIfReminderSentToday(reminder);
      if (alreadySent) {
        console.log(`⚠️ Напоминание уже отправлено сегодня: ${reminder.supplement_name}`);
        return false;
      }

      const telegram = global.reminderBot ? global.reminderBot.telegram : this.telegram;

      if (!telegram) {
        console.error('❌ Telegram client не доступен');
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
    const normalizedTime = TimeHelper.normalizeTime(reminderData.time);

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO reminders (chat_id, supplement_name, dosage, time, days)
         VALUES (?, ?, ?, ?, ?)`,
        [chatId, reminderData.supplement_name, reminderData.dosage, normalizedTime, reminderData.days || '1111111'],
        function(err) {
          if (err) {
            reject(err);
          } else {
            console.log(`✅ Создано напоминание: ${reminderData.supplement_name} в ${normalizedTime}`);
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
    console.log('🛑 Остановка сервиса напоминаний...');

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('✅ Интервал проверки остановлен');
    }

    this.isInitialized = false;

    // Очищаем глобальный экземпляр
    if (global.reminderServiceInstance === this) {
      global.reminderServiceInstance = null;
    }

    console.log('✅ Сервис напоминаний остановлен');
  }

  // Умное распределение времени напоминаний
  async optimizeReminderTimes(chatId, supplements) {
    const existingReminders = await this.getUserReminders(chatId);
    const usedTimes = new Set(existingReminders.map(r => r.time));

    const optimizedSchedule = [];
    const timeSlots = ['08:00', '12:00', '18:00', '20:00']; // Оптимальные слоты

    supplements.forEach(supplement => {
      let bestTime = this.findBestTime(supplement, usedTimes, timeSlots);
      optimizedSchedule.push({
        ...supplement,
        optimizedTime: bestTime
      });
      usedTimes.add(bestTime);
    });

    return optimizedSchedule;
  }

  // Умный подбор времени based на типе добавки
  findBestTime(supplement, usedTimes, availableSlots) {
    const name = supplement.name.toLowerCase();

    // Утренние добавки (энергия, витамины)
    if (name.includes('витамин') || name.includes('коэнзим') || name.includes('энергия')) {
      return this.findAvailableTime('08:00', usedTimes, availableSlots);
    }

    // Дневные (с едой)
    if (name.includes('омега') || name.includes('железо') || name.includes('цинк')) {
      return this.findAvailableTime('12:00', usedTimes, availableSlots);
    }

    // Вечерние (сон, релакс)
    if (name.includes('магний') || name.includes('мелатонин') || name.includes('глицин')) {
      return this.findAvailableTime('20:00', usedTimes, availableSlots);
    }

    // По умолчанию - первое свободное время
    return this.findAvailableTime('10:00', usedTimes, availableSlots);
  }

  async canSendNotification(chatId) {
    try {
      const settingsService = require('./settingsService');
      const settings = await settingsService.getUserSettings(chatId);
      return settings.allow_notifications;
    } catch (error) {
      console.error('❌ Ошибка проверки настроек уведомлений:', error);
      return true; // По умолчанию разрешаем
    }
  }
}

module.exports = ReminderService;
