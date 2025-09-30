const surveyService = require('../services/surveyService');
const recommendationService = require('../services/recommendationService');
const progressService = require('../services/progressService');
const goalService = require('../services/goalService');
const { getQuestionKeyboard, getMainMenuKeyboard, getSurveyCompletionKeyboard } = require('../keyboards');
const NotificationManager = require('../utils/notifications');
const subscriptionService = require('../services/subscriptionService');

// Начать опрос
async function handleStartSurvey(ctx) {
  const chatId = ctx.chat.id;
  const userData = {
    username: ctx.from.username,
    first_name: ctx.from.first_name,
    last_name: ctx.from.last_name
  };

  try {
    // Проверяем, может ли пользователь начать опрос
    const canStart = await surveyService.canStartSurvey(chatId);

    if (!canStart) {
      const isPremium = await require('../services/subscriptionService').isSubscriptionActive(chatId);

      if (!isPremium) {
        await ctx.reply(
          `📝 *Вы уже проходили бесплатный опрос.*\n\n` +
          `💎 Для неограниченного доступа и расширенного опроса оформите Premium подписку:\n\n` +
          `• 17+ углубленных вопросов\n` +
          `• Персональные дозировки\n` +
          `• Умные напоминания\n` +
          `• Неограниченные опросы\n\n` +
          `Используйте /subscribe для получения доступа!`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
    }

    await surveyService.startSurvey(chatId, userData);
    await sendQuestion(ctx);

  } catch (error) {
    console.error('❌ Ошибка начала опроса:', error);

    if (error.message.includes('уже проходили опрос')) {
      await ctx.reply(
        `❌ ${error.message}\n\n` +
        `💎 Для повторного прохождения оформите Premium подписку: /subscribe`,
        getMainMenuKeyboard()
      );
    } else {
      await NotificationManager.error(ctx,
        'Ошибка начала опроса. Попробуйте снова: /survey'
      );
    }
  }
}

// Отправить вопрос пользователю
async function sendQuestion(ctx) {
  const chatId = ctx.chat.id;

  try {
    await deletePreviousSurveyMessage(ctx);
    const question = await surveyService.getCurrentQuestion(chatId);

    if (!question) {
      await completeSurvey(ctx);
      return;
    }

    // Получаем прогресс опроса
    const progress = await surveyService.getSurveyProgress(chatId);
    const progressBar = generateProgressBar(progress.current, progress.total);

    // Форматируем сообщение
    let message = `${progressBar}\n\n`;
    message += `*Вопрос ${progress.current + 1} из ${progress.total}*\n\n`;
    message += `📝 ${question.text}\n`;

    if (question.note) {
      message += `\n💡 *${question.note}*`;
    }

    let sentMessage;
    if (question.options) {
      sentMessage = await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...getQuestionKeyboard(question, progress)
      });
    } else {
      sentMessage = await ctx.reply(message, { parse_mode: 'Markdown' });

      // Для текстовых вопросов добавляем подсказку
      if (['age', 'height', 'weight'].includes(question.key)) {
        await ctx.reply('💡 *Введите число:*', { parse_mode: 'Markdown' });
      } else if (question.key === 'region') {
        await ctx.reply('💡 *Введите ваш регион или город:*', { parse_mode: 'Markdown' });
      }
    }

    // Сохраняем ID сообщения для последующего удаления
    if (sentMessage && sentMessage.message_id) {
      await surveyService.saveSurveyMessageId(chatId, sentMessage.message_id);
    }

    console.log(`📨 Отправлен вопрос ${progress.current + 1}/${progress.total} пользователю ${chatId}`);

  } catch (error) {
    console.error('❌ Ошибка отправки вопроса:', error);
    await NotificationManager.error(ctx,
      'Ошибка загрузки вопроса. Начните заново: /survey'
    );
  }
}

async function deletePreviousSurveyMessage(ctx) {
  try {
    const chatId = ctx.chat.id;
    const previousMessageId = await surveyService.getSurveyMessageId(chatId);

    if (previousMessageId) {
      await ctx.deleteMessage(previousMessageId);
      console.log(`🗑️ Удалено предыдущее сообщение опросника: ${previousMessageId}`);
    }
  } catch (error) {
    // Игнорируем ошибки удаления (сообщение могло быть уже удалено или недоступно)
    if (!error.message.includes('message to delete not found')) {
      console.log('⚠️ Не удалось удалить предыдущее сообщение опросника:', error.message);
    }
  }
}

