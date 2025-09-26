const ReminderService = require('../services/reminderService');
const { getMainMenuKeyboard } = require('../keyboards'); // Исправляем импорт

class ReminderController {
  constructor(bot) {
    this.reminderService = new ReminderService(bot);
    this.bot = bot;
  }

  // Инициализация сервиса
  async initialize() {
    try {
      await this.reminderService.initialize();
      console.log('✅ Сервис напоминаний инициализирован');
    } catch (error) {
      console.error('❌ Ошибка инициализации напоминаний:', error);
    }
  }

  // Создать напоминания из рекомендаций
  async createRemindersFromRecommendations(ctx, recommendations) {
    const chatId = ctx.chat.id;

    try {
      // Сначала удаляем старые напоминания
      await this.clearUserReminders(chatId);

      // Умное распределение времени
      const timeSlots = {
        'утром': '08:00', 'утро': '08:00',
        'днем': '13:00', 'дневное': '13:00',
        'вечером': '20:00', 'вечер': '20:00',
        'перед сном': '22:00', 'сон': '22:00',
        'с едой': '12:00', 'еда': '12:00',
        'после еды': '13:00'
      };

      let createdCount = 0;
      const usedTimes = new Set();

      for (const supplement of recommendations) {
        const timeKey = supplement.time.toLowerCase();
        let time = timeSlots[timeKey] || '10:00';

        // Если время уже занято, находим свободное
        if (usedTimes.has(time)) {
          time = this.findAvailableTime(usedTimes, time);
        }

        usedTimes.add(time);

        try {
          await this.reminderService.createReminder(chatId, {
            supplement_name: supplement.name,
            dosage: supplement.dosage,
            time: time,
            days: '1111111'
          });
          createdCount++;

        } catch (error) {
          console.error('❌ Ошибка создания напоминания:', error);
        }
      }

      // Отправляем расписание пользователю
      if (createdCount > 0) {
        const sortedTimes = Array.from(usedTimes).sort();
        let scheduleMessage = `📅 *Ваше расписание:*\n`;

        sortedTimes.forEach(t => {
          scheduleMessage += `⏰ ${t}\n`;
        });

        ctx.reply(`✅ Создано ${createdCount} напоминаний!\n\n${scheduleMessage}\nВы будете получать уведомления в указанное время.`,
          { parse_mode: 'Markdown' }
        );
      }

      return createdCount;

    } catch (error) {
      console.error('❌ Ошибка создания напоминаний:', error);
      throw error;
    }
  }

  // Очистить напоминания пользователя
  async clearUserReminders(chatId) {
    return new Promise((resolve) => {
      const db = require('../config/database');
      db.run('DELETE FROM reminders WHERE chat_id = ?', [chatId], (err) => {
        if (err) console.error('❌ Ошибка очистки напоминаний:', err);
        resolve();
      });
    });
  }

  // Вспомогательный метод для поиска свободного времени
  findAvailableTime(usedTimes, baseTime) {
    const [baseHours, baseMinutes] = baseTime.split(':').map(Number);

    // Пробуем сдвинуть на 30 минут
    for (let i = 1; i <= 6; i++) {
      const minutes = (baseMinutes + i * 30) % 60;
      const hours = baseHours + Math.floor((baseMinutes + i * 30) / 60);

      const newTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      if (!usedTimes.has(newTime)) {
        return newTime;
      }
    }

    // Если все занято, возвращаем исходное
    return baseTime;
  }

