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

  ctx.reply(helpText, { parse_mode: 'Markdown' });
}

function handlePlan(ctx) {
  const chatId = ctx.chat.id;

  surveyService.getSurveyResults(chatId).then(answers => {
    if (!answers || Object.keys(answers).length === 0) {
      ctx.reply('📝 Сначала пройди опрос: /survey');
      return;
    }

    const recommendations = recommendationService.generateRecommendations(answers);
    const message = recommendationService.formatRecommendations(recommendations);

    ctx.reply(message, { parse_mode: 'Markdown' });
  });
}

function handleProfile(ctx) {
  const chatId = ctx.chat.id;

  surveyService.getSurveyResults(chatId).then(answers => {
    if (!answers || Object.keys(answers).length === 0) {
      ctx.reply('📊 Ты еще не проходил опрос. Начни: /survey');
      return;
    }

    let profileText = `👤 *Твой профиль:*\n\n`;
    for (const [key, value] of Object.entries(answers)) {
      profileText += `• ${key}: ${value}\n`;
    }

    ctx.reply(profileText, { parse_mode: 'Markdown' });
  });
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
      ctx.reply('⚙️ Настройки пока в разработке');
      break;
    case 'ℹ️ Помощь':
      handleHelp(ctx);
      break;
    default:
      ctx.reply('Используй кнопки меню для навигации 👆');
  }
}

module.exports = {
  handleStart,
  handleHelp,
  handlePlan,
  handleProfile,
  handleTextCommands
};
