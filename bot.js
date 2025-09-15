require('dotenv').config();
const Telegraf = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const db = require('./config/database');

// Импорты контроллеров
const botController = require('./controllers/botController');
const surveyController = require('./controllers/surveyController');
const subscriptionController = require('./controllers/subscriptionController');
const { ReminderController } = require('./controllers/reminderController');

// Middleware
const { injectSubscriptionData } = require('./middlewares/subscriptionMiddleware');

// Middleware для инъекции данных подписки
bot.use(injectSubscriptionData);

// Инициализация напоминаний
const reminderController = new ReminderController(bot);
reminderController.initialize().then(() => {
  console.log('✅ Сервис напоминаний инициализирован');
});

// ==================== СПЕЦИФИЧЕСКИЕ ОБРАБОТЧИКИ ====================

// 1. Обработка кнопок напоминаний (ПЕРВЫЕ!)
bot.action(/intake_(taken|skipped|later)_(\d+)/, async (ctx) => {
  const action = ctx.match[1];
  const reminderId = ctx.match[2];

  try {
    const db = require('./config/database');

    // Получаем информацию о напоминании
    db.get('SELECT * FROM reminders WHERE id = ?', [reminderId], async (err, reminder) => {
      if (err || !reminder) {
        ctx.answerCbQuery('❌ Напоминание не найдено');
        return;
      }

      let message;

      switch (action) {
        case 'taken':
          await reminderController.reminderService.recordIntake(ctx.chat.id, {
            supplement_name: reminder.supplement_name,
            dosage: reminder.dosage,
            status: 'taken'
          });
          message = '✅ Прием подтвержден!';
          break;

        case 'skipped':
          await reminderController.reminderService.recordIntake(ctx.chat.id, {
            supplement_name: reminder.supplement_name,
            dosage: reminder.dosage,
            status: 'skipped'
          });
          message = '⏭️ Прием пропущен';
          break;

        case 'later':
          message = '⏰ Напомню через 1 минуту';
          // Напомнить через 1 минуту (для теста)
          setTimeout(() => {
            ctx.reply(`⏰ Напоминание: ${reminder.supplement_name} (${reminder.dosage})`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '✅ Принял', callback_data: `intake_taken_${reminder.id}` },
                      { text: '⏰ Еще раз', callback_data: `intake_later_${reminder.id}` },
                      { text: '❌ Пропустить', callback_data: `intake_skipped_${reminder.id}` }
                    ]
                  ]
                }
              }
            );
          }, 60000);
          break;
      }

      ctx.answerCbQuery(message);

      // Пытаемся удалить сообщение
      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.log('Сообщение уже удалено или недоступно');
      }
    });

  } catch (error) {
    console.error('❌ Ошибка обработки напоминания:', error);
    ctx.answerCbQuery('❌ Ошибка обработки');
  }
});

// 2. Обработка истории
bot.action(/history_(\d+)/, (ctx) => {
  const days = parseInt(ctx.match[1]);
  reminderController.showIntakeHistory(ctx, days);
  ctx.answerCbQuery();
});

// 3. Другие специфические обработчики
bot.action('subscription_info', (ctx) => {
  subscriptionController.showSubscriptionPlans(ctx);
  ctx.answerCbQuery();
});

bot.action('main_menu', (ctx) => {
  botController.showMainMenu(ctx);
  ctx.answerCbQuery();
});

bot.action('restart_survey', (ctx) => {
  surveyController.handleStartSurvey(ctx);
  ctx.answerCbQuery();
});

bot.action('get_detailed_plan', (ctx) => {
  ctx.reply('💎 Детальный план доступен по подписке Premium!\n\nИспользуйте /subscribe для получения доступа.');
  ctx.answerCbQuery();
});

// ==================== КОМАНДЫ БОТА ====================

// Основные команды
bot.start(botController.handleStart);
bot.help(botController.handleHelp);
bot.command('survey', (ctx) => {
  surveyController.handleStartSurvey(ctx);
});
bot.command('plan', botController.handlePlan);
bot.command('profile', botController.handleProfile);
bot.command('help', botController.handleHelp);

