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
const { getMainMenuKeyboard } = require('./keyboards');

// Утилиты
const NotificationManager = require('./utils/notifications');

// Инициализация напоминаний
const reminderController = new ReminderController(bot);
reminderController.initialize().then(() => {
  console.log('✅ Сервис напоминаний инициализирован');
});

// ==================== MIDDLEWARE ====================

// Инъекция данных подписки
bot.use(injectSubscriptionData);

// Логирование всех сообщений
bot.use(async (ctx, next) => {
  const chatId = ctx.chat?.id;
  const username = ctx.from?.username || 'unknown';
  const text = ctx.message?.text || ctx.callbackQuery?.data || 'no text';

  console.log(`📨 [${username}:${chatId}] ${text}`);
  await next();
});

// ==================== ОСНОВНЫЕ КОМАНДЫ ====================

bot.start(async (ctx) => {
  await NotificationManager.welcome(ctx, ctx.from.first_name);
  botController.handleStart(ctx);
});

bot.help((ctx) => {
  NotificationManager.info(ctx, 'Вот что я умею:');
  botController.handleHelp(ctx);
});

bot.command('survey', (ctx) => {
  NotificationManager.loading(ctx, 'Загружаем опрос...');
  setTimeout(() => {
    surveyController.handleStartSurvey(ctx);
  }, 500);
});

bot.command('plan', (ctx) => {
  NotificationManager.loading(ctx, 'Формируем рекомендации...');
  setTimeout(() => {
    botController.handlePlan(ctx);
  }, 500);
});

bot.command('profile', (ctx) => {
  NotificationManager.loading(ctx, 'Загружаем профиль...');
  setTimeout(() => {
    botController.handleProfile(ctx);
  }, 500);
});

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
  } else {
    message += `\n✨ Вы наслаждаетесь всеми преимуществами Premium подписки!`;
  }

  ctx.reply(message, {
    parse_mode: 'Markdown',
    ...getMainMenuKeyboard(subscription.plan === 'premium')
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
bot.command('testbuttons', (ctx) => testCommands.testButtons(ctx));
bot.command('testremindersnow', (ctx) => testCommands.testRemindersNow(ctx));
bot.command('createremindersfromplan', (ctx) => testCommands.createRemindersFromPlan(ctx));

// Команды истории и статистики
bot.command('myhistory', async (ctx) => {
  try {
    const ReminderService = require('./services/reminderService');
    const service = new ReminderService(ctx.telegram);
    const history = await service.getIntakeHistory(ctx.chat.id, 7);

    if (history.length === 0) {
      await NotificationManager.info(ctx, '📊 История приема пуста за последние 7 дней.');
      return;
    }

    let message = '📊 *История приема (7 дней):*\n\n';
    history.forEach((item, index) => {
      const date = new Date(item.taken_at).toLocaleDateString('ru-RU');
      const time = new Date(item.taken_at).toLocaleTimeString('ru-RU', {
        hour: '2-digit', minute: '2-digit'
      });
      const statusIcon = item.status === 'taken' ? '✅' : item.status === 'skipped' ? '⏭️' : '❌';
      message += `${statusIcon} ${date} ${time} - ${item.supplement_name}\n`;
    });

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...require('./keyboards').getIntakeHistoryKeyboard()
    });

  } catch (error) {
    console.error('❌ Ошибка myhistory:', error);
    await NotificationManager.error(ctx, 'Ошибка загрузки истории');
  }
});

bot.command('mystats', async (ctx) => {
  try {
    const ReminderService = require('./services/reminderService');
    const service = new ReminderService(ctx.telegram);
    const stats = await service.getIntakeStats(ctx.chat.id, 30);

    const message = `📈 *Ваша статистика за 30 дней:*\n\n` +
                   `✅ Принято: ${stats.taken}\n` +
                   `⏭️ Пропущено: ${stats.skipped}\n` +
                   `❌ Пропущено: ${stats.missed}\n` +
                   `📊 Соблюдение: ${stats.compliance}%`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard()
    });

  } catch (error) {
    console.error('❌ Ошибка mystats:', error);
    await NotificationManager.error(ctx, 'Ошибка загрузки статистики');
  }
});

