const { getMainMenuKeyboard } = require('../keyboards');
const surveyService = require('../services/surveyService');
const recommendationService = require('../services/recommendationService');
const subscriptionService = require('../services/subscriptionService');
const { ReminderController } = require('./reminderController');
const goalService = require('../services/goalService');
const settingsController = require('./settingsController');
const sessionManager = require('../utils/sessionManager');

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
        ['🎯 Мои цели'],
        ['📊 Мои данные'],
        ['🏠 Главное меню']
      ],
      resize_keyboard: true
    }
  });
}

// Меню статистики
// Меню статистики - теперь это комплексный отчет
async function showStatisticsMenu(ctx) {
  try {
    const chatId = ctx.chat.id;
    const isPremium = await subscriptionService.isSubscriptionActive(chatId);

    await ctx.reply('📊 Формирую ваш персональный отчет...');

    // Получаем все данные
    const reminderService = require('../services/reminderService');
    const service = new reminderService(ctx.telegram);
    const goalService = require('../services/goalService');

    const [
      weeklyHistory,
      weeklyStats,
      monthlyStats,
      mostSkipped,
      progress,
      goals
    ] = await Promise.all([
      service.getIntakeHistory(chatId, 7),
      service.getIntakeStats(chatId, 7),
      service.getIntakeStats(chatId, 30),
      service.getMostSkippedSupplements(chatId, 30),
      goalService.getDetailedProgress(chatId),
      goalService.getUserGoals(chatId)
    ]);

    // Формируем комплексный отчет
    let message = `💪 *ВАШ ПЕРСОНАЛЬНЫЙ ОТЧЕТ*\n\n`;

    // 🎯 Раздел целей
    message += `🎯 *ЦЕЛИ*\n`;
    message += `• Основная: ${goals.mainGoal}\n`;
    if (goals.secondaryGoals && goals.secondaryGoals.length > 0) {
      message += `• Дополнительные: ${goals.secondaryGoals.slice(0, 2).join(', ')}\n`;
    }
    message += `\n`;

    // 📊 Раздел статистики
    message += `📊 *СТАТИСТИКА ПРИЕМА*\n`;

    // Недельная статистика
    message += `_За неделю:_\n`;
    message += `• Соблюдение: ${weeklyStats.compliance}% ${generateProgressBar(weeklyStats.compliance)}\n`;
    message += `• Серия дней: ${progress.weekly.streak} ${progress.weekly.streak >= 7 ? '🔥' : ''}\n`;
    message += `• Принято: ${weeklyStats.taken} ✅ | Пропущено: ${weeklyStats.skipped} ⏭️\n\n`;

    // Месячная статистика
    message += `_За месяц:_\n`;
    message += `• Соблюдение: ${monthlyStats.compliance}% ${generateProgressBar(monthlyStats.compliance)}\n`;
    message += `• Всего приемов: ${monthlyStats.total}\n`;
    message += `• Успешных: ${monthlyStats.taken} (${Math.round(monthlyStats.taken/monthlyStats.total*100)}%)\n\n`;

    // 📈 Раздел последних приемов (только если есть история)
    if (weeklyHistory.length > 0) {
      message += `📅 *ПОСЛЕДНИЕ ПРИЕМЫ*\n`;

      // Берем только последние 3 дня для краткости
      const recentDays = {};
      weeklyHistory.slice(0, 10).forEach(item => {
        const date = new Date(item.taken_at).toLocaleDateString('ru-RU');
        if (!recentDays[date]) recentDays[date] = [];
        if (recentDays[date].length < 3) { // Ограничиваем по дням и количеству
          recentDays[date].push(item);
        }
      });

      Object.keys(recentDays).slice(0, 3).forEach(date => {
        const dayStats = recentDays[date];
        const takenCount = dayStats.filter(item => item.status === 'taken').length;
        const totalCount = dayStats.length;
        const dayCompliance = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

        message += `• ${date}: ${dayCompliance}% (${takenCount}/${totalCount})\n`;
      });
      message += `\n`;
    }

    // ⚠️ Раздел анализа проблем
    if (mostSkipped.length > 0) {
      message += `⚠️ *ЧАЩЕ ПРОПУСКАЕТЕ:*\n`;
      mostSkipped.slice(0, 3).forEach((item, index) => {
        message += `${index + 1}. ${item.supplement_name} - ${item.skip_count} раз\n`;
      });
      message += `\n`;
    }

    // 💡 Раздел рекомендаций
    message += `💡 *РЕКОМЕНДАЦИИ*\n`;
    if (progress.recommendations && progress.recommendations.length > 0) {
      progress.recommendations.slice(0, 3).forEach((rec, index) => {
        message += `${index + 1}. ${rec}\n`;
      });
    } else {
      // Умные рекомендации based на статистике
      if (monthlyStats.compliance >= 90) {
        message += `🎉 Отличная дисциплина! Продолжайте в том же духе!\n`;
      } else if (monthlyStats.compliance >= 70) {
        message += `💪 Хорошие результаты! Старайтесь не пропускать приемы.\n`;
      } else {
        message += `📈 Есть куда расти! Попробуйте установить более удобное время напоминаний.\n`;
      }

      if (progress.weekly.streak < 3) {
        message += `🔥 Попробуйте создать привычку - принимайте в одно время каждый день.\n`;
      }
    }

    // 📝 Финальный совет
    message += `\n📝 *СОВЕТ:* Регулярность важнее идеального соблюдения! Главное - не сбиваться с пути.`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard(isPremium)
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки статистики:', error);
    const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id);
    await ctx.reply(
      '❌ Не удалось загрузить статистику. Попробуйте позже.',
      getMainMenuKeyboard(isPremium)
    );
  }
}

