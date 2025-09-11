const ReminderService = require('../services/reminderService');
const { getMainMenuKeyboard, getReminderSettingsKeyboard } = require('../keyboards');

class ReminderController {
  constructor(bot) {
    this.reminderService = new ReminderService(bot);
  }

  // Инициализация сервиса
  async initialize() {
    await this.reminderService.initialize();
  }

  // Показать настройки напоминаний
  async showReminderSettings(ctx) {
    const chatId = ctx.chat.id;

    const message = `⚙️ *Настройки напоминаний*\n\n` +
      `Здесь вы можете настроить время напоминаний о приеме добавок.\n\n` +
      `По умолчанию:\n` +
      `• Утро: 08:00\n` +
      `• День: 13:00\n` +
      `• Вечер: 20:00\n\n` +
      `Используйте кнопки ниже для настройки:`;

    ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getReminderSettingsKeyboard()
    });
  }

  // Создать напоминания из рекомендаций
  async createRemindersFromRecommendations(ctx, recommendations) {
    const chatId = ctx.chat.id;

    try {
      // Базовые времена приема по умолчанию
      const defaultTimes = {
        'утром': '08:00',
        'днем': '13:00',
        'вечером': '20:00',
        'перед сном': '22:00',
        'с едой': '12:00'
      };

      for (const supplement of recommendations) {
        const time = defaultTimes[supplement.time] || '12:00';

        await this.reminderService.createReminder(chatId, {
          supplement_name: supplement.name,
          dosage: supplement.dosage,
          time: time,
          days: '1111111' // Все дни недели
        });
      }

      ctx.reply(`✅ Напоминания настроены! Вы будете получать уведомления о приеме добавок.\n\n` +
               `Используйте /reminders для управления напоминаниями.`,
        getMainMenuKeyboard()
      );

    } catch (error) {
      console.error('❌ Ошибка создания напоминаний:', error);
      ctx.reply('❌ Ошибка настройки напоминаний. Попробуйте позже.');
    }
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

  // Обработка действий с напоминаниями
  async handleReminderAction(ctx, action, reminderId) {
    const chatId = ctx.chat.id;

    try {
      // Получаем информацию о напоминании
      const reminder = await this.getReminderById(reminderId);

      if (!reminder || reminder.chat_id !== chatId) {
        ctx.answerCbQuery('❌ Напоминание не найдено');
        return;
      }

      let status, message;

      switch (action) {
        case 'taken':
          status = 'taken';
          message = '✅ Прием подтвержден!';
          break;
        case 'skipped':
          status = 'skipped';
          message = '⏭️ Прием пропущен';
          break;
        case 'later':
          // Напомнить через 30 минут
          setTimeout(() => this.sendReminder(reminder), 30 * 60 * 1000);
          message = '⏰ Напомню через 30 минут';
          break;
      }

      if (status) {
        await this.reminderService.recordIntake(chatId, {
          supplement_name: reminder.supplement_name,
          dosage: reminder.dosage,
          status: status
        });
      }

      ctx.answerCbQuery(message);
      ctx.deleteMessage(); // Удаляем сообщение с кнопками

    } catch (error) {
      console.error('❌ Ошибка обработки напоминания:', error);
      ctx.answerCbQuery('❌ Ошибка обработки');
    }
  }

  // Вспомогательный метод для получения напоминания
  async getReminderById(reminderId) {
    return new Promise((resolve) => {
      db.get('SELECT * FROM reminders WHERE id = ?', [reminderId], (err, row) => {
        resolve(row);
      });
    });
  }
}

// module.exports = ReminderController;
module.exports = { ReminderController };