// ==================== ОБРАБОТКА КНОПОК НАПОМИНАНИЙ ====================

// Обработка кнопки "✅ Принял"
bot.action(/intake_taken_(\d+)/, async (ctx) => {
  console.log('🔵 Обработка кнопки Принял для reminder:', ctx.match[1]);
  try {
    const reminderId = ctx.match[1];

    db.get('SELECT * FROM reminders WHERE id = ?', [reminderId], async (err, reminder) => {
      if (err) {
        console.error('❌ Ошибка БД:', err);
        await ctx.answerCbQuery('❌ Ошибка базы данных');
        return;
      }

      if (!reminder) {
        console.log('❌ Напоминание не найдено ID:', reminderId);
        await ctx.answerCbQuery('❌ Напоминание не найдено');
        return;
      }

      console.log('📝 Записываем прием для:', reminder.supplement_name);

      try {
        const ReminderService = require('./services/reminderService');
        const service = new ReminderService(ctx.telegram);

        await service.recordIntake(ctx.chat.id, {
          supplement_name: reminder.supplement_name,
          dosage: reminder.dosage,
          status: 'taken'
        });

        console.log('✅ Прием записан в историю');
        await ctx.answerCbQuery('✅ Прием подтвержден!');

        // Удаляем сообщение с кнопками
        try {
          await ctx.deleteMessage();
          console.log('🗑️ Сообщение удалено');
        } catch (deleteError) {
          console.log('⚠️ Не удалось удалить сообщение:', deleteError.message);
        }

        // Отправляем подтверждение
        await NotificationManager.success(ctx, `💊 Прием "${reminder.supplement_name}" записан!`);

      } catch (error) {
        console.error('❌ Ошибка записи приема:', error);
        await ctx.answerCbQuery('❌ Ошибка подтверждения');
      }
    });

  } catch (error) {
    console.error('❌ Общая ошибка обработки:', error);
    await ctx.answerCbQuery('❌ Ошибка обработки');
  }
});

// Обработка кнопки "❌ Пропустить"
bot.action(/intake_skipped_(\d+)/, async (ctx) => {
  console.log('🔵 Обработка кнопки Пропустить для reminder:', ctx.match[1]);
  try {
    const reminderId = ctx.match[1];

    db.get('SELECT * FROM reminders WHERE id = ?', [reminderId], async (err, reminder) => {
      if (err || !reminder) {
        await ctx.answerCbQuery('❌ Напоминание не найдено');
        return;
      }

      try {
        const ReminderService = require('./services/reminderService');
        const service = new ReminderService(ctx.telegram);

        await service.recordIntake(ctx.chat.id, {
          supplement_name: reminder.supplement_name,
          dosage: reminder.dosage,
          status: 'skipped'
        });

        await ctx.answerCbQuery('⏭️ Прием пропущен');

        try {
          await ctx.deleteMessage();
        } catch (deleteError) {
          console.log('⚠️ Не удалось удалить сообщение');
        }

        await NotificationManager.warning(ctx, `💊 Прием "${reminder.supplement_name}" пропущен.`);

      } catch (error) {
        console.error('❌ Ошибка записи пропуска:', error);
        await ctx.answerCbQuery('❌ Ошибка обработки пропуска');
      }
    });

  } catch (error) {
    console.error('❌ Общая ошибка обработки пропуска:', error);
    await ctx.answerCbQuery('❌ Ошибка обработки');
  }
});

