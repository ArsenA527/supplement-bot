const { getMainMenuKeyboard } = require('../keyboards');
const surveyService = require('../services/surveyService');
const recommendationService = require('../services/recommendationService');
const subscriptionService = require('../services/subscriptionService');
const { ReminderController } = require('./reminderController');
const goalService = require('../services/goalService');
const settingsController = require('./settingsController');

// Создаем экземпляр для переиспользования
let reminderControllerInstance = null;

function getReminderController() {
  if (!reminderControllerInstance) {
    reminderControllerInstance = new ReminderController();
  }
  return reminderControllerInstance;
}

async function handleStart(ctx) {
  const chatId = ctx.chat.id;


  // ПРОВЕРЯЕМ ЕСТЬ ЛИ НЕЗАВЕРШЕННЫЙ ОПРОС
  try {
    const surveyService = require('../services/surveyService');
    const state = await surveyService.getUserState(chatId);

    if (state && state.current > 0 && state.current < state.total) {
      // Есть незавершенный опрос - предлагаем выбор
      const questions = await surveyService.getQuestionsForUser(chatId);
      const totalQuestions = questions.length;

      await ctx.reply(
        `📝 *У вас есть незавершенный опрос*\n\n` +
        `Прогресс: ${state.current}/${totalQuestions} вопросов\n\n` +
        `Хотите продолжить или начать заново?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '➡️ Продолжить опрос', callback_data: 'continue_survey' }],
              [{ text: '🔄 Начать новый опрос', callback_data: 'restart_survey' }],
              [{ text: '❌ Отменить опрос', callback_data: 'cancel_survey_confirmed' }]
            ]
          }
        }
      );
      return;
    }
  } catch (error) {
    console.error('❌ Ошибка проверки состояния опроса:', error);
    // Продолжаем как обычно - не ломаем весь /start из-за этой проверки
  }


  const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id);

  // Получаем краткую статистику для мотивации
  let motivationText = '';
  try {
    const reminderService = require('../services/reminderService');
    const service = new reminderService(ctx.telegram);
    const stats = await service.getIntakeStats(ctx.chat.id, 7);

    if (stats.total > 0) {
      motivationText = `\n\n📊 На этой неделе: ${stats.compliance}% соблюдения режима`;
    }
  } catch (error) {
    // Игнорируем ошибки статистики для новых пользователей
  }

  const welcomeText = `👋 Привет! Я твой персональный консультант по БАДам.

✨ Что я умею:
• Подбирать добавки по твоим потребностям
• Давать персональные рекомендации
• Помогать улучшить здоровье

Выбери действие:`;

  ctx.reply(welcomeText, getMainMenuKeyboard(isPremium));
}

async function handleHelp(ctx) {
  const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id);
  const helpText = `💡 *Доступные команды:*

*Основные:*
/start - Главное меню
/survey - Пройти опрос
/plan - Мои рекомендации
/profile - Мой профиль
/subscribe - Информация о подписках

*Напоминания:*
/myreminders - Настройки напоминаний
/myhistory - История приема
/mystats - Статистика приема


*Для помощи:* /help`;

  ctx.reply(helpText, {
    parse_mode: 'Markdown',
    ...getMainMenuKeyboard(isPremium)
  });
}

async function handlePlan(ctx) {
  const chatId = ctx.chat.id;
  const isPremium = await subscriptionService.isSubscriptionActive(chatId);

  try {
    const answers = await surveyService.getSurveyResults(chatId);

    if (!answers || Object.keys(answers).length === 0) {
      await ctx.reply('📝 Сначала пройди опрос: /survey', getMainMenuKeyboard(isPremium));
      return;
    }

    const recommendations = recommendationService.generateRecommendations(answers);
    const message = recommendationService.formatRecommendations(recommendations);

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard(isPremium)
    });

  } catch (err) {
    console.error('❌ Ошибка загрузки рекомендаций:', err);
    await ctx.reply('❌ Ошибка загрузки рекомендаций', getMainMenuKeyboard(isPremium));
  }
}

async function handleProfile(ctx) {
  const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id);
  const chatId = ctx.chat.id;

  surveyService.getSurveyResults(chatId).then(answers => {
    if (!answers || Object.keys(answers).length === 0) {
      ctx.reply('📊 Ты еще не проходил опрос. Начни: /survey', getMainMenuKeyboard(isPremium));
      return;
    }

    let profileText = `<b>👤 Твой профиль</b>\n\n`;

        const categories = {
      '📋 ОСНОВНАЯ ИНФОРМАЦИЯ': [
        'age_range', 'weight_category'
      ],
      '💼 ОБРАЗ ЖИЗНИ И НАГРУЗКИ': [
        'workload_type', 'physical_activity', 'diet_type'
      ],
      '🔬 СТРЕСС И ЭНЕРГИЯ': [
        'stress_symptoms', 'energy_focus', 'stress_level'
      ],
      '😴 СОН И ВОССТАНОВЛЕНИЕ': [
        'sleep_quality_detailed', 'sleep_quality'
      ],
      '💪 ГОРМОНАЛЬНОЕ ЗДОРОВЬЕ': [
        'libido_mood'
      ],
      '🚭 ПРИВЫЧКИ': [
        'alcohol_consumption', 'smoking_habits'
      ],
      '🧠 КОГНИТИВНОЕ ЗДОРОВЬЕ': [
        'memory_concentration'
      ],
      '🏥 ФИЗИЧЕСКОЕ ЗДОРОВЬЕ': [
        'immune_health', 'joint_health', 'digestion', 'skin_health',
        'blood_pressure', 'chronic_conditions'
      ],
      '💊 ЛЕКАРСТВА И АЛЛЕРГИИ': [
        'medication_use', 'allergies'
      ],
      '🎯 ЦЕЛИ': [
        'main_goal'
      ]
    };

    for (const [categoryName, fields] of Object.entries(categories)) {
      const categoryAnswers = [];

      fields.forEach(field => {
        if (answers[field]) {
          const formattedKey = formatKey(field);
          const value = String(answers[field]);
          categoryAnswers.push(`• ${formattedKey}: ${value}`);
        }
      });

      if (categoryAnswers.length > 0) {
        profileText += `<b>${categoryName}</b>\n${categoryAnswers.join('\n')}\n\n`;
      }
    }

    profileText += `<b>💎 Подписка</b>: ${isPremium ? 'Premium ✅' : 'Free'}`;

    // Используем HTML вместо Markdown
    ctx.reply(profileText, {
      parse_mode: 'HTML', // МЕНЯЕМ НА HTML
      ...getMainMenuKeyboard(isPremium)
    });
  }).catch(err => {
    console.error('❌ Ошибка загрузки профиля:', err);
    ctx.reply('❌ Ошибка загрузки профиля', getMainMenuKeyboard(isPremium));
  });
}

// 📅 История приема (расширенная версия)
async function handleIntakeHistory(ctx) {
  try {
    const chatId = ctx.chat.id;
    const reminderService = require('../services/reminderService');
    const service = new reminderService(ctx.telegram);

    const history = await service.getIntakeHistory(chatId, 7);
    const stats = await service.getIntakeStats(chatId, 7);

    if (history.length === 0) {
      await ctx.reply(
        `📊 *История приема пуста*\n\nНачните прием добавок, чтобы отслеживать свой прогресс! 💪`,
        {
          parse_mode: 'Markdown',
          ...getMainMenuKeyboard(true)
        }
      );
      return;
    }

    let message = `📅 *История приема за неделю*\n\n`;

    // Группируем по дням
    const dailyHistory = {};
    history.forEach(item => {
      const date = new Date(item.taken_at).toLocaleDateString('ru-RU');
      if (!dailyHistory[date]) dailyHistory[date] = [];
      dailyHistory[date].push(item);
    });

    Object.keys(dailyHistory).forEach(date => {
      message += `*${date}:*\n`;
      dailyHistory[date].forEach(item => {
        const time = new Date(item.taken_at).toLocaleTimeString('ru-RU', {
          hour: '2-digit', minute: '2-digit'
        });
        const statusIcon = item.status === 'taken' ? '✅' :
                          item.status === 'skipped' ? '⏭️' : '❌';
        message += `${statusIcon} ${time} - ${item.supplement_name}\n`;
      });
      message += `\n`;
    });

    message += `📈 *Статистика за неделю:*\n`;
    message += `• Принято: ${stats.taken} ✅\n`;
    message += `• Пропущено: ${stats.skipped} ⏭️\n`;
    message += `• Соблюдение: ${stats.compliance}%\n`;
    message += `• Всего приемов: ${stats.total}`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard(true)
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки истории:', error);
    await ctx.reply('❌ Ошибка загрузки истории приема', getMainMenuKeyboard(true));
  }
}

// 📈 Общая статистика
async function handleGeneralStats(ctx) {
  try {
    const chatId = ctx.chat.id;
    const reminderService = require('../services/reminderService');
    const service = new reminderService(ctx.telegram);

    const weeklyStats = await service.getIntakeStats(chatId, 7);
    const monthlyStats = await service.getIntakeStats(chatId, 30);
    const mostSkipped = await service.getMostSkippedSupplements(chatId, 30);

    let message = `📊 *Общая статистика*\n\n`;

    message += `📅 *За последнюю неделю:*\n`;
    message += `✅ Принято: ${weeklyStats.taken}\n`;
    message += `⏭️ Пропущено: ${weeklyStats.skipped}\n`;
    message += `📈 Соблюдение: ${weeklyStats.compliance}%\n\n`;

    message += `📅 *За последний месяц:*\n`;
    message += `✅ Принято: ${monthlyStats.taken}\n`;
    message += `⏭️ Пропущено: ${monthlyStats.skipped}\n`;
    message += `📈 Соблюдение: ${monthlyStats.compliance}%\n\n`;

    if (mostSkipped.length > 0) {
      message += `⚠️ *Чаще всего пропускаете:*\n`;
      mostSkipped.forEach((item, index) => {
        message += `${index + 1}. ${item.supplement_name} - ${item.skip_count} раз\n`;
      });
      message += `\n`;
    }

    // Добавляем рекомендации
    if (monthlyStats.compliance < 70) {
      message += `💡 *Рекомендация:* Старайтесь принимать добавки регулярнее для лучших результатов!`;
    } else if (monthlyStats.compliance >= 90) {
      message += `🎉 *Отлично!* Вы проявляете замечательную дисциплину!`;
    } else {
      message += `💪 *Хорошая работа!* Продолжайте в том же духе!`;
    }

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard(true)
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки статистики:', error);
    await ctx.reply('❌ Ошибка загрузки статистики', getMainMenuKeyboard(true));
  }
}

// 💪 Мой прогресс
async function handleMyProgress(ctx) {
  try {
    const chatId = ctx.chat.id;
    const progress = await goalService.getDetailedProgress(chatId);

    let message = `💪 *Мой прогресс*\n\n`;

    message += `🎯 *Основная цель:* ${progress.goals.mainGoal}\n\n`;

    message += `📊 *За неделю:*\n`;
    message += `• Соблюдение: ${progress.weekly.compliance}%\n`;
    message += `• Серия дней: ${progress.weekly.streak}\n`;
    message += `• Успешных приемов: ${progress.weekly.successfulIntakes}\n\n`;

    message += `📊 *За месяц:*\n`;
    message += `• Соблюдение: ${progress.monthly.compliance}%\n`;
    message += `• Всего приемов: ${progress.monthly.totalIntakes}\n`;
    message += `• Успешных приемов: ${progress.monthly.successfulIntakes}\n\n`;

    message += `💡 *Рекомендации:*\n`;
    progress.recommendations.forEach((rec, index) => {
      message += `${index + 1}. ${rec}\n`;
    });

    // Визуализация прогресса
    const weeklyBar = generateProgressBar(progress.weekly.compliance);
    const monthlyBar = generateProgressBar(progress.monthly.compliance);

    message += `\n📈 *Визуализация:*\n`;
    message += `Неделя: ${weeklyBar}\n`;
    message += `Месяц:  ${monthlyBar}`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard(true)
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки прогресса:', error);
    await ctx.reply('❌ Ошибка загрузки прогресса', getMainMenuKeyboard(true));
  }
}

// 🎯 Мои цели
async function handleMyGoals(ctx) {
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

    message += `💪 *Как достичь целей:*\n`;
    message += `• Принимайте добавки регулярно\n`;
    message += `• Следите за своим самочувствием\n`;
    message += `• Корректируйте план при необходимости\n`;
    message += `• Отмечайте положительные изменения\n\n`;

    message += `📝 *Совет:* Пройдите опрос заново через месяц, чтобы оценить прогресс и скорректировать цели!`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard(true)
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки целей:', error);
    await ctx.reply('❌ Ошибка загрузки целей', getMainMenuKeyboard(true));
  }
}

async function handleViewRecommendations(ctx) {
  const chatId = ctx.chat.id;

  try {
    await ctx.answerCbQuery('📋 Загружаю ваши рекомендации...');

    // Получаем результаты опроса
    const answers = await surveyService.getSurveyResults(chatId);

    if (!answers || Object.keys(answers).length === 0) {
      await ctx.reply('❌ Рекомендации не найдены. Пройдите опрос заново: /survey');
      return;
    }

    // Генерируем рекомендации (как в completeSurvey)
    const recommendations = recommendationService.generateRecommendations(answers);
    const message = recommendationService.formatRecommendations(recommendations);

    // Отправляем рекомендации
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard(true) // Предполагаем что пользователь premium после опроса
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки рекомендаций:', error);
    await ctx.answerCbQuery('❌ Ошибка загрузки рекомендаций');
    await ctx.reply('❌ Не удалось загрузить рекомендации. Попробуйте позже.');
  }
}

// Вспомогательная функция для прогресс-бара
function generateProgressBar(percentage) {
  const filled = '█'.repeat(Math.round(percentage / 10));
  const empty = '░'.repeat(10 - filled.length);
  return `[${filled}${empty}] ${percentage}%`;
}


function formatKey(key) {
  const keyMap = {
    // БАЗОВАЯ ИНФОРМАЦИЯ
    'age_range': '📅 Возраст',
    'height_range': '📏 Рост',
    'weight_category': '⚖️ Вес',

    // ОБРАЗ ЖИЗНИ И НАГРУЗКИ
    'workload_type': '💼 Тип нагрузки',
    'physical_activity': '🏃‍♂️ Физическая активность',
    'diet_type': '🥗 Тип питания',

    // СТРЕСС И ЭНЕРГИЯ
    'stress_symptoms': '🔬 Симптомы стресса',
    'energy_focus': '⚡️ Энергия и фокус',
    'stress_level': '😵‍💫 Уровень стресса',

    // СОН И ВОССТАНОВЛЕНИЕ
    'sleep_quality_detailed': '😴 Качество сна',
    'sleep_quality': '🌙 Сон (общее)',

    // ГОРМОНАЛЬНОЕ ЗДОРОВЬЕ
    'libido_mood': '💪 Либидо и настроение',

    // ПРИВЫЧКИ
    'alcohol_consumption': '🍷 Алкоголь',
    'smoking_habits': '🚬 Курение',

    // КОГНИТИВНОЕ ЗДОРОВЬЕ
    'memory_concentration': '🧠 Память и концентрация',

    // ФИЗИЧЕСКОЕ ЗДОРОВЬЕ
    'immune_health': '🛡️ Иммунитет',
    'joint_health': '🦵 Суставы',
    'digestion': '🍽️ Пищеварение',
    'skin_health': '✨ Кожа',
    'blood_pressure': '🩸 Давление',
    'chronic_conditions': '🏥 Хронические заболевания',

    // ЛЕКАРСТВА И АЛЛЕРГИИ
    'medication_use': '💊 Лекарства',
    'allergies': '⚠️ Аллергии',

    // ЦЕЛИ
    'main_goal': '🎯 Главная цель'
  };

  return keyMap[key] || key;
}


// Меню настроек
async function showSettingsMenu(ctx) {
  const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id);

  if (!isPremium) {
    await ctx.reply('❌ Настройки доступны только Premium пользователям. /subscribe');
    return;
  }

  const message = `⚙️ *Настройки бота*

Здесь вы можете настроить работу бота под свои предпочтения:

*🔔 Уведомления:*
• Настройка времени напоминаний
• Включение/выключение уведомлений

*📊 Данные:*
• Просмотр ваших данных
• Очистка истории

*Что хотите настроить?*`;

  ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [
        ['⏰ Настроить напоминания'],
        ['📊 Мои данные', '🗑️ Очистить историю'],
        ['🏠 Главное меню']
      ],
      resize_keyboard: true
    }
  });
}

// Меню статистики
async function showStatisticsMenu(ctx) {
  const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id); // ДОБАВЛЯЕМ

  const message = `📊 *Ваша статистика*

Здесь вы можете отслеживать свой прогресс:

*💊 Прием добавок:*
• История приема за неделю/месяц
• Процент соблюдения режима
• Самые частые пропуски

*📈 Прогресс:*
• Изменение самочувствия
• Достижение целей
• Рекомендации по улучшению

*Что вас интересует?*`;

  ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [
        ['📅 История приема', '📈 Общая статистика'],
        ['💪 Мой прогресс', '🎯 Мои цели'],
        ['🏠 Главное меню']
      ],
      resize_keyboard: true
    }
  });
}

async function handleTextCommands(ctx) {
  const text = ctx.message.text;
  const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id);

  console.log(`🎮 Обработка текстовой команды: "${text}"`);

  // 🔥 НОВАЯ ЛОГИКА: Проверяем, не выбирает ли пользователь время
  if (ctx.session && ctx.session.waitingForTimePeriod) {
    console.log(`⏰ Пользователь выбирает время для ${ctx.session.waitingForTimePeriod}: ${text}`);
    await settingsController.processTimeSelection(ctx, text);
    return; // Важно: выходим после обработки времени
  }

  switch(text) {
    case '📋 Пройти опрос':
    case '📋 Новый опрос':
      console.log('🚀 Запуск опроса');
      ctx.reply('🧩 Начинаем опрос!');
      require('./surveyController').handleStartSurvey(ctx);
      break;

    case '💊 Мои рекомендации':
      console.log('💊 Показ рекомендаций');
      handlePlan(ctx);
      break;

    case '👤 Мой профиль':
      console.log('👤 Показ профиля');
      await handleProfile(ctx);
      break;

    case '💎 Апгрейд до Premium':
      if (!isPremium) {
        console.log('💳 Информация о подписках');
        await require('./subscriptionController').showSubscriptionPlans(ctx);
      } else {
        await ctx.reply('💎 У вас уже активирована Premium подписка!');
        await showMainMenu(ctx);
      }
      break;

    case '💎 Premium статус': // Premium кнопка
      if (isPremium) {
        console.log('💎 Показ статуса Premium');
        await require('./subscriptionController').checkSubscriptionStatus(ctx);
      } else {
        await ctx.reply('❌ Эта функция доступна только Premium пользователям');
        await showMainMenu(ctx);
      }
      break;

    case '💳 Подписка':
      console.log('💳 Информация о подписках');
      await require('./subscriptionController').showSubscriptionPlans(ctx);
      break;


    case '⚙️ Настройки':
        console.log('⚙️ Показ настроек');
        await showSettingsMenu(ctx);
        break;

    case 'ℹ️ Помощь':
      console.log('ℹ️ Показ помощи');
      handleHelp(ctx);
      break;

    case '⏰ Мои напоминания': // Premium кнопка
      if (isPremium) {
        console.log('⏰ Показ напоминаний');
        try {
          const reminderController = getReminderController();
          await reminderController.showUserReminders(ctx);
        } catch (error) {
          console.error('❌ Ошибка показа напоминаний:', error);
          ctx.reply('❌ Ошибка загрузки напоминаний');
        }
      } else {
        ctx.reply('❌ Напоминания доступны только Premium пользователям. /subscribe');
        showMainMenu(ctx);
      }
      break;

    case '📊 Статистика': // Premium кнопка
      if (isPremium) {
        console.log('📊 Показ статистики');
        await showStatisticsMenu(ctx); // Теперь async
      } else {
        ctx.reply('❌ Детальная статистика доступна только Premium пользователям. /subscribe');
        await showMainMenu(ctx);
      }
      break;

    case '📅 История приема':
      if (isPremium) {
        console.log('📅 Показ истории приема');
        await handleIntakeHistory(ctx);
      } else {
        ctx.reply('❌ Эта функция доступна только Premium пользователям. /subscribe');
        await showMainMenu(ctx);
      }
      break;

    case '📈 Общая статистика':
      if (isPremium) {
        console.log('📈 Показ общей статистики');
        await handleGeneralStats(ctx);
      } else {
        ctx.reply('❌ Эта функция доступна только Premium пользователям. /subscribe');
        await showMainMenu(ctx);
      }
      break;

    case '💪 Мой прогресс':
      if (isPremium) {
        console.log('💪 Показ прогресса');
        await handleMyProgress(ctx);
      } else {
        ctx.reply('❌ Эта функция доступна только Premium пользователям. /subscribe');
        await showMainMenu(ctx);
      }
      break;

    case '🎯 Мои цели':
      if (isPremium) {
        console.log('🎯 Показ целей');
        await handleMyGoals(ctx);
      } else {
        ctx.reply('❌ Эта функция доступна только Premium пользователям. /subscribe');
        await showMainMenu(ctx);
      }
      break;

    case '⏰ Настроить напоминания':
      console.log('⏰ Настройка напоминаний');
      await settingsController.showReminderSettings(ctx);
      break;

    case '🌅 Утренние напоминания':
      await settingsController.showTimePeriodSettings(ctx, 'morning');
      break;

    case '☀️ Дневные напоминания':
      await settingsController.showTimePeriodSettings(ctx, 'afternoon');
      break;

    case '🌙 Вечерние напоминания':
      await settingsController.showTimePeriodSettings(ctx, 'evening');
      break;

    case '📊 Мои данные':
      console.log('📊 Управление данными');
      await settingsController.showDataManagement(ctx);
      break;

    case '🗑️ Очистить историю':
      console.log('🗑️ Очистка истории');
      await settingsController.showClearDataConfirmation(ctx);
      break;


    case '✅ Включить уведомления':
    case '❌ Выключить уведомления':
      await settingsController.toggleNotifications(ctx);
      break;

    case '📁 Экспорт данных':
      await settingsController.exportUserData(ctx);
      break;

    case '🔄 Сбросить настройки':
      await settingsController.resetSettings(ctx);
      break;

    case '✅ Да, очистить все данные':
      await settingsController.clearUserData(ctx);
      break;

    case '❌ Нет, отменить':
    case '↩️ Назад к настройкам':
      await settingsController.showReminderSettings(ctx);
      break;

    case '🔄 Массовое обновление':
      await settingsController.showBulkUpdateOptions(ctx);
      break;

    case '🌅 Применить утреннее время ко всем':
      await settingsController.applyBulkTimeUpdate(ctx, 'morning');
      break;

    case '☀️ Применить дневное время ко всем':
      await settingsController.applyBulkTimeUpdate(ctx, 'afternoon');
      break;

    case '🌙 Применить вечернее время ко всем':
      await settingsController.applyBulkTimeUpdate(ctx, 'evening');
      break;

    case '✅ Да, обновить все напоминания':
      await settingsController.confirmBulkUpdate(ctx);
      break;

    case '↩️ Назад к массовому обновлению':
      await settingsController.showBulkUpdateOptions(ctx);
      break;

    case '❌ Нет, отменить':
      await settingsController.showBulkUpdateOptions(ctx);
      break;

    default:
      console.log('❓ Неизвестная команда');
      ctx.reply('Используй кнопки меню для навигации 👆', getMainMenuKeyboard(isPremium));
  }
}

// Новая функция для принудительного показа меню
async function showMainMenu(ctx) {
  const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id);
  ctx.reply('Главное меню:', getMainMenuKeyboard(isPremium));
}

module.exports = {
  handleStart,
  handleHelp,
  handlePlan,
  handleProfile,
  handleTextCommands,
  handleViewRecommendations,
  showMainMenu
};
