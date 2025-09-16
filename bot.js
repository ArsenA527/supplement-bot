require('dotenv').config();
const Telegraf = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const db = require('./config/database');

// Импорты контроллеров
const botController = require('./controllers/botController');
const surveyController = require('./controllers/surveyController');
const subscriptionController = require('./controllers/subscriptionController');
const { ReminderController } = require('./controllers/reminderController');
const testCommands = require('./commands/testCommands');

// Middleware
const { injectSubscriptionData } = require('./middlewares/subscriptionMiddleware');

// Middleware для инъекции данных подписки
bot.use(injectSubscriptionData);

// Инициализация напоминаний
const reminderController = new ReminderController(bot);
reminderController.initialize().then(() => {
  console.log('✅ Сервис напоминаний инициализирован');
});

// ==================== ОСНОВНЫЕ КОМАНДЫ ====================

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

// ==================== ТЕСТОВЫЕ КОМАНДЫ ====================

bot.command('testremindernow', (ctx) => testCommands.testReminderNow(ctx));
bot.command('myreminders', (ctx) => testCommands.showMyReminders(ctx));
bot.command('checkhistory', (ctx) => testCommands.checkHistory(ctx));
bot.command('reminderstats', (ctx) => testCommands.reminderStats(ctx));
bot.command('debugsub', (ctx) => testCommands.debugSubscription(ctx));
bot.command('activatepremium', (ctx) => testCommands.activatePremium(ctx));
bot.command('clearmydata', (ctx) => testCommands.clearMyData(ctx));
bot.command('testquestions', (ctx) => testCommands.testQuestions(ctx));
bot.command('myhistory', (ctx) => testCommands.checkHistory(ctx));
bot.command('mystats', (ctx) => testCommands.reminderStats(ctx));
bot.command('testbuttons', async (ctx) => {
  try {
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Принял', callback_data: 'intake_taken_999' },
            { text: '⏰ Напомнить позже', callback_data: 'intake_later_999' },
            { text: '❌ Пропустить', callback_data: 'intake_skipped_999' }
          ]
        ]
      }
    };

    await ctx.reply(
      `⏰ *ТЕСТ КНОПОК!*\n\n💊 Тестовая добавка\n📏 500 мг\n\nПроверьте кнопки:`,
      { parse_mode: 'Markdown', ...keyboard }
    );

    ctx.reply('✅ Тестовые кнопки созданы! Проверьте их работу.');

  } catch (error) {
    console.error('❌ Ошибка testbuttons:', error);
    ctx.reply('❌ Ошибка создания тестовых кнопок');
  }
});

// ==================== ОБРАБОТКА КНОПОК НАПОМИНАНИЙ ====================

// Обработка кнопки "✅ Принял"
bot.action(/intake_taken_(\d+)/, async (ctx) => {
  console.log('🔵 Обработка кнопки Принял для reminder:', ctx.match[1]);
  try {
    const reminderId = ctx.match[1];

    // Получаем информацию о напоминании
    db.get('SELECT * FROM reminders WHERE id = ?', [reminderId], async (err, reminder) => {
      if (err) {
        console.error('❌ Ошибка БД:', err);
        ctx.answerCbQuery('❌ Ошибка базы данных');
        return;
      }

      if (!reminder) {
        console.log('❌ Напоминание не найдено ID:', reminderId);
        ctx.answerCbQuery('❌ Напоминание не найдено');
        return;
      }

      console.log('📝 Записываем прием для:', reminder.supplement_name);

      // Записываем в историю как "принято"
      try {
        const ReminderService = require('./services/reminderService');
        const service = new ReminderService(ctx.telegram);

        await service.recordIntake(ctx.chat.id, {
          supplement_name: reminder.supplement_name,
          dosage: reminder.dosage,
          status: 'taken'
        });

        console.log('✅ Прием записан в историю');

        ctx.answerCbQuery('✅ Прием подтвержден!');

        // Удаляем сообщение с кнопками
        try {
          await ctx.deleteMessage();
          console.log('🗑️ Сообщение удалено');
        } catch (deleteError) {
          console.log('⚠️ Не удалось удалить сообщение:', deleteError.message);
        }

        // Отправляем подтверждение
        await ctx.reply(`💊 Прием "${reminder.supplement_name}" записан!`);

      } catch (error) {
        console.error('❌ Ошибка записи приема:', error);
        ctx.answerCbQuery('❌ Ошибка подтверждения');
      }
    });

  } catch (error) {
    console.error('❌ Общая ошибка обработки:', error);
    ctx.answerCbQuery('❌ Ошибка обработки');
  }
});

