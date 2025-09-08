const surveyService = require('../services/surveyService');
const recommendationService = require('../services/recommendationService');
const { getQuestionKeyboard } = require('../keyboards');

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
      ctx.reply('⚠️ Ошибка начала опроса. Попробуй снова: /survey');
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
      ctx.reply('⚠️ Ошибка. Начни заново: /survey');
    });
}

function handleTextAnswer(ctx) {
  const chatId = ctx.chat.id;
  const answer = ctx.message.text;

  surveyService.getCurrentQuestion(chatId)
    .then(question => {
      if (!question || question.options) {
        ctx.reply('❌ Используй кнопки для ответа');
        return;
      }

      surveyService.saveAnswer(chatId, answer)
        .then(() => sendQuestion(ctx))
        .catch(err => {
          ctx.reply(err.message || '❌ Ошибка сохранения ответа');
        });
    })
    .catch(err => {
      ctx.reply('⚠️ Ошибка. Начни заново: /survey');
    });
}

function handleButtonAnswer(ctx) {
  const chatId = ctx.chat.id;
  const callbackData = ctx.callbackQuery.data;

  const match = callbackData.match(/q(\d+)a(\d+)/);
  if (!match) {
    ctx.answerCbQuery('❌ Ошибка данных');
    return;
  }

  const questionIndex = parseInt(match[1]);
  const answerIndex = parseInt(match[2]);

  surveyService.getCurrentQuestion(chatId)
    .then(question => {
      if (!question || question.index !== questionIndex || !question.options) {
        ctx.answerCbQuery('❌ Вопрос устарел');
        return;
      }

      const answer = question.options[answerIndex];
      surveyService.saveAnswer(chatId, answer)
        .then(() => {
          ctx.answerCbQuery();
          sendQuestion(ctx);
        })
        .catch(err => {
          ctx.answerCbQuery('❌ Ошибка сохранения');
        });
    })
    .catch(err => {
      ctx.answerCbQuery('⚠️ Ошибка обработки');
    });
}

function completeSurvey(ctx) {
  const chatId = ctx.chat.id;

  surveyService.getSurveyResults(chatId)
    .then(answers => {
      const recommendations = recommendationService.generateRecommendations(answers);
      const message = recommendationService.formatRecommendations(recommendations);

      ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Детальный план', callback_data: 'get_detailed_plan' }],
            [{ text: '🔄 Пройти заново', callback_data: 'restart_survey' }]
          ]
        }
      });

      surveyService.completeSurvey(chatId);
    })
    .catch(err => {
      console.error('❌ Ошибка завершения опроса:', err);
      ctx.reply('⚠️ Ошибка обработки результатов');
    });
}

module.exports = {
  handleStartSurvey,
  handleTextAnswer,
  handleButtonAnswer,
  completeSurvey
};