// Команды подписки
bot.command('subscribe', subscriptionController.handleSubscribe);
bot.command('subscription', subscriptionController.showSubscriptionPlans);
bot.command('mysubscription', async (ctx) => {
  const subscriptionService = require('./services/subscriptionService');
  const subscription = await subscriptionService.getUserSubscription(ctx.chat.id);

  let message = `📋 *Ваша подписка:*\n\n`;
  message += `• План: ${subscription.plan === 'premium' ? '💎 Premium' : '🎁 Free'}\n`;
  message += `• Статус: ${subscription.status || 'active'}\n`;

  if (subscription.end_date) {
    const endDate = new Date(subscription.end_date);
    message += `• Действует до: ${endDate.toLocaleDateString('ru-RU')}\n`;
  }

  if (subscription.plan === 'free') {
    message += `\n💡 Для апгрейда используйте: /subscribe`;
  }

  ctx.reply(message, {
    parse_mode: 'Markdown',
    ...require('./keyboards').getMainMenuKeyboard()
  });
});

// Тестовые команды
bot.command('testreminder', async (ctx) => {
  try {
    const ReminderService = require('./services/reminderService');
    const service = new ReminderService(ctx.telegram);

    // Текущее время + 1 минута
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    const timeString = now.toTimeString().slice(0, 5);

    await service.createReminder(ctx.chat.id, {
      supplement_name: 'Тестовая добавка',
      dosage: '500 мг',
      time: timeString,
      days: '1111111'
    });

    ctx.reply(`⏰ Тестовое напоминание создано!\nСработает в ${timeString}`);

  } catch (error) {
    console.error('❌ Ошибка testreminder:', error);
    ctx.reply('❌ Ошибка: ' + error.message);
  }
});

// ==================== ОБЩИЕ ОБРАБОТЧИКИ ====================

// Обработка текстовых сообщений
bot.on('text', (ctx) => {
  const chatId = ctx.chat.id;

  // Проверяем, находится ли пользователь в опросе
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

// ОБЩИЙ ОБРАБОТЧИК CALLBACK_QUERY (ПОСЛЕДНИЙ!)
bot.on('callback_query', (ctx) => {
  const callbackData = ctx.callbackQuery.data;

  // Если callback еще не обработан специфическими обработчиками
  // и это не кнопка напоминания, передаем в surveyController
  if (!callbackData.startsWith('intake_') &&
      !callbackData.startsWith('history_') &&
      callbackData !== 'subscription_info' &&
      callbackData !== 'main_menu' &&
      callbackData !== 'restart_survey' &&
      callbackData !== 'get_detailed_plan') {

    surveyController.handleButtonAnswer(ctx);
  }
});

// ==================== ЗАПУСК И ОБРАБОТКА ОШИБОК ====================

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error('❌ Ошибка бота:', err);
  ctx.reply('⚠️ Произошла ошибка. Попробуйте снова: /start');
});

// Запуск бота
bot.launch().then(() => {
  console.log('🤖 Бот запущен');
}).catch(err => {
  console.error('❌ Ошибка запуска бота:', err);
});

// Graceful shutdown
process.once('SIGINT', async () => {
  console.log('🔄 Получен SIGINT, останавливаем бота...');
  try {
    await bot.stop();
    console.log('✅ Бот корректно остановлен');
  } catch (error) {
    console.error('❌ Ошибка остановки бота:', error);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('❌ Ошибка закрытия БД:', err);
      } else {
        console.log('✅ БД соединение закрыто');
      }
      process.exit(0);
    });
  }
});

process.once('SIGTERM', async () => {
  console.log('🔄 Получен SIGTERM, останавливаем бота...');
  try {
    await bot.stop();
    console.log('✅ Бот корректно остановлен');
  } catch (error) {
    console.error('❌ Ошибка остановки бота:', error);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('❌ Ошибка закрытия БД:', err);
      } else {
        console.log('✅ БД соединение закрыто');
      }
      process.exit(0);
    });
  }
});
