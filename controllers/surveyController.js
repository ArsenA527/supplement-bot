const surveyService = require('../services/surveyService');
const recommendationService = require('../services/recommendationService');
const { getQuestionKeyboard } = require('../keyboards');

function handleStartSurvey(ctx) {
  const chatId = ctx.chat.id;
  surveyService.startSurvey(chatId);
  sendQuestion(ctx);
}

function sendQuestion(ctx) {
  const chatId = ctx.chat.id;
  const question = surveyService.getCurrentQuestion(chatId);

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
}

function handleTextAnswer(ctx) {
  const chatId = ctx.chat.id;
  const question = surveyService.getCurrentQuestion(chatId);

  if (!question || question.options) {
    ctx.reply('❌ Пожалуйста, используйте кнопки для ответа');
    return;
  }

  // Валидация числовых полей
  if (['age', 'height', 'weight'].includes(question.key)) {
    const value = parseInt(ctx.message.text);
    if (isNaN(value) || value <= 0) {
      ctx.reply('❌ Пожалуйста, введите корректное число');
      return;
    }
    surveyService.saveAnswer(chatId, value);
  } else {
    surveyService.saveAnswer(chatId, ctx.message.text);
  }

  sendQuestion(ctx);
}

function handleButtonAnswer(ctx) {
  const chatId = ctx.chat.id;
  const callbackData = ctx.callbackQuery.data;

  // Парсим callback_data в формате q0a0
  const match = callbackData.match(/q(\d+)a(\d+)/);

  if (match) {
    const questionIndex = parseInt(match[1]);
    const answerIndex = parseInt(match[2]);
    const question = surveyService.getCurrentQuestion(chatId);

    if (question && questionIndex === question.index && question.options) {
      const answer = question.options[answerIndex];
      surveyService.saveAnswer(chatId, answer);
    }
  }

  ctx.answerCbQuery();
  sendQuestion(ctx);
}

function completeSurvey(ctx) {
  const chatId = ctx.chat.id;
  const answers = surveyService.getSurveyResults(chatId);
  const recommendations = recommendationService.generateRecommendations(answers);
  const message = recommendationService.formatRecommendations(recommendations);

  ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💳 Получить детальный план', callback_data: 'get_detailed_plan' }],
        [{ text: '📋 Пройти опрос заново', callback_data: 'restart_survey' }]
      ]
    }
  });

  surveyService.clearSurvey(chatId);
}

module.exports = {
  handleStartSurvey,
  handleTextAnswer,
  handleButtonAnswer,
  completeSurvey
};