// Обработка текстового ответа
async function handleTextAnswer(ctx) {
  const chatId = ctx.chat.id;
  const answer = ctx.message.text.trim();

  try {
    const question = await surveyService.getCurrentQuestion(chatId);

    if (!question) {
      await ctx.reply('❌ Сначала начните опрос: /survey');
      return;
    }

    if (question.options) {
      await ctx.reply('❌ Для этого вопроса используйте кнопки выбора');
      await sendQuestion(ctx); // Повторно отправляем вопрос
      return;
    }

    // Валидация ответа
    if (answer.length === 0) {
      await ctx.reply('❌ Пожалуйста, введите ответ');
      return;
    }

    if (['age', 'height', 'weight'].includes(question.key)) {
      const numValue = parseInt(answer);
      if (isNaN(numValue) || numValue <= 0) {
        await ctx.reply('❌ Пожалуйста, введите корректное положительное число');
        return;
      }

      // Дополнительная валидация для конкретных полей
      if (question.key === 'age' && (numValue < 10 || numValue > 120)) {
        await ctx.reply('❌ Пожалуйста, введите реальный возраст (10-120 лет)');
        return;
      }

      if (question.key === 'height' && (numValue < 100 || numValue > 250)) {
        await ctx.reply('❌ Пожалуйста, введите реальный рост (100-250 см)');
        return;
      }

      if (question.key === 'weight' && (numValue < 30 || numValue > 300)) {
        await ctx.reply('❌ Пожалуйста, введите реальный вес (30-300 кг)');
        return;
      }
    }

    // Сохраняем ответ
    await surveyService.saveAnswer(chatId, answer);
    await NotificationManager.success(ctx, '✅ Ответ сохранен!');

    // Небольшая задержка для лучшего UX
    setTimeout(() => {
      sendQuestion(ctx);
    }, 500);

  } catch (error) {
    console.error('❌ Ошибка обработки текстового ответа:', error);

    if (error.message.includes('корректное положительное число')) {
      await ctx.reply(`❌ ${error.message}\n\nПопробуйте еще раз:`);
    } else if (error.message.includes('Сессия опроса не найдена')) {
      await NotificationManager.error(ctx,
        'Сессия опроса устарела. Начните заново: /survey'
      );
    } else {
      await NotificationManager.error(ctx,
        'Ошибка сохранения ответа. Попробуйте еще раз:'
      );
    }

    // Повторно отправляем текущий вопрос
    await sendQuestion(ctx);
  }
}

// Обработка кнопочного ответа
async function handleButtonAnswer(ctx) {
  const callbackData = ctx.callbackQuery.data;
  console.log(`🔵 Обработка callback: ${callbackData}`);

  // Обрабатываем кнопку отмены опроса
  if (callbackData === 'cancel_survey') {
    await handleCancelSurvey(ctx);
    return;
  }

  // Обрабатываем кнопки опроса (формат q0a0)
  if (callbackData.startsWith('q') && callbackData.includes('a')) {
    await handleSurveyButtonAnswer(ctx);
  } else {
    // Для всех остальных кнопок просто отвечаем
    await ctx.answerCbQuery();
  }
}

// Обработка отмены опроса
async function handleCancelSurvey(ctx) {
  try {
    const chatId = ctx.chat.id;
    await surveyService.completeSurvey(chatId);

    await ctx.answerCbQuery('❌ Опрос отменен');

    try {
      await ctx.deleteMessage();
    } catch (deleteError) {
      console.log('⚠️ Не удалось удалить сообщение опроса');
    }

    await NotificationManager.info(ctx,
      'Опрос отменен. Вы можете начать заново когда будете готовы: /survey'
    );

    // Показываем главное меню
    const { showMainMenu } = require('./botController');
    showMainMenu(ctx);

  } catch (error) {
    console.error('❌ Ошибка отмены опроса:', error);
    await ctx.answerCbQuery('❌ Ошибка отмены опроса');
  }
}

