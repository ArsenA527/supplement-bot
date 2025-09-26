const { getMainMenuKeyboard } = require('../keyboards');
const surveyService = require('../services/surveyService');
const recommendationService = require('../services/recommendationService');
const subscriptionService = require('../services/subscriptionService');
const { ReminderController } = require('./reminderController');

// Создаем экземпляр для переиспользования
let reminderControllerInstance = null;

function getReminderController() {
  if (!reminderControllerInstance) {
    reminderControllerInstance = new ReminderController();
  }
  return reminderControllerInstance;
}

async function handleStart(ctx) {
  const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id);

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

function handlePlan(ctx) {
  const chatId = ctx.chat.id;

  surveyService.getSurveyResults(chatId).then(answers => {
    if (!answers || Object.keys(answers).length === 0) {
      ctx.reply('📝 Сначала пройди опрос: /survey', getMainMenuKeyboard());
      return;
    }

    const recommendations = recommendationService.generateRecommendations(answers);
    const message = recommendationService.formatRecommendations(recommendations);

    ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard() // Добавляем меню к рекомендациям
    });
  }).catch(err => {
    ctx.reply('❌ Ошибка загрузки рекомендаций', getMainMenuKeyboard());
  });
}

// Добавляем в начало файла вспомогательную функцию
function escapeMarkdown(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// Обновляем handleProfile
async function handleProfile(ctx) {
  const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id);
  const chatId = ctx.chat.id;

  surveyService.getSurveyResults(chatId).then(answers => {
    if (!answers || Object.keys(answers).length === 0) {
      ctx.reply('📊 Ты еще не проходил опрос. Начни: /survey', getMainMenuKeyboard());
      return;
    }

    let profileText = `👤 *Твой профиль:*\n\n`;

    for (const [key, value] of Object.entries(answers)) {
      const safeValue = escapeMarkdown(String(value));
      const formattedKey = formatKey(key);
      profileText += `• ${formattedKey}: ${safeValue}\n`;
    }

    profileText += `\n💎 *Подписка:* ${ctx.state.subscription.plan === 'premium' ? 'Premium ✅' : 'Free'}`;

    ctx.reply(profileText, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard(isPremium)
    });
  }).catch(err => {
    console.error('❌ Ошибка загрузки профиля:', err);
    ctx.reply('❌ Ошибка загрузки профиля', getMainMenuKeyboard());
  });
}

function formatKey(key) {
  const keyMap = {
    'age': '📅 Возраст',
    'height': '📏 Рост',
    'weight': '⚖️ Вес',
    'smoking': '🚬 Курение',
    'alcohol': '🍷 Алкоголь',
    'diet': '🥗 Питание',
    'blood_pressure': '🩸 Давление',
    'chronic': '🏥 Хронические болезни',
    'sleep': '😴 Сон',
    'energy': '⚡ Энергия',
    'stress': '😵‍💫 Стресс',
    'symptoms': '⚠️ Симптомы',
    'libido': '❤️ Либидо',
    'region': '🌍 Регион',
    'activity': '🏃 Активность',
    'goal': '🎯 Цель',
    'stimulants': '☕ Стимуляторы'
  };

  return keyMap[key] || key;
}

// Меню настроек
function showSettingsMenu(ctx) {
  const message = `⚙️ *Настройки бота*

Здесь вы можете настроить работу бота под свои preferences:

*🔔 Уведомления:*
• Настройка времени напоминаний
• Включение/выключение уведомлений

*📊 Данные:*
• Просмотр ваших данных
• Очистка истории (если нужно)

*🎨 Интерфейс:*
• Смена языка (скоро)
• Настройка формата времени

*Что хотите настроить?*`;

  ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [
        ['⏰ Настроить напоминания', '🔔 Управление уведомлениями'],
        ['📊 Мои данные', '🗑️ Очистить историю'],
        ['🏠 Главное меню']
      ],
      resize_keyboard: true
    }
  });
}

// Меню статистики
function showStatisticsMenu(ctx) {
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

    case '💳 Подписка':
      console.log('💳 Информация о подписках');
      require('./subscriptionController').showSubscriptionPlans(ctx);
      break;

    case '💎 Апгрейд до Premium':
      if (!isPremium) {
        console.log('💳 Информация о подписках');
        require('./subscriptionController').showSubscriptionPlans(ctx);
      } else {
        ctx.reply('💎 У вас уже активирована Premium подписка!');
        showMainMenu(ctx);
      }
      break;

    case '💎 Premium статус': // Premium кнопка
      if (isPremium) {
        console.log('💎 Показ статуса Premium');
        require('./subscriptionController').checkSubscriptionStatus(ctx);
      } else {
        ctx.reply('❌ Эта функция доступна только Premium пользователям');
        showMainMenu(ctx);
      }
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
        // Здесь будет вызов функции статистики
        ctx.reply('📊 Функция статистики в разработке...');
        showMainMenu(ctx);
      } else {
        ctx.reply('❌ Детальная статистика доступна только Premium пользователям. /subscribe');
        showMainMenu(ctx);
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
  showMainMenu
};