// Обработка кнопки "❌ Пропустить"
bot.action(/intake_skipped_(\d+)/, async (ctx) => {
  console.log('🔵 Обработка кнопки Пропустить для reminder:', ctx.match[1]);
  try {
    const reminderId = ctx.match[1];

    db.get('SELECT * FROM reminders WHERE id = ?', [reminderId], async (err, reminder) => {
      if (err || !reminder) {
        ctx.answerCbQuery('❌ Напоминание не найдено');
        return;
      }

      // Записываем в историю как "пропущено"
      try {
        const ReminderService = require('./services/reminderService');
        const service = new ReminderService(ctx.telegram);

        await service.recordIntake(ctx.chat.id, {
          supplement_name: reminder.supplement_name,
          dosage: reminder.dosage,
          status: 'skipped'
        });

        ctx.answerCbQuery('⏭️ Прием пропущен');

        // Удаляем сообщение с кнопками
        try {
          await ctx.deleteMessage();
        } catch (deleteError) {
          console.log('Не удалось удалить сообщение');
        }

        // Отправляем подтверждение
        await ctx.reply(`💊 Прием "${reminder.supplement_name}" пропущен.`);

      } catch (error) {
        console.error('❌ Ошибка записи пропуска:', error);
        ctx.answerCbQuery('❌ Ошибка обработки пропуска');
      }
    });

  } catch (error) {
    console.error('❌ Общая ошибка обработки пропуска:', error);
    ctx.answerCbQuery('❌ Ошибка обработки');
  }
});

// Обработка кнопки "⏰ Напомнить позже"
bot.action(/intake_later_(\d+)/, async (ctx) => {
  console.log('🔵 Обработка кнопки Напомнить позже для reminder:', ctx.match[1]);
  try {
    const reminderId = ctx.match[1];

    db.get('SELECT * FROM reminders WHERE id = ?', [reminderId], async (err, reminder) => {
      if (err || !reminder) {
        ctx.answerCbQuery('❌ Напоминание не найдено');
        return;
      }

      ctx.answerCbQuery('⏰ Напомню через 1 минуту');

      // Удаляем оригинальное сообщение
      try {
        await ctx.deleteMessage();
      } catch (deleteError) {
        console.log('Сообщение уже удалено');
      }

      // Напомнить через 1 минуту (для теста)
      setTimeout(async () => {
        try {
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Принял', callback_data: `intake_taken_${reminder.id}` },
                  { text: '⏰ Еще раз', callback_data: `intake_later_${reminder.id}` },
                  { text: '❌ Пропустить', callback_data: `intake_skipped_${reminder.id}` }
                ]
              ]
            }
          };

          await ctx.reply(
            `⏰ *Напоминание (повторно)!*\n\n💊 ${reminder.supplement_name}\n📏 ${reminder.dosage}\n\nПодтвердите прием:`,
            { parse_mode: 'Markdown', ...keyboard }
          );
        } catch (error) {
          console.error('❌ Ошибка повторного напоминания:', error);
        }
      }, 60000); // 1 минута

      await ctx.reply(`⏰ Напомню о приеме "${reminder.supplement_name}" через 1 минуту.`);
    });

  } catch (error) {
    console.error('❌ Ошибка обработки напоминания позже:', error);
    ctx.answerCbQuery('❌ Ошибка отложенного напоминания');
  }
});

// ==================== ДРУГИЕ ОБРАБОТЧИКИ ACTION ====================

bot.action(/history_(\d+)/, (ctx) => {
  const days = parseInt(ctx.match[1]);
  reminderController.showIntakeHistory(ctx, days);
  ctx.answerCbQuery();
});

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

// ==================== ОБРАБОТКА ТЕКСТА ====================

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

// ==================== ЗАПУСК И ОБРАБОТКА ОШИБОК ====================

// Диагностика callback_data
bot.on('callback_query', (ctx) => {
  console.log('📨 Callback received:', ctx.callbackQuery.data);
  // Продолжаем обычную обработку
});

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
