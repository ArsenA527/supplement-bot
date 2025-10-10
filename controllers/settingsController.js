const settingsService = require('../services/settingsService');
const { getMainMenuKeyboard, getSettingsKeyboard, getTimeSettingsKeyboard } = require('../keyboards');
const NotificationManager = require('../utils/notifications');
const sessionManager = require('../utils/sessionManager');

class SettingsController {

  // ⏰ Настроить напоминания
  async showReminderSettings(ctx) {
    const settings = await settingsService.getUserSettings(ctx.chat.id);

    const message = `⏰ *Настройка времени напоминаний*

  Текущие настройки:
  🌅 Утро: ${settings.morning_time}
  ☀️ День: ${settings.afternoon_time}
  🌙 Вечер: ${settings.evening_time}

  *Выберите период для настройки:*`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          ['🌅 Утренние напоминания', '☀️ Дневные напоминания', '🌙 Вечерние напоминания'],
          ['📊 Мои данные', '🏠 Главное меню']
        ],
        resize_keyboard: true
      }
    });
  }

  // Функция для группировки времени
  async showTimePeriodSettings(ctx, period) {
    const timeSlots = this.getTimeSlotsByPeriod(period);
    const periodLabel = this.getPeriodLabel(period);

    const message = `⏰ *Настройка ${periodLabel} напоминаний*\n\nВыберите время для ${periodLabel.toLowerCase()} напоминаний:`;

    // Создаем клавиатуру с группировкой по 3 кнопки в ряду
    const keyboard = [];
    for (let i = 0; i < timeSlots.length; i += 3) {
      keyboard.push(timeSlots.slice(i, i + 3));
    }
    keyboard.push(['↩️ Назад к настройкам', '🏠 Главное меню']);

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: keyboard,
        resize_keyboard: true
      }
    });

    // 🔥 СОХРАНЯЕМ В МЕНЕДЖЕР СЕССИЙ
    sessionManager.set(ctx.chat.id, {
      waitingForTimePeriod: period,
      timestamp: Date.now()
    });

    console.log(`⏰ Пользователь ${ctx.chat.id} выбирает время для периода: ${period}`);
  }

  // Группировка временных слотов по периодам
  getTimeSlotsByPeriod(period) {
    const slots = {
      morning: ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00'],
      afternoon: ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
      evening: ['18:00', '19:00', '20:00', '21:00', '22:00']
    };

    return slots[period] || slots.morning;
  }

  getPeriodLabel(period) {
    const labels = {
      morning: '🌅 Утренних',
      afternoon: '☀️ Дневных',
      evening: '🌙 Вечерних'
    };
    return labels[period] || 'Напоминаний';
  }

  // 🔔 Управление уведомлениями
  async showNotificationSettings(ctx) {
    const settings = await settingsService.getUserSettings(ctx.chat.id);
    const status = settings.allow_notifications ? '✅ Включены' : '❌ Выключены';

    const message = `🔔 *Управление уведомлениями*\n\n` +
      `Текущий статус: ${status}\n\n` +
      `Здесь вы можете включить или выключить все уведомления бота.`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [settings.allow_notifications ? '❌ Выключить уведомления' : '✅ Включить уведомления'],
          ['⏰ Настроить время', '📊 Мои данные'],
          ['🏠 Главное меню']
        ],
        resize_keyboard: true
      }
    });
  }

  // Переключить уведомления
  async toggleNotifications(ctx) {
    try {
      const newStatus = await settingsService.toggleNotifications(ctx.chat.id);
      const statusText = newStatus ? 'включены' : 'выключены';

      await NotificationManager.success(ctx,
        `🔔 Уведомления ${statusText}!`
      );

      // Показываем обновленные настройки
      await this.showNotificationSettings(ctx);

    } catch (error) {
      console.error('❌ Ошибка переключения уведомлений:', error);
      await NotificationManager.error(ctx,
        '❌ Ошибка изменения настроек уведомлений'
      );
    }
  }

  // 📊 Мои данные
  async showDataManagement(ctx) {
    const message = `📊 *Управление данными*\n\n` +
      `Здесь вы можете управлять своими данными:\n\n` +
      `• 📈 **График прогресса** - визуализация ваших результатов\n` +
      `• 📁 **Экспорт данных** - скачайте все ваши данные в формате JSON\n` +
      `• 🔄 **Сброс настроек** - верните настройки к значениям по умолчанию\n\n` +
      `*Выберите действие:*`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          ['📁 Экспорт данных'],
          ['🔄 Сбросить настройки'],
          ['↩️ Назад к настройкам']
        ],
        resize_keyboard: true
      }
    });
  }

  // 📁 Экспорт данных
  async exportUserData(ctx) {
    try {
      await NotificationManager.loading(ctx, 'Подготавливаю ваши данные...');

      const userData = await settingsService.exportUserData(ctx.chat.id);
      const jsonData = JSON.stringify(userData, null, 2);

      // Отправляем как файл
      await ctx.replyWithDocument({
        source: Buffer.from(jsonData),
        filename: `supplement_bot_data_${ctx.chat.id}_${new Date().toISOString().split('T')[0]}.json`
      }, {
        caption: `📁 *Экспорт ваших данных*\n\n` +
          `Файл содержит всю вашу информацию из бота:\n` +
          `• Профиль и настройки\n` +
          `• Напоминания и историю приема\n` +
          `• Цели и прогресс\n\n` +
          `*Дата экспорта:* ${new Date().toLocaleDateString('ru-RU')}`,
        parse_mode: 'Markdown'
      });

    } catch (error) {
      console.error('❌ Ошибка экспорта данных:', error);
      await NotificationManager.error(ctx,
        '❌ Ошибка экспорта данных. Попробуйте позже.'
      );
    }
  }

  // 🗑️ Очистить историю
  async showClearDataConfirmation(ctx) {
    const message = `🗑️ *Очистка данных*\n\n` +
      `⚠️ *Внимание!* Это действие:\n` +
      `• Удалит всю историю приема добавок\n` +
      `• Удалит ваш прогресс и достижения\n` +
      `• Сбросит текущий опрос (если есть)\n` +
      `• *Не затронет* вашу подписку и основные настройки\n\n` +
      `Данное действие *нельзя отменить*!\n\n` +
      `Вы уверены, что хотите очистить все данные?`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          ['✅ Да, очистить все данные'],
          ['❌ Нет, отменить'],
          ['🏠 Главное меню']
        ],
        resize_keyboard: true
      }
    });
  }

  // Подтверждение очистки данных
  async clearUserData(ctx) {
    try {
      await settingsService.clearUserData(ctx.chat.id);

      await NotificationManager.success(ctx,
        `✅ Все ваши данные успешно очищены!\n\n` +
        `Вы можете начать заново с опроса: /survey`
      );

      // Показываем главное меню
      const { showMainMenu } = require('./botController');
      await showMainMenu(ctx);

    } catch (error) {
      console.error('❌ Ошибка очистки данных:', error);
      await NotificationManager.error(ctx,
        '❌ Ошибка очистки данных. Попробуйте позже.'
      );
    }
  }

  // 🔄 Сброс настроек
  async resetSettings(ctx) {
    try {
      // Удаляем настройки и создаем заново
      const db = require('../config/database');

      await new Promise((resolve, reject) => {
        db.run('DELETE FROM notification_settings WHERE chat_id = ?', [ctx.chat.id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Создаем настройки по умолчанию
      await settingsService.createDefaultSettings(ctx.chat.id);

      await NotificationManager.success(ctx,
        `🔄 Настройки сброшены к значениям по умолчанию!`
      );

      // Показываем обновленные настройки
      await this.showNotificationSettings(ctx);

    } catch (error) {
      console.error('❌ Ошибка сброса настроек:', error);
      await NotificationManager.error(ctx,
        '❌ Ошибка сброса настроек.'
      );
    }
  }

  // ⏰ Обработка выбора времени
  async handleTimeSetting(ctx, timeType) {
    const timeSlots = settingsService.getAvailableTimeSlots();

    const timeLabels = {
      morning_time: 'утреннего',
      afternoon_time: 'дневного',
      evening_time: 'вечернего'
    };

    const message = `⏰ Выберите время для ${timeLabels[timeType]} напоминания:`;

    // Создаем клавиатуру с временными слотами (группируем по 4)
    const keyboard = [];
    for (let i = 0; i < timeSlots.length; i += 4) {
      keyboard.push(timeSlots.slice(i, i + 4));
    }
    keyboard.push(['↩️ Назад к настройкам']);

    await ctx.reply(message, {
      reply_markup: {
        keyboard: keyboard,
        resize_keyboard: true
      }
    });

    // Сохраняем состояние выбора времени
    ctx.session = ctx.session || {};
    ctx.session.waitingForTime = timeType;
  }

  // Обработка выбранного времени
  async processTimeSelection(ctx, time) {

    const session = sessionManager.get(ctx.chat.id);
    const period = session?.waitingForTimePeriod;

    if (!period) {
      await ctx.reply('❌ Сначала выберите период для настройки времени.');
      await this.showReminderSettings(ctx);
      return;
    }

    const timeType = this.getTimeTypeFromPeriod(period);

    try {
      // Валидация времени
      this.validateTime(time);

      // Получаем текущие настройки
      const oldSettings = await settingsService.getUserSettings(ctx.chat.id);

      // Обновляем настройки (теперь возвращает объект)
      const result = await settingsService.updateNotificationSettings(ctx.chat.id, {
        [timeType]: time
      });

      // Очищаем состояние
      sessionManager.delete(ctx.chat.id);

      const periodLabel = this.getPeriodLabel(period).toLowerCase();

      let message = `✅ Время ${periodLabel} напоминаний установлено на ${time}`;

      if (result.remindersUpdated > 0) {
        message += `\n\n🔄 Обновлено ${result.remindersUpdated} напоминаний в этом временном периоде`;
      } else {
        message += `\n\n💡 Новое время применено. Существующие напоминания не затронуты.`;
      }

      await ctx.reply(message);

      // Показываем обновленные настройки
      await this.showReminderSettings(ctx);

    } catch (error) {
      await ctx.reply(`❌ ${error.message}\n\nПожалуйста, выберите время из предложенных вариантов.`);

      // Повторно показываем выбор времени для этого периода
      await this.showTimePeriodSettings(ctx, period);
    }
  }

  // Добавляем валидацию времени в SettingsController
  validateTime(timeString) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(timeString)) {
      throw new Error('Неверный формат времени. Используйте HH:MM (например, 08:30)');
    }
    return true;
  }

  // Сопоставление периодов с типами времени в БД
  getTimeTypeFromPeriod(period) {
    const mapping = {
      morning: 'morning_time',
      afternoon: 'afternoon_time',
      evening: 'evening_time'
    };
    return mapping[period] || 'morning_time';
  }
  // Сопоставление периодов с типами времени в БД
  getTimeTypeFromPeriod(period) {
    const mapping = {
      morning: 'morning_time',
      afternoon: 'afternoon_time',
      evening: 'evening_time'
    };
    return mapping[period] || 'morning_time';
  }

  getTimeLabel(timeType) {
    const labels = {
      morning_time: 'утреннего',
      afternoon_time: 'дневного',
      evening_time: 'вечернего'
    };
    return labels[timeType] || '';
  }

  // Отмена операции
  async cancelOperation(ctx) {
    sessionManager.delete(ctx.chat.id);
    await this.showReminderSettings(ctx);
  }

  // Добавляем в SettingsController
  async showTimeChangePreview(ctx, period, newTime) {
    const oldSettings = await settingsService.getUserSettings(ctx.chat.id);
    const timeType = this.getTimeTypeFromPeriod(period);
    const oldTime = oldSettings[timeType];

    // Получаем напоминания которые будут изменены
    const affectedReminders = await this.getAffectedReminders(ctx.chat.id, period, oldTime, newTime);

    const periodLabel = this.getPeriodLabel(period).toLowerCase();

    let message = `🔍 *Предпросмотр изменений*\n\n`;
    message += `Вы меняете ${periodLabel} время с *${oldTime}* на *${newTime}*\n\n`;

    if (affectedReminders.length > 0) {
      message += `*Будут обновлены напоминания:*\n`;
      affectedReminders.forEach(reminder => {
        message += `• ${reminder.time} → ${newTime} - ${reminder.supplement_name}\n`;
      });

      message += `\n*Применить изменения?*`;

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            ['✅ Да, применить изменения'],
            ['❌ Нет, выбрать другое время'],
            ['🏠 Главное меню']
          ],
          resize_keyboard: true
        }
      });

      // Сохраняем данные для применения
      ctx.session.pendingTimeChange = { period, newTime, affectedReminders };

    } else {
      message += `⚠️ В этом периоде нет напоминаний для обновления.\n\n`;
      message += `Создайте напоминания чтобы использовать умное распределение.`;

      await ctx.reply(message, { parse_mode: 'Markdown' });
      await this.showTimePeriodSettings(ctx, period);
    }
  }

  // Получаем напоминания которые будут затронуты
  async getAffectedReminders(chatId, period, oldTime, newTime) {
    return new Promise((resolve) => {
      const db = require('../config/database');
      const timeRanges = {
        morning: { start: '06:00', end: '11:00' },
        afternoon: { start: '12:00', end: '17:00' },
        evening: { start: '18:00', end: '22:00' }
      };

      const range = timeRanges[period];

      db.all(
        `SELECT * FROM reminders
        WHERE chat_id = ?
        AND time BETWEEN ? AND ?
        AND time != ?`,
        [chatId, range.start, range.end, newTime],
        (err, reminders) => {
          resolve(reminders || []);
        }
      );
    });
  }

  // Применяем изменения после подтверждения
  async applyTimeChanges(ctx) {
    const pendingChange = ctx.session.pendingTimeChange;

    if (!pendingChange) {
      await ctx.reply('❌ Нет ожидающих изменений');
      return;
    }

    const { period, newTime, affectedReminders } = pendingChange;
    const timeType = this.getTimeTypeFromPeriod(period);

    try {
      // Применяем изменения
      const result = await settingsService.updateNotificationSettings(ctx.chat.id, {
        [timeType]: newTime
      });

      // Очищаем ожидающие изменения
      delete ctx.session.pendingTimeChange;

      const periodLabel = this.getPeriodLabel(period).toLowerCase();

      let message = `✅ ${periodLabel} время установлено на ${newTime}\n\n`;

      if (result.remindersUpdated > 0) {
        message += `🔄 Обновлено ${result.remindersUpdated} напоминаний:\n`;
        affectedReminders.slice(0, 5).forEach(reminder => {
          message += `• ${reminder.supplement_name}\n`;
        });

        if (affectedReminders.length > 5) {
          message += `• ... и еще ${affectedReminders.length - 5}\n`;
        }
      }

      await ctx.reply(message);
      await this.showReminderSettings(ctx);

    } catch (error) {
      await ctx.reply(`❌ Ошибка применения изменений: ${error.message}`);
    }
  }
}

module.exports = new SettingsController();
