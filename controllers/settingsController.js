const settingsService = require('../services/settingsService');
const { getMainMenuKeyboard, getSettingsKeyboard, getTimeSettingsKeyboard } = require('../keyboards');
const NotificationManager = require('../utils/notifications');
const sessionManager = require('../utils/sessionManager');
const goalService = require('../services/goalService');

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
          ['📊 Мои данные', '🏠 Главное меню'],
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

    sessionManager.set(ctx.chat.id, {
      waitingForTimePeriod: period,
      timestamp: Date.now()
    });

    console.log(`⏰ Пользователь ${ctx.chat.id} выбирает время для периода: ${period}`);
  }

  // 🌅 Показать напоминания по периодам
  async showPeriodReminders(ctx, period) {
    try {
      const chatId = ctx.chat.id;
      const reminderService = require('../services/reminderService');
      const service = new reminderService();

      const allReminders = await service.getUserReminders(chatId);
      const periodReminders = this.filterRemindersByPeriod(allReminders, period);

      const periodLabel = this.getPeriodLabel(period);
      const periodLabelLower = periodLabel.toLowerCase();

      if (periodReminders.length === 0) {
        await ctx.reply(
          `📭 *У вас нет ${periodLabelLower} напоминаний*\n\n` +
          `Сначала создайте напоминания через опрос, затем вы сможете ими управлять здесь.`,
          { parse_mode: 'Markdown' }
        );
        await this.showReminderSettings(ctx);
        return;
      }

      let message = `🌅 *Ваши ${periodLabelLower} напоминания*\n\n`;

      // Показываем список напоминаний
      periodReminders.forEach((reminder, index) => {
        message += `${index + 1}. ${reminder.supplement_name}\n`;
        message += `   ⏰ ${reminder.time} | 📏 ${reminder.dosage}\n\n`;
      });

      // Создаем клавиатуру
      const keyboard = [];

      // Кнопки для каждого напоминания
      periodReminders.forEach((reminder, index) => {
        // Сокращаем длинные названия для кнопки
        const shortName = reminder.supplement_name.length > 20
          ? reminder.supplement_name.substring(0, 17) + '...'
          : reminder.supplement_name;

        keyboard.push([`✏️ ${shortName} (${reminder.time})`]);
      });

      // Кнопка для массового изменения
      keyboard.push([`🔄 Изменить все ${periodLabelLower} напоминания`]);
      keyboard.push(['↩️ Назад к настройкам']);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: keyboard,
          resize_keyboard: true
        }
      });

      // Сохраняем контекст для дальнейшей обработки
      const sessionManager = require('../utils/sessionManager');
      sessionManager.set(ctx.chat.id, {
        managingPeriod: period,
        periodReminders: periodReminders,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error(`❌ Ошибка загрузки ${period} напоминаний:`, error);
      await ctx.reply('❌ Ошибка загрузки напоминаний. Попробуйте позже.');
    }
  }

  // 🕒 Фильтрация напоминаний по периоду
  filterRemindersByPeriod(reminders, period) {
    const timeRanges = {
      morning: { start: '06:00', end: '11:00' },
      afternoon: { start: '12:00', end: '17:00' },
      evening: { start: '18:00', end: '22:00' }
    };

    const range = timeRanges[period];

    return reminders.filter(reminder => {
      const time = reminder.time;
      return time >= range.start && time <= range.end;
    }).sort((a, b) => a.time.localeCompare(b.time)); // Сортируем по времени
  }

  // ✏️ Обработка редактирования отдельного напоминания
  async handleEditIndividualReminder(ctx, text) {
    try {
      const session = sessionManager.get(ctx.chat.id);
      if (!session || !session.periodReminders) {
        await ctx.reply('❌ Сессия устарела. Вернитесь в настройки напоминаний.');
        return;
      }

      const reminder = this.findReminderByButtonText(session.periodReminders, text);
      if (!reminder) {
        await ctx.reply('❌ Не удалось найти напоминание.');
        return;
      }

      const period = session.managingPeriod;
      const periodLabel = this.getPeriodLabel(period).toLowerCase();

      await this.showReminderOptions(ctx, reminder, period);

    } catch (error) {
      console.error('❌ Ошибка редактирования напоминания:', error);
      await ctx.reply('❌ Ошибка загрузки настроек напоминания.');
    }
  }

  // 🔍 Поиск напоминания по тексту кнопки
  findReminderByButtonText(reminders, buttonText) {
    const match = buttonText.match(/✏️ (.+?) \(\d{2}:\d{2}\)/);
    if (!match) return null;

    const searchName = match[1];

    return reminders.find(reminder =>
      reminder.supplement_name.includes(searchName) ||
      searchName.includes(reminder.supplement_name)
    );
  }

  // 🔄 Обработка массового изменения напоминаний
  async handleEditAllReminders(ctx, text) {
    try {
      const session = sessionManager.get(ctx.chat.id);
      if (!session || !session.managingPeriod) {
        await ctx.reply('❌ Сессия устарела. Вернитесь в настройки напоминаний.');
        return;
      }

      const period = session.managingPeriod;
      const periodLabel = this.getPeriodLabel(period).toLowerCase();

      // Используем существующий функционал выбора времени
      await this.showTimePeriodSettings(ctx, period);

    } catch (error) {
      console.error('❌ Ошибка массового изменения:', error);
      await ctx.reply('❌ Ошибка загрузки настроек.');
    }
  }

  // 📋 Показать опции для конкретного напоминания
  async showReminderOptions(ctx, reminder, period, reminderNumber) {
    const periodLabel = this.getPeriodLabel(period).toLowerCase();

    const message = `⚙️ *Настройки напоминания ${reminderNumber}*\n\n` +
      `💊 ${reminder.supplement_name}\n` +
      `📏 ${reminder.dosage}\n` +
      `⏰ ${reminder.time}\n\n` +
      `*Выберите действие:*`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          ['⏰ Изменить время', '🗑️ Удалить напоминание'],
          [`↩️ Назад к ${periodLabel} напоминаниям`]
        ],
        resize_keyboard: true
      }
    });

    // Сохраняем текущее напоминание в сессии
    const sessionManager = require('../utils/sessionManager');
    sessionManager.set(ctx.chat.id, {
      ...sessionManager.get(ctx.chat.id),
      editingReminder: reminder,
      editingReminderNumber: reminderNumber
    });
  }

  // 🔢 Извлечение номера напоминания из текста
  extractReminderNumber(text) {
    const match = text.match(/напоминание (\d+)/);
    return match ? parseInt(match[1]) : null;
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
      morning: '🌅 Утренние',
      afternoon: '☀️ Дневные',
      evening: '🌙 Вечерние'
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
          ['📈 График прогресса'],
          ['📁 Экспорт данных'],
          ['🔄 Сбросить настройки'],
          ['↩️ Назад к настройкам']
        ],
        resize_keyboard: true
      }
    });
  }

  // 🎯 Мои цели - просмотр и редактирование
  async showGoalsManagement(ctx) {
    try {
      const chatId = ctx.chat.id;
      const goals = await goalService.getUserGoals(chatId);

      let message = `🎯 *Мои цели*\n\n`;

      message += `⭐ *Основная цель:*\n${goals.mainGoal}\n\n`;

      if (goals.secondaryGoals && goals.secondaryGoals.length > 0) {
        message += `📋 *Дополнительные цели:*\n`;
        goals.secondaryGoals.forEach((goal, index) => {
          message += `${index + 1}. ${goal}\n`;
        });
        message += `\n`;
      }

      message += `💡 *Что вы хотите сделать?*`;

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            ['✏️ Изменить основную цель'],
            ['📝 Добавить дополнительную цель'],
            ['🗑️ Удалить цели'],
            ['↩️ Назад к настройкам']
          ],
          resize_keyboard: true
        }
      });

    } catch (error) {
      console.error('❌ Ошибка загрузки целей:', error);
      await ctx.reply(
        '❌ Не удалось загрузить цели. Попробуйте позже.',
        { parse_mode: 'Markdown' }
      );
    }
  }

  // 🎯 Получение списка целей из questions.js
  getGoalOptions() {
    try {
      const questions = require('../data/questions');
      // Ищем вопрос с main_goal в premium опроснике
      const goalQuestion = questions.premium.find(q => q.key === 'main_goal');

      if (goalQuestion && goalQuestion.options) {
        return goalQuestion.options;
      }

      // Fallback - стандартные цели
      return [
        "Энергия и бодрость",
        "Улучшение сна и восстановления",
        "Снижение стресса и тревожности",
        "Работа мозга и концентрация",
        "Поддержка тестостерона и либидо",
        "Укрепление иммунитета",
        "Общее оздоровление и профилактика"
      ];
    } catch (error) {
      console.error('❌ Ошибка загрузки целей из questions.js:', error);
      // Fallback
      return [
        "Энергия и бодрость",
        "Улучшение сна и восстановления",
        "Снижение стресса и тревожности",
        "Работа мозга и концентрация",
        "Поддержка тестостерона и либидо",
        "Укрепление иммунитета",
        "Общее оздоровление и профилактика"
      ];
    }
  }

  // ✏️ Изменить основную цель
  async showEditMainGoal(ctx) {
    const goalOptions = this.getGoalOptions();

    let message = `✏️ *Изменение основной цели*\n\n` +
      `Выберите новую основную цель из списка:\n\n`;

    goalOptions.forEach((goal, index) => {
      message += `${index + 1}. ${goal}\n`;
    });

    message += `\n*Выберите номер цели:*`;

    const keyboard = [];
    const rowSize = 4;

    for (let i = 0; i < goalOptions.length; i += rowSize) {
      const row = goalOptions.slice(i, i + rowSize).map((_, index) => (i + index + 1).toString());
      keyboard.push(row);
    }

    keyboard.push(['❌ Отменить изменение'], ['↩️ Назад к целям']);

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: keyboard,
        resize_keyboard: true
      }
    });

    const sessionManager = require('../utils/sessionManager');
    sessionManager.set(ctx.chat.id, {
      editingMainGoal: true,
      goalOptions: goalOptions,
      timestamp: Date.now()
    });
  }

  // 📝 Добавить дополнительную цель
  async showAddSecondaryGoal(ctx) {
    try {
      const chatId = ctx.chat.id;
      const currentGoals = await goalService.getUserGoals(chatId);

      // Доступные дополнительные цели (исключая основную)
      const availableGoals = this.getSecondaryGoalOptions().filter(goal =>
        goal !== currentGoals.mainGoal &&
        !currentGoals.secondaryGoals?.includes(goal)
      );

      if (availableGoals.length === 0) {
        await ctx.reply(
          'ℹ️ *Все доступные цели уже добавлены!*\n\n' +
          'Вы можете удалить некоторые цели, чтобы добавить новые.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      let message = `📝 *Добавление дополнительной цели*\n\n` +
        `Выберите цель из списка (можно добавить до 5 целей):\n\n`;

      availableGoals.forEach((goal, index) => {
        message += `${index + 1}. ${goal}\n`;
      });

      message += `\n*Выберите номер цели:*`;

      // Динамическая клавиатура
      const keyboard = [];
      const rowSize = 3;

      for (let i = 0; i < availableGoals.length; i += rowSize) {
        const row = availableGoals.slice(i, i + rowSize).map((_, index) => (i + index + 1).toString());
        keyboard.push(row);
      }

      keyboard.push(['❌ Отменить добавление'], ['↩️ Назад к целям']);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: keyboard,
          resize_keyboard: true
        }
      });

      const sessionManager = require('../utils/sessionManager');
      sessionManager.set(ctx.chat.id, {
        addingSecondaryGoal: true,
        availableGoals: availableGoals,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Ошибка показа добавления цели:', error);
      await ctx.reply('❌ Ошибка загрузки целей. Попробуйте позже.');
    }
  }

  // 🎯 Получение списка дополнительных целей
  getSecondaryGoalOptions() {
    try {
      const questions = require('../data/questions');
      const goalQuestion = questions.premium.find(q => q.key === 'main_goal');

      if (goalQuestion && goalQuestion.options) {
        return goalQuestion.options;
      }

      // Fallback
      return [
        "Энергия и бодрость",
        "Улучшение сна и восстановления",
        "Снижение стресса и тревожности",
        "Работа мозга и концентрация",
        "Поддержка тестостерона и либидо",
        "Укрепление иммунитета",
        "Общее оздоровление и профилактика",
        "Улучшение состояния кожи",
        "Укрепление суставов",
        "Нормализация пищеварения",
        "Повышение либидо",
        "Улучшение памяти"
      ];
    } catch (error) {
      console.error('❌ Ошибка загрузки дополнительных целей:', error);
      return [
        "Энергия и бодрость",
        "Улучшение сна и восстановления",
        "Снижение стресса и тревожности",
        "Работа мозга и концентрация",
        "Поддержка тестостерона и либидо",
        "Укрепление иммунитета"
      ];
    }
  }

  // 🗑️ Удалить цели
  async showDeleteGoalsConfirmation(ctx) {
    const message = `🗑️ *Удаление целей*\n\n` +
      `⚠️ *Внимание!* Это действие:\n` +
      `• Удалить все ваши текущие цели\n` +
      `• Сбросит прогресс по целям\n` +
      `• Не затронет историю приема и настройки\n\n` +
      `Цели будут восстановлены при следующем прохождении опроса.\n\n` +
      `*Вы уверены, что хотите удалить все цели?*`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          ['✅ Да, удалить все цели'],
          ['❌ Нет, оставить цели'],
          ['↩️ Назад к целям']
        ],
        resize_keyboard: true
      }
    });
  }

  // ✅ Подтверждение удаления целей
  async confirmDeleteGoals(ctx) {
    try {
      const db = require('../config/database');

      await new Promise((resolve, reject) => {
        db.run('DELETE FROM user_goals WHERE chat_id = ?', [ctx.chat.id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await ctx.reply(
        '✅ Все цели успешно удалены!\n\n' +
        'Вы можете установить новые цели при следующем прохождении опроса или в настройках.',
        { parse_mode: 'Markdown' }
      );

      // Возвращаемся к управлению целями
      await this.showGoalsManagement(ctx);

    } catch (error) {
      console.error('❌ Ошибка удаления целей:', error);
      await ctx.reply(
        '❌ Не удалось удалить цели. Попробуйте позже.',
        { parse_mode: 'Markdown' }
      );
    }
  }

  // 💾 Сохранение основной цели
  async saveMainGoal(ctx, goalIndex) {
    try {
      const session = sessionManager.get(ctx.chat.id);
      if (!session || !session.goalOptions) {
        await ctx.reply('❌ Сессия устарела. Начните заново.');
        return;
      }

      const goalNumber = parseInt(goalIndex);
      if (isNaN(goalNumber) || goalNumber < 1 || goalNumber > session.goalOptions.length) {
        await ctx.reply('❌ Пожалуйста, выберите номер из предложенного списка.');
        return;
      }

      const newGoal = session.goalOptions[goalNumber - 1];
      const chatId = ctx.chat.id;

      // Сохраняем новую цель в БД
      const db = require('../config/database');
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR REPLACE INTO user_goals (chat_id, main_goal, secondary_goals, updated_at)
          VALUES (?, ?, ?, datetime('now'))`,
          [chatId, newGoal, '[]'], // Очищаем второстепенные цели при смене основной
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      const recommendationsUpdated = await this.updateRecommendationsBasedOnNewGoal(chatId, newGoal);

      let message = `✅ Основная цель обновлена!\n\n` +
        `🎯 *Новая цель:* ${newGoal}\n\n`;

      if (recommendationsUpdated) {
        message += `📋 *Ваши рекомендации были пересчитаны* с учетом новой цели.\n` +
                  `💊 Проверьте раздел "Мои рекомендации" для просмотра обновленного плана!`;
      } else {
        message += `ℹ️ *Рекомендации не были обновлены* (нет данных опроса).\n` +
                  `Пройдите опрос заново для получения актуальных рекомендаций.`;
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });

      // Очищаем сессию
      sessionManager.delete(chatId);

      // Возвращаемся к управлению целями
      await this.showGoalsManagement(ctx);

    } catch (error) {
      console.error('❌ Ошибка сохранения цели:', error);
      await ctx.reply(
        '❌ Не удалось сохранить цель. Попробуйте позже.',
        { parse_mode: 'Markdown' }
      );
    }
  }

  async updateRecommendationsBasedOnNewGoal(chatId, newGoal) {
    try {
      const surveyService = require('../services/surveyService');
      const recommendationService = require('../services/recommendationService');
      const reminderService = require('../services/reminderService');

      console.log(`🔄 Начинаю обновление рекомендаций для ${chatId} с целью: ${newGoal}`);

      // Получаем текущие ответы из опроса
      const currentAnswers = await surveyService.getSurveyResults(chatId);

      if (!currentAnswers || Object.keys(currentAnswers).length === 0) {
        console.log('❌ Нет данных опроса для обновления рекомендаций');
        return false;
      }

      console.log('📋 Текущие ответы:', Object.keys(currentAnswers).length, 'полей');

      // Обновляем цель в ответах
      const oldGoal = currentAnswers.main_goal;
      currentAnswers.main_goal = newGoal;

      console.log(`🎯 Цель изменена: "${oldGoal}" → "${newGoal}"`);

      const db = require('../config/database');
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE users SET answers = ? WHERE chat_id = ?`,
          [JSON.stringify(currentAnswers), chatId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      console.log('💾 Ответы сохранены в БД');

      const newRecommendations = recommendationService.generateRecommendations(currentAnswers);
      console.log(`💊 Сгенерировано ${newRecommendations.length} новых рекомендаций`);

      const service = new reminderService();
      await service.clearUserReminders(chatId);
      console.log('🗑️ Старые напоминания очищены');

      const subscriptionService = require('../services/subscriptionService');
      const isPremium = await subscriptionService.isSubscriptionActive(chatId);

      if (isPremium && newRecommendations.length > 0) {
        const createdCount = await this.createRemindersFromRecommendationsDirectly(chatId, newRecommendations);
        console.log(`⏰ Создано ${createdCount} новых напоминаний`);
      } else {
        console.log('ℹ️ Пользователь не premium или нет рекомендаций для напоминаний');
      }

      console.log(`✅ Рекомендации успешно обновлены для пользователя ${chatId}`);
      return true;

    } catch (error) {
      console.error('❌ Ошибка обновления рекомендаций:', error);
      throw error;
    }
  }

  // 🔧 Создание напоминаний напрямую (без ctx)
  async createRemindersFromRecommendationsDirectly(chatId, recommendations) {
    try {
      const reminderService = require('../services/reminderService');
      const settingsService = require('../services/settingsService');
      const service = new reminderService();

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
          await service.createReminder(chatId, {
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

      console.log(`✅ Создано ${createdCount} напоминаний для пользователя ${chatId}`);
      return createdCount;

    } catch (error) {
      console.error('❌ Ошибка создания напоминаний:', error);
      return 0;
    }
  }

  // ⏰ Умное распределение времени (переносим из reminderController)
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

  // 💾 Добавление дополнительной цели
  async addSecondaryGoal(ctx, newGoal) {
    try {
      const goals = await goalService.getUserGoals(ctx.chat.id);
      const secondaryGoals = goals.secondaryGoals || [];

      // Проверяем, нет ли уже такой цели
      if (secondaryGoals.includes(newGoal)) {
        await ctx.reply(
          'ℹ️ Эта цель уже есть в вашем списке!',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Добавляем новую цель (ограничиваем до 5 целей)
      if (secondaryGoals.length >= 5) {
        await ctx.reply(
          '⚠️ У вас уже максимальное количество дополнительных целей (5).\n\n' +
          'Удалите некоторые цели, чтобы добавить новые.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      secondaryGoals.push(newGoal);

      // Сохраняем в БД
      const db = require('../config/database');
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR REPLACE INTO user_goals (chat_id, main_goal, secondary_goals, updated_at)
          VALUES (?, ?, ?, datetime('now'))`,
          [ctx.chat.id, goals.mainGoal, JSON.stringify(secondaryGoals)],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await ctx.reply(
        `✅ Дополнительная цель добавлена!\n\n` +
        `🎯 *Новая цель:* ${newGoal}\n\n` +
        `Теперь у вас ${secondaryGoals.length} дополнительных целей.`,
        { parse_mode: 'Markdown' }
      );

      // Очищаем сессию
      const sessionManager = require('../utils/sessionManager');
      sessionManager.delete(ctx.chat.id);

      // Возвращаемся к управлению целями
      await this.showGoalsManagement(ctx);

    } catch (error) {
      console.error('❌ Ошибка добавления цели:', error);
      await ctx.reply(
        '❌ Не удалось добавить цель. Попробуйте позже.',
        { parse_mode: 'Markdown' }
      );
    }
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

  async showProgressChart(ctx) {
    try {
      await ctx.reply('📊 Генерирую ваши графики прогресса...');

      const reminderService = require('../services/reminderService');
      const service = new reminderService();
      const chartService = require('../services/chartService');

      // Получаем историю за 30 дней
      const history = await service.getIntakeHistory(ctx.chat.id, 30);

      if (history.length === 0) {
        await ctx.reply(
          '📊 У вас пока нет данных для построения графиков.\n\n' +
          'Начните принимать добавки, чтобы отслеживать свой прогресс! 💪',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Генерируем график соблюдения режима
      const complianceChart = await chartService.generateComplianceChart(history, 30);
      await ctx.replyWithPhoto(
        { source: complianceChart },
        { caption: '📈 *Динамика соблюдения режима*\n\nПроцент успешных приемов по дням' }
      );

      // Генерируем график статистики приемов
      const intakeChart = await chartService.generateIntakeChart(history, 30);
      await ctx.replyWithPhoto(
        { source: intakeChart },
        { caption: '📊 *Статистика приемов по дням*\n\n✅ Принято | ⏭️ Пропущено | ❌ Не принято' }
      );

      // Добавляем текстовую статистику
      const stats = await service.getIntakeStats(ctx.chat.id, 30);
      const weeklyStats = await service.getIntakeStats(ctx.chat.id, 7);

      const statsMessage = `📈 *Общая статистика за 30 дней:*\n\n` +
        `• Соблюдение: ${stats.compliance}%\n` +
        `• Принято: ${stats.taken} ✅\n` +
        `• Пропущено: ${stats.skipped} ⏭️\n` +
        `• Всего: ${stats.total} приемов\n\n` +
        `📊 *За неделю:* ${weeklyStats.compliance}% соблюдения`;

      await ctx.reply(statsMessage, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Ошибка генерации графиков:', error);
      await ctx.reply(
        '❌ Не удалось сгенерировать графики. Попробуйте позже.',
        getMainMenuKeyboard(true)
      );
    }
  }
}

module.exports = new SettingsController();
