const surveyService = require('../services/surveyService');
const recommendationService = require('../services/recommendationService');
const { getQuestionKeyboard, getMainMenuKeyboard } = require('../keyboards');
const { ReminderController } = require('./reminderController');

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

// Обработка клика по кнопке опроса
function handleButtonAnswer(ctx) {
  const callbackData = ctx.callbackQuery.data;
  console.log(`🔵 Обработка callback: ${callbackData}`);

  // Если это кнопка напоминания - уже обработано в bot.js
  if (callbackData.startsWith('intake_')) {
    console.log('⏰ Кнопка напоминания, пропускаем');
    return;
  }

  // Обрабатываем только кнопки опроса (формат q0a0)
  if (callbackData.startsWith('q') && callbackData.includes('a')) {
    handleSurveyButtonAnswer(ctx);
  } else {
    // Для всех остальных кнопок просто отвечаем
    console.log('🔔 Неизвестный callback, просто отвечаем');
    ctx.answerCbQuery();
  }
}

// Обработка кнопок опроса
function handleSurveyButtonAnswer(ctx) {
  const chatId = ctx.chat.id;

  // Получаем состояние из БД через surveyService
  surveyService.getUserState(chatId)
    .then(state => {
      if (!state) {
        console.log('❌ Нет состояния для пользователя');
        ctx.answerCbQuery('❌ Сессия устарела. Начните заново: /survey');
        return;
      }

      const callbackData = ctx.callbackQuery.data;
      console.log(`📊 Обработка ответа на вопрос ${state.current}: ${callbackData}`);

      // Парсим callback_data в формате q0a0
      const match = callbackData.match(/q(\d+)a(\d+)/);

      if (match) {
        const questionIndex = parseInt(match[1]);
        const answerIndex = parseInt(match[2]);

        // Получаем вопросы для пользователя
        surveyService.getQuestionsForUser(chatId)
          .then(questions => {
            // Проверяем что это текущий вопрос
            if (questionIndex !== state.current) {
              console.log('⚠️ Несоответствие индекса вопроса');
              ctx.answerCbQuery('❌ Вопрос устарел');
              return;
            }

            const question = questions[state.current];
            if (question && question.options && answerIndex < question.options.length) {
              // Сохраняем ответ и обновляем состояние
              state.answers[question.key] = question.options[answerIndex];
              state.current++;

              surveyService.saveUserData(chatId, state)
                .then(() => {
                  console.log(`✅ Ответ сохранен: ${question.key} = ${question.options[answerIndex]}`);
                  ctx.answerCbQuery();
                  sendQuestion(ctx);
                })
                .catch(err => {
                  console.error('❌ Ошибка сохранения:', err);
                  ctx.answerCbQuery('❌ Ошибка сохранения');
                });
            } else {
              console.log('❌ Ошибка данных вопроса');
              ctx.answerCbQuery('❌ Ошибка данных вопроса');
            }
          })
          .catch(err => {
            console.error('❌ Ошибка получения вопросов:', err);
            ctx.answerCbQuery('❌ Ошибка обработки');
          });
      } else {
        console.log('❌ Неверный формат callback');
        ctx.answerCbQuery('❌ Ошибка формата данных');
      }
    })
    .catch(err => {
      console.error('❌ Ошибка получения состояния:', err);
      ctx.answerCbQuery('❌ Ошибка обработки');
    });
}

function completeSurvey(ctx) {
  const chatId = ctx.chat.id;

  surveyService.getSurveyResults(chatId)
    .then(async (answers) => {
      const recommendations = recommendationService.generateRecommendations(answers);
      const message = recommendationService.formatRecommendations(recommendations);

      try {
        await ReminderController.createRemindersFromRecommendations(ctx, recommendations);
      } catch (error) {
        console.error('❌ Ошибка создания напоминаний:', error);
      }

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
