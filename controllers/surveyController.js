const surveyService = require('../services/surveyService');
const recommendationService = require('../services/recommendationService');
const { getQuestionKeyboard, getMainMenuKeyboard } = require('../keyboards');

function handleStartSurvey(ctx) {
  const chatId = ctx.chat.id;
  const userData = {
    username: ctx.from.username,
    first_name: ctx.from.first_name,
    last_name: ctx.from.last_name
  };

  surveyService.startSurvey(chatId, userData)
    .then(() => sendQuestion(ctx))
    .catch(err => {
      console.error('❌ Ошибка начала опроса:', err);
      ctx.reply('⚠️ Ошибка начала опроса. Попробуйте снова: /survey', getMainMenuKeyboard());
    });
}

function sendQuestion(ctx) {
  const chatId = ctx.chat.id;

  surveyService.getCurrentQuestion(chatId)
    .then(question => {
      if (!question) {
        completeSurvey(ctx);
        return;
      }

      const message = `${question.text}\n\n${question.note || ''}`;

      if (question.options) {
        ctx.reply(message, getQuestionKeyboard(question));
      } else {
        ctx.reply(message);
      }
    })
    .catch(err => {
      console.error('❌ Ошибка отправки вопроса:', err);
      ctx.reply('⚠️ Ошибка. Начните заново: /survey', getMainMenuKeyboard());
    });
}

function handleTextAnswer(ctx) {
  const chatId = ctx.chat.id;
  const answer = ctx.message.text;

  surveyService.getCurrentQuestion(chatId)
    .then(question => {
      if (!question || question.options) {
        ctx.reply('❌ Используйте кнопки для ответа');
        return;
      }

      surveyService.saveAnswer(chatId, answer)
        .then(() => sendQuestion(ctx))
        .catch(err => {
          ctx.reply(err.message || '❌ Ошибка сохранения ответа');
        });
    })
    .catch(err => {
      ctx.reply('⚠️ Ошибка. Начните заново: /survey', getMainMenuKeyboard());
    });
}

// ОБРАБОТКА КНОПОК - ТОЛЬКО ДЛЯ ОПРОСА
function handleButtonAnswer(ctx) {
  const callbackData = ctx.callbackQuery.data;

  // Обрабатываем только кнопки опроса (формат q0a0)
  if (callbackData.startsWith('q') && callbackData.includes('a')) {
    handleSurveyButtonAnswer(ctx);
  } else {
    // Для всех остальных кнопок просто отвечаем
    ctx.answerCbQuery();
  }
}

function handleSurveyButtonAnswer(ctx) {
  const chatId = ctx.chat.id;
  const state = surveyService.getUserStateSync(chatId);

  if (!state) {
    ctx.answerCbQuery('❌ Сессия устарела. Начните заново: /survey');
    return;
  }

  const callbackData = ctx.callbackQuery.data;
  let answerText;

  // Парсим callback_data в формате q0a0
  const match = callbackData.match(/q(\d+)a(\d+)/);

  if (match) {
    const questionIndex = parseInt(match[1]);
    const answerIndex = parseInt(match[2]);
    const questions = surveyService.getQuestionsForUserSync(chatId);

    if (questions && questionIndex < questions.length && questions[questionIndex].options) {
      answerText = questions[questionIndex].options[answerIndex];
    }
  } else {
    // Старый формат
    answerText = callbackData;
  }

  if (!answerText) {
    ctx.answerCbQuery('❌ Ошибка данных вопроса');
    return;
  }

  surveyService.saveAnswer(chatId, answerText)
    .then(() => {
      ctx.answerCbQuery();
      sendQuestion(ctx);
    })
    .catch(err => {
      ctx.answerCbQuery('❌ Ошибка сохранения ответа');
    });
}

function completeSurvey(ctx) {
  const chatId = ctx.chat.id;

  surveyService.getSurveyResults(chatId)
    .then(answers => {
      const recommendations = recommendationService.generateRecommendations(answers);
      const message = recommendationService.formatRecommendations(recommendations);

      // Добавляем информацию о подписке
      const subscription = ctx.state.subscription || { plan: 'free' };
      const subscriptionMessage = subscription.plan === 'premium'
        ? '\n\n✨ Вы используете Premium подписку! Доступны расширенные функции.'
        : '\n\n💎 Хотите больше? Получите персональные дозировки с Premium подпиской: /subscribe';

      ctx.reply(message + subscriptionMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Детальный план', callback_data: 'get_detailed_plan' }],
            [{ text: '🔄 Пройти заново', callback_data: 'restart_survey' }],
            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
          ]
        }
      });

      surveyService.completeSurvey(chatId);
    })
    .catch(err => {
      console.error('❌ Ошибка завершения опроса:', err);
      ctx.reply('⚠️ Ошибка обработки результатов', getMainMenuKeyboard());
    });
}

module.exports = {
  handleStartSurvey,
  handleTextAnswer,
  handleButtonAnswer,
  completeSurvey
};