  // Показать настройки напоминаний
  async showReminderSettings(ctx) {
    // Временно используем простую клавиатуру вместо getReminderSettingsKeyboard
    const message = `⚙️ *Настройки напоминаний*\n\n` +
      `Здесь вы можете настроить время напоминаний о приеме добавок.\n\n` +
      `По умолчанию:\n` +
      `• Утро: 08:00\n` +
      `• День: 13:00\n` +
      `• Вечер: 20:00\n\n` +
      `Используйте команды для настройки:`;

    // Используем главное меню вместо специализированной клавиатуры
    ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard() // Используем существующую клавиатуру
    });
  }

  // Показать напоминания пользователя
  async showUserReminders(ctx) {
    const chatId = ctx.chat.id;
    const reminders = await this.reminderService.getUserReminders(chatId);

    // ДОБАВЛЯЕМ ПРОВЕРКУ ПОДПИСКИ
    const subscriptionService = require('../services/subscriptionService');
    const isPremium = await subscriptionService.isSubscriptionActive(chatId);

    if (reminders.length === 0) {
      ctx.reply('📋 У вас нет активных напоминаний.\n\nНастройте напоминания после прохождения опроса.',
        getMainMenuKeyboard(isPremium) // ПЕРЕДАЕМ isPremium
      );
      return;
    }

    let message = '📋 *Ваши напоминания:*\n\n';
    reminders.forEach(reminder => {
      message += `⏰ ${reminder.time} - ${reminder.supplement_name} (${reminder.dosage})\n`;
    });

    message += `\nВсего: ${reminders.length} напоминаний`;

    ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard(isPremium) // ПЕРЕДАЕМ isPremium
    });
  }

  // Показать историю приема
  async showIntakeHistory(ctx, days = 7) {
    const chatId = ctx.chat.id;
    const history = await this.reminderService.getIntakeHistory(chatId, days);
    const stats = await this.reminderService.getIntakeStats(chatId, days);

    if (history.length === 0) {
      ctx.reply('📊 История приема пуста.\n\nНачните прием добавок чтобы отслеживать прогресс!',
        getMainMenuKeyboard()
      );
      return;
    }

    let message = `📊 *История приема (${days} дней):*\n\n`;

    history.forEach((item, index) => {
      const date = new Date(item.taken_at).toLocaleDateString('ru-RU');
      const time = new Date(item.taken_at).toLocaleTimeString('ru-RU', {
        hour: '2-digit', minute: '2-digit'
      });

      const statusIcon = item.status === 'taken' ? '✅' : item.status === 'skipped' ? '⏭️' : '❌';
      message += `${statusIcon} ${date} ${time} - ${item.supplement_name} (${item.dosage})\n`;
    });

    message += `\n📈 *Статистика:*\n` +
               `• Принято: ${stats.taken} ✅\n` +
               `• Пропущено: ${stats.skipped} ⏭️\n` +
               `• Всего: ${stats.total}\n` +
               `• Соблюдение: ${stats.compliance}%`;

    ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard()
    });
  }

  // Обработка действий с напоминаниями - УПРОЩЕННАЯ ВЕРСИЯ
  async handleReminderAction(ctx, action, reminderId) {
    try {
      const db = require('../config/database');

      // Получаем напоминание
      db.get('SELECT * FROM reminders WHERE id = ?', [reminderId], async (err, reminder) => {
        if (err || !reminder) {
          ctx.answerCbQuery('❌ Напоминание не найдено');
          return;
        }

        let message;

        switch (action) {
          case 'taken':
            await this.reminderService.recordIntake(ctx.chat.id, {
              supplement_name: reminder.supplement_name,
              dosage: reminder.dosage,
              status: 'taken'
            });
            message = '✅ Прием подтвержден!';
            break;

          case 'skipped':
            await this.reminderService.recordIntake(ctx.chat.id, {
              supplement_name: reminder.supplement_name,
              dosage: reminder.dosage,
              status: 'skipped'
            });
            message = '⏭️ Прием пропущен';
            break;

          case 'later':
            message = '⏰ Напомню через 1 минуту';
            // Напомнить через 1 минуту (для теста)
            setTimeout(() => {
              ctx.reply(`⏰ Напоминание: ${reminder.supplement_name} (${reminder.dosage})`,
                {
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: '✅ Принял', callback_data: `intake_taken_${reminder.id}` },
                        { text: '⏰ Еще раз', callback_data: `intake_later_${reminder.id}` },
                        { text: '❌ Пропустить', callback_data: `intake_skipped_${reminder.id}` }
                      ]
                    ]
                  }
                }
              );
            }, 60000);
            break;
        }

        ctx.answerCbQuery(message);

        // Пытаемся удалить сообщение
        try {
          await ctx.deleteMessage();
        } catch (error) {
          console.log('Сообщение уже удалено или недоступно');
        }
      });

    } catch (error) {
      console.error('❌ Ошибка обработки напоминания:', error);
      ctx.answerCbQuery('❌ Ошибка обработки');
    }
  }

  // Вспомогательный метод для получения напоминания
  async getReminderById(reminderId) {
    return new Promise((resolve) => {
      const db = require('../config/database');
      db.get('SELECT * FROM reminders WHERE id = ?', [reminderId], (err, row) => {
        resolve(row);
      });
    });
  }
}

module.exports = { ReminderController };