async function handleTextCommands(ctx) {
  const text = ctx.message.text;
  const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id);

  console.log(`🎮 Обработка текстовой команды: "${text}"`);

  const session = sessionManager.get(ctx.chat.id);

  // Если пользователь выбирает время
  if (session && session.waitingForTimePeriod) {
    console.log(`⏰ Пользователь выбирает время для ${session.waitingForTimePeriod}: ${text}`);
    await require('./settingsController').processTimeSelection(ctx, text);
    return;
  }

  if (session) {
    if (session.editingMainGoal) {
      await settingsController.saveMainGoal(ctx, text);
      return;
    }

    if (session.addingSecondaryGoal) {
      await settingsController.addSecondaryGoal(ctx, text);
      return;
    }
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

    case '📈 График прогресса':
      console.log('📈 Показ графика прогресса');
      await settingsController.showProgressChart(ctx);  // ИСПРАВЛЕНО
      break;

    case '⏰ Настроить напоминания':
      console.log('⏰ Настройка напоминаний');
      await settingsController.showReminderSettings(ctx);
      break;

    case '🎯 Мои цели':
      console.log('🎯 Показ управления целями');
      await settingsController.showGoalsManagement(ctx);
      break;

    case '✏️ Изменить основную цель':
      await settingsController.showEditMainGoal(ctx);
      break;

    case '📝 Добавить дополнительную цель':
      await settingsController.showAddSecondaryGoal(ctx);
      break;

    case '🗑️ Удалить цели':
      await settingsController.showDeleteGoalsConfirmation(ctx);
      break;

    case '✅ Да, удалить все цели':
      await settingsController.confirmDeleteGoals(ctx);
      break;

    case '❌ Нет, оставить цели':
    case '↩️ Назад к целям':
      await settingsController.showGoalsManagement(ctx);
      break;

    case '❌ Отменить изменение':
    case '❌ Отменить добавление':
      await settingsController.showGoalsManagement(ctx);
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

    case '↩️ Назад к настройкам':
      console.log('↩️ Возврат к настройкам');
      await showSettingsMenu(ctx);
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

    case '❌ Нет, отменить':
    case '↩️ Назад к настройкам':
      await settingsController.showReminderSettings(ctx);
      break;

    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
      const session = sessionManager.get(ctx.chat.id);
      if (session && session.editingMainGoal) {
        await settingsController.saveMainGoal(ctx, text);
        return;
      }
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
