require('dotenv').config();
const Telegraf = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const db = require('./config/database');

// Импорты контроллеров
const botController = require('./controllers/botController');
const surveyController = require('./controllers/surveyController');

// Команды
bot.start(botController.handleStart);
bot.help(botController.handleHelp);
bot.command('survey', surveyController.handleStartSurvey);
bot.command('plan', botController.handlePlan);
bot.command('profile', botController.handleProfile);
bot.command('help', botController.handleHelp);

// Обработка текстовых сообщений
bot.on('text', (ctx) => {
  // Проверяем, находится ли пользователь в опросе
  const chatId = ctx.chat.id;
  require('./services/surveyService').getCurrentQuestion(chatId)
    .then(question => {
      if (question) {
        surveyController.handleTextAnswer(ctx);
      } else {
        botController.handleTextCommands(ctx);
      }
    })
    .catch(() => botController.handleTextCommands(ctx));
});

// Обработка inline-кнопок
bot.on('callback_query', (ctx) => {
  const callbackData = ctx.callbackQuery.data;

  if (callbackData === 'get_detailed_plan') {
    ctx.reply('💎 Детальный план с дозировками доступен по подписке. Используй /subscribe для информации');
    ctx.answerCbQuery();
  } else if (callbackData === 'restart_survey') {
    surveyController.handleStartSurvey(ctx);
    ctx.answerCbQuery();
  } else {
    surveyController.handleButtonAnswer(ctx);
  }
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error('❌ Ошибка бота:', err);
  ctx.reply('⚠️ Произошла ошибка. Попробуй снова: /start');
});

// Запуск бота
bot.launch().then(() => {
  console.log('🤖 Бот запущен');
}).catch(err => {
  console.error('❌ Ошибка запуска бота:', err);
});

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('🔄 Остановка бота...');
  bot.stop('SIGINT');
  db.close();
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('🔄 Остановка бота...');
  bot.stop('SIGTERM');
  db.close();
  process.exit(0);
});