// Обработка кнопки "⏰ Напомнить позже"
bot.action(/intake_later_(\d+)/, async (ctx) => {
  console.log('🔵 Обработка кнопки Напомнить позже для reminder:', ctx.match[1]);
  try {
    const reminderId = ctx.match[1];

    db.get('SELECT * FROM reminders WHERE id = ?', [reminderId], async (err, reminder) => {
      if (err || !reminder) {
        await ctx.answerCbQuery('❌ Напоминание не найдено');
        return;
      }

      await ctx.answerCbQuery('⏰ Напомню через 10 минут');

      try {
        await ctx.deleteMessage();
      } catch (deleteError) {
        console.log('⚠️ Сообщение уже удалено');
      }

      // Напомнить через 10 минут
      setTimeout(async () => {
        try {
          const { getReminderActionsKeyboard } = require('./keyboards');

          await ctx.reply(
            `⏰ *Напоминание (повторно)!*\n\n💊 ${reminder.supplement_name}\n📏 ${reminder.dosage}\n\nПодтвердите прием:`,
            {
              parse_mode: 'Markdown',
              ...getReminderActionsKeyboard(reminder.id)
            }
          );
        } catch (error) {
          console.error('❌ Ошибка повторного напоминания:', error);
        }
      }, 600000); // 10 минут

      await NotificationManager.info(ctx, `⏰ Напомню о приеме "${reminder.supplement_name}" через 10 минут.`);
    });

  } catch (error) {
    console.error('❌ Ошибка обработки напоминания позже:', error);
    await ctx.answerCbQuery('❌ Ошибка отложенного напоминания');
  }
});

// Обработка тестового платежа
bot.action('test_payment', async (ctx) => {
  try {
    ctx.answerCbQuery('💳 Тестовый платеж создан!');

    // Имитируем успешный платеж через 2 секунды
    setTimeout(async () => {
      await ctx.reply('✅ Тестовый платеж успешно обработан!');
      await subscriptionController.handlePaymentConfirmation(ctx);
    }, 2000);

  } catch (error) {
    console.error('❌ Ошибка тестового платежа:', error);
    ctx.answerCbQuery('❌ Ошибка платежа');
  }
});

// Обработка "Я оплатил(а)"
bot.action('payment_confirmed', async (ctx) => {
  try {
    await subscriptionController.handlePaymentConfirmation(ctx);
    ctx.answerCbQuery('✅ Подписка активирована!');
  } catch (error) {
    console.error('❌ Ошибка активации подписки:', error);
    ctx.answerCbQuery('❌ Ошибка активации');
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
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const chatId = ctx.chat.id;

  console.log(`📨 Текст получен: "${text}" от ${chatId}`);

  // Сначала проверяем, это ли команды главного меню
  const menuCommands = [
    '📋 Пройти опрос',
    '💊 Мои рекомендации',
    '👤 Мой профиль',
    '💳 Подписка',
    'ℹ️ Помощь',
    '⏰ Утреннее время',
    '🌅 Дневное время',
    '🌙 Вечернее время',
    '🔔 Вкл/Выкл уведомления',
    '🏠 Главное меню'
  ];

  if (menuCommands.includes(text)) {
    console.log('🔍 Это команда меню, передаем в botController');
    botController.handleTextCommands(ctx);
    return;
  }

  // Проверяем, находится ли пользователь в опросе
  try {
    const surveyService = require('./services/surveyService');
    const question = await surveyService.getCurrentQuestion(chatId);

    if (question) {
      console.log('🔍 Пользователь в опросе, передаем в surveyController');
      surveyController.handleTextAnswer(ctx);
    } else {
      console.log('🔍 Пользователь не в опросе, передаем в botController');
      botController.handleTextCommands(ctx);
    }
  } catch (error) {
    console.error('❌ Ошибка проверки состояния опроса:', error);
    botController.handleTextCommands(ctx);
  }
});

// ==================== ЗАПУСК И ОБРАБОТКА ОШИБОК ====================

// Диагностика callback_data
bot.on('callback_query', (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  console.log('📨 Callback received:', ctx.callbackQuery.data);

    // Если callback еще не обработан специфическими обработчиками
  if (!callbackData.startsWith('intake_') &&
      !callbackData.startsWith('history_') &&
      callbackData !== 'subscription_info' &&
      callbackData !== 'main_menu' &&
      callbackData !== 'restart_survey' &&
      callbackData !== 'get_detailed_plan') {

      // Передаем в обработчик опросов
      require('./controllers/surveyController').handleButtonAnswer(ctx);
    }
});

// Глобальный обработчик ошибок
bot.catch((err, ctx) => {
  console.error('❌ Глобальная ошибка:', err);

  const NotificationManager = require('./utils/notifications');
  NotificationManager.error(ctx,
    `Произошла непредвиденная ошибка. Пожалуйста, попробуйте снова через несколько минут.\n\n` +
    `Если ошибка повторяется, используйте /help для связи с поддержкой.`
  );
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
