const ReminderService = require('../services/reminderService');
const { getMainMenuKeyboard } = require('../keyboards');

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
      await this.clearUserReminders(chatId);

      const settingsService = require('../services/settingsService');
      const settings = await settingsService.getUserSettings(chatId);

      let createdCount = 0;

      for (const supplement of recommendations) {
        let time;
        if (supplement.period && settings[`${supplement.period}_time`]) {
          time = settings[`${supplement.period}_time`];
        } else {
          time = this.getSmartTimeForSupplement(supplement, settings);
        }

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

      if (createdCount > 0) {
        let scheduleMessage = `📅 *Ваше расписание:*\n\n`;

        recommendations.forEach(supp => {
          const foodInfo = this.getFoodRecommendation(supp.name);
          scheduleMessage += `⏰ ${supp.time} - ${supp.name}\n`;
          if (foodInfo) {
            scheduleMessage += `   ${foodInfo}\n`;
          }
          scheduleMessage += `\n`;
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

  getSmartTimeForSupplement(supplement, settings) {
    const name = supplement.name.toLowerCase();

    if (name.includes('тирозин') || name.includes('родиола')) {
      return settings.morning_time || '08:00';
    } else if (name.includes('магний') || name.includes('ашваганда')) {
      return settings.evening_time || '20:00';
    } else if (name.includes('омега') || name.includes('цинк')) {
      return settings.afternoon_time || '13:00';
    } else {
      return settings.morning_time || '08:00';
    }
  }
  async clearUserReminders(chatId) {
    return new Promise((resolve) => {
      const db = require('../config/database');
      db.run('DELETE FROM reminders WHERE chat_id = ?', [chatId], (err) => {
        if (err) console.error('❌ Ошибка очистки напоминаний:', err);
        resolve();
      });
    });
  }

  findAvailableTime(usedTimes, baseTime) {
    const [baseHours, baseMinutes] = baseTime.split(':').map(Number);

    for (let i = 1; i <= 6; i++) {
      const minutes = (baseMinutes + i * 30) % 60;
      const hours = baseHours + Math.floor((baseMinutes + i * 30) / 60);

      const newTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      if (!usedTimes.has(newTime)) {
        return newTime;
      }
    }

    return baseTime;
  }

  async showUserReminders(ctx) {
    const chatId = ctx.chat.id;
    const reminders = await this.reminderService.getUserReminders(chatId);

    const subscriptionService = require('../services/subscriptionService');
    const isPremium = await subscriptionService.isSubscriptionActive(chatId);

    if (reminders.length === 0) {
      ctx.reply('📋 У вас нет активных напоминаний.\n\nНастройте напоминания после прохождения опроса.',
        getMainMenuKeyboard(isPremium)
      );
      return;
    }

    let message = '📋 *Ваши напоминания:*\n\n';

    reminders.forEach(reminder => {
      const foodInfo = this.getFoodRecommendation(reminder.supplement_name);
      message += `⏰ ${reminder.time} - ${reminder.supplement_name}\n`;
      message += `   📏 ${reminder.dosage}\n`;

      if (foodInfo) {
        message += `   ${foodInfo}\n`;
      }

      message += `\n`;
    });

    message += `Всего: ${reminders.length} напоминаний`;

    ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard(isPremium)
    });
  }

  // Рекомендации по приему с едой
  getFoodRecommendation(supplementName) {
    const foodRules = {
      'Витамин D3': '🍳 С жирной пищей для усвоения',
      'Омега-3': '🍽️ Обязательно с едой',
      'L-Тирозин': '⏰ Натощак за 30 мин до еды',
      'Цинк': '🍛 С едой чтобы избежать тошноту',
      'Родиола розовая': '☕ За 20-30 минут до завтрака',
      'Магний': '🌙 На пустой желудок перед сном',
      'Ашваганда': '💊 Можно с едой или без'
    };

    for (const [key, recommendation] of Object.entries(foodRules)) {
      if (supplementName.includes(key)) {
        return recommendation;
      }
    }

    return null;
  }

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

  // Обработка действий с напоминаниями
  async handleReminderAction(ctx, action, reminderId) {
    try {
      console.log(`🔵 Обработка действия: ${action} для напоминания ${reminderId}`);

      const db = require('../config/database');

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
