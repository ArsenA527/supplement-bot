const { getMainMenuKeyboard } = require('../keyboards');
const surveyService = require('../services/surveyService');
const recommendationService = require('../services/recommendationService');

function handleStart(ctx) {
  const welcomeText = `👋 Привет! Я твой персональный консультант по БАДам.

✨ Что я умею:
• Подбирать добавки по твоим потребностям
• Давать персональные рекомендации
• Помогать улучшить здоровье

Выбери действие:`;

  ctx.reply(welcomeText, getMainMenuKeyboard());
}

function handleHelp(ctx) {
  const helpText = `💡 *Доступные команды:*

📋 Пройти опрос - Начать анкету
💊 Мои рекомендации - Посмотреть рекомендации
👤 Мой профиль - Информация о профиле
⚙️ Настройки - Настройки бота
ℹ️ Помощь - Это сообщение

*Текстовые команды:*
/survey - Начать опрос
/plan - Мои рекомендации
/profile - Мой профиль
/help - Помощь`;

  ctx.reply(helpText, {
    parse_mode: 'Markdown',
    ...getMainMenuKeyboard() // Добавляем меню к помощи
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
function handleProfile(ctx) {
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
      ...getMainMenuKeyboard()
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

function handleTextCommands(ctx) {
  const text = ctx.message.text;

  switch(text) {
    case '📋 Пройти опрос':
      ctx.reply('🧩 Начинаем опрос!');
      require('./surveyController').handleStartSurvey(ctx);
      break;
    case '💊 Мои рекомендации':
      handlePlan(ctx);
      break;
    case '👤 Мой профиль':
      handleProfile(ctx);
      break;
    case '⚙️ Настройки':
      ctx.reply('⚙️ Настройки пока в разработке', getMainMenuKeyboard());
      break;
    case 'ℹ️ Помощь':
      handleHelp(ctx);
      break;
    case '💳 Подписка': // Добавляем обработку кнопки подписки
      require('./subscriptionController').handleSubscribe(ctx);
      break;
    default:
      ctx.reply('Используй кнопки меню для навигации 👆', getMainMenuKeyboard());
  }
}

// Новая функция для принудительного показа меню
function showMainMenu(ctx) {
  ctx.reply('Главное меню:', getMainMenuKeyboard());
}

module.exports = {
  handleStart,
  handleHelp,
  handlePlan,
  handleProfile,
  handleTextCommands,
  showMainMenu
};