// Обработка кнопок опроса
async function handleSurveyButtonAnswer(ctx) {
  const chatId = ctx.chat.id;

  try {
    const state = await surveyService.getUserState(chatId);

    if (!state) {
      console.log('❌ Нет состояния для пользователя');
      await ctx.answerCbQuery('❌ Сессия устарела. Начните заново: /survey');
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
      const questions = await surveyService.getQuestionsForUser(chatId);

      // Проверяем что это текущий вопрос
      if (questionIndex !== state.current) {
        console.log('⚠️ Несоответствие индекса вопроса');
        await ctx.answerCbQuery('❌ Вопрос устарел');
        return;
      }

      const question = questions[state.current];
      if (question && question.options && answerIndex < question.options.length) {
        // Сохраняем ответ и обновляем состояние
        const answer = question.options[answerIndex];
        state.answers[question.key] = answer;
        state.current++;

        await surveyService.saveUserData(chatId, state);

        console.log(`✅ Ответ сохранен: ${question.key} = ${answer}`);
        await ctx.answerCbQuery(`✅ Выбрано: ${answer}`);

        // Отправляем следующий вопрос
        await sendQuestion(ctx);

      } else {
        console.log('❌ Ошибка данных вопроса');
        await ctx.answerCbQuery('❌ Ошибка данных вопроса');
      }
    } else {
      console.log('❌ Неверный формат callback');
      await ctx.answerCbQuery('❌ Ошибка формата данных');
    }

  } catch (error) {
    console.error('❌ Ошибка обработки кнопки опроса:', error);
    await ctx.answerCbQuery('❌ Ошибка обработки ответа');
  }
}

// Завершение опроса
async function completeSurvey(ctx) {
  const chatId = ctx.chat.id;

  try {
    await deletePreviousSurveyMessage(ctx);

    await NotificationManager.loading(ctx, 'Анализируем ваши ответы...');

    const answers = await surveyService.getSurveyResults(chatId);

    if (!answers || Object.keys(answers).length === 0) {
      throw new Error('Не удалось получить результаты опроса');
    }

    const recommendations = recommendationService.generateRecommendations(answers);
    const message = recommendationService.formatRecommendations(recommendations);

    // Получаем тип подписки для клавиатуры
    const isPremium = await require('../services/subscriptionService').isSubscriptionActive(chatId);

    // Создаем напоминания для premium пользователей
    if (isPremium) {
      try {
        const { ReminderController } = require('./reminderController');
        const reminderController = new ReminderController(ctx.telegram);
        await reminderController.createRemindersFromRecommendations(ctx, recommendations);
      } catch (reminderError) {
        console.error('❌ Ошибка создания напоминаний:', reminderError);
      }
    }

    // Завершаем опрос
    await surveyService.completeSurvey(chatId);
    await surveyService.clearSurveyMessageId(chatId);

    // Отправляем результаты
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getSurveyCompletionKeyboard(isPremium)
    });

    console.log(`🎉 Опрос завершен для пользователя ${chatId}, дано рекомендаций: ${recommendations.length}`);

  } catch (error) {
    // Очищаем ID сообщения при ошибке
    await surveyService.clearSurveyMessageId(chatId);

    console.error('❌ Ошибка завершения опроса:', error);
    await NotificationManager.error(ctx,
      'Ошибка обработки результатов. Попробуйте снова: /survey'
    );
  }
}

async function handleCancelSurvey(ctx) {
  try {
    const chatId = ctx.chat.id;

    // Удаляем сообщение опросника
    await deletePreviousSurveyMessage(ctx);

    // Завершаем опрос
    await surveyService.completeSurvey(chatId);
    await surveyService.clearSurveyMessageId(chatId);

    await ctx.answerCbQuery('❌ Опрос отменен');

    await NotificationManager.info(ctx,
      'Опрос отменен. Вы можете начать заново когда будете готовы: /survey'
    );

    // Показываем главное меню
    const { showMainMenu } = require('./botController');
    showMainMenu(ctx);

  } catch (error) {
    console.error('❌ Ошибка отмены опроса:', error);
    await ctx.answerCbQuery('❌ Ошибка отмены опроса');
  }
}

// Генератор прогресс-бара
function generateProgressBar(current, total) {
  if (total === 0) return '';

  const percentage = Math.round((current / total) * 100);
  const filled = '█'.repeat(Math.round(percentage / 10));
  const empty = '░'.repeat(10 - filled.length);
  return `📊 Прогресс: [${filled}${empty}] ${percentage}% (${current}/${total})`;
}

module.exports = {
  handleStartSurvey,
  handleTextAnswer,
  handleButtonAnswer,
  handleCancelSurvey,
  completeSurvey,
  generateProgressBar
};
