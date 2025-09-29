const path = require('path');

const envName = process.env.NODE_ENV || 'development';
const envFile = `.env.${envName}`;

console.log('🔧 Загрузка окружения:');
console.log('   NODE_ENV из process.env:', process.env.NODE_ENV);
console.log('   Будем использовать файл:', envFile);

require('dotenv').config({
  path: path.resolve(__dirname, envFile)
});

console.log('🔍 После загрузки dotenv:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   BOT_TOKEN exists:', !!process.env.BOT_TOKEN);
console.log('   BOT_TOKEN length:', process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 0);

if (!process.env.BOT_TOKEN) {
  console.log('⚠️ BOT_TOKEN не найден, пробуем .env');
  require('dotenv').config(); // Загружаем обычный .env

  if (!process.env.BOT_TOKEN) {
    console.error('❌ CRITICAL: BOT_TOKEN не найден ни в одном .env файле!');
    console.log('📁 Проверьте файлы в директории:', __dirname);

    // Покажем какие файлы есть
    const fs = require('fs');
    const files = fs.readdirSync(__dirname);
    console.log('📋 Файлы в директории:', files.filter(f => f.includes('.env')));

    process.exit(1);
  }
}

console.log('✅ Окружение загружено успешно!');
console.log('   BOT_TOKEN:', process.env.BOT_TOKEN ? '***' + process.env.BOT_TOKEN.slice(-5) : 'NOT FOUND');

const logger = require('./utils/logger');

logger.info('🚀 Запуск Supplement Bot', {
  nodeEnv: process.env.NODE_ENV,
  timestamp: new Date().toISOString()
});

const Telegraf = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const db = require('./config/database');
global.botInstance = bot
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

const ReminderService = require('./services/reminderService');
const subscriptionService = require('./services/subscriptionService');
const reminderService = new ReminderService(bot); // Явно создаем экземпляр
const analyticsService = require('./services/analyticsService');
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
  await analyticsService.trackEvent(ctx.chat.id, 'bot_start', {
    username: ctx.from.username,
    first_name: ctx.from.first_name
  });

  await NotificationManager.welcome(ctx, ctx.from.first_name);
  botController.handleStart(ctx);
});

bot.help((ctx) => {
  NotificationManager.info(ctx, 'Вот что я умею:');
  botController.handleHelp(ctx);
});

bot.command('survey', (ctx) => {
  analyticsService.trackEvent(ctx.chat.id, 'survey_start');
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
bot.command('checkmenu', (ctx) => testCommands.checkMenuStatus(ctx));

bot.command('createtestreminder', (ctx) => {
  const time = ctx.message.text.split(' ')[1]; // /createtestreminder 14:30
  testCommands.createTestReminder(ctx, time);
});

bot.command('forcereminders', (ctx) => testCommands.forceSendReminders(ctx));
bot.command('cleartestreminders', (ctx) => testCommands.clearTestReminders(ctx));
bot.command('reminderstatus', (ctx) => testCommands.reminderStatus(ctx));

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

// Команды бэкапов
bot.command('backupstatus', (ctx) => testCommands.backupStatus(ctx));
bot.command('backupnow', (ctx) => testCommands.createBackupNow(ctx));

// Команды аналитики (только для админа)
bot.command('analytics', (ctx) => testCommands.analyticsDashboard(ctx));
bot.command('surveystats', (ctx) => testCommands.surveyAnalytics(ctx));
bot.command('dailyreport', (ctx) => testCommands.forceDailyReport(ctx));

// ==================== ОБРАБОТКА КНОПОК НАПОМИНАНИЙ ====================

// Обработка кнопки "✅ Принял"
bot.action(/intake_taken_(\d+)/, async (ctx) => {
  console.log('🔵 Обработка кнопки Принял для reminder:', ctx.match[1]);
  try {
    const reminderId = ctx.match[1];
    const action = 'taken';

    analyticsService.trackEvent(ctx.chat.id, 'reminder_interaction', {
      action: action,
      reminder_id: ctx.match[2]
    });

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
    const action = 'skipped';


    analyticsService.trackEvent(ctx.chat.id, 'reminder_interaction', {
      action: action,
      reminder_id: ctx.match[2]
    });

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

// ==================== ПЛАТЕЖИ И ПОДПИСКИ ====================

// Обработка тестового платежа
bot.action('test_payment', async (ctx) => {
  try {
    await ctx.answerCbQuery('💳 Тестовый платеж создан!');

    // Имитируем успешный платеж через 2 секунды
    setTimeout(async () => {
      await NotificationManager.success(ctx, '✅ Тестовый платеж успешно обработан!');
      await subscriptionController.handlePaymentConfirmation(ctx);
    }, 2000);

  } catch (error) {
    console.error('❌ Ошибка тестового платежа:', error);
    await ctx.answerCbQuery('❌ Ошибка платежа');
  }
});

// Обработка "✅ Я оплатил(а)"
bot.action('payment_confirmed', async (ctx) => {
  try {
    await subscriptionController.handlePaymentConfirmation(ctx);
    await ctx.answerCbQuery('✅ Подписка активирована!');
  } catch (error) {
    console.error('❌ Ошибка активации подписки:', error);
    await ctx.answerCbQuery('❌ Ошибка активации');
  }
});

// ==================== ДРУГИЕ ОБРАБОТЧИКИ ACTION ====================

bot.action(/history_(\d+)/, (ctx) => {
  const days = parseInt(ctx.match[1]);
  reminderController.showIntakeHistory(ctx, days);
  ctx.answerCbQuery();
});

bot.action('subscription_info', async (ctx) => {
  const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id);
  await subscriptionController.showSubscriptionPlans(ctx);
  await ctx.answerCbQuery();
});

bot.action('main_menu', async (ctx) => {
  const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id);
  const { showMainMenu } = require('./controllers/botController');
  await showMainMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action('restart_survey', (ctx) => {
  surveyController.handleStartSurvey(ctx);
  ctx.answerCbQuery();
});

bot.action('get_detailed_plan', (ctx) => {
  ctx.reply('💎 Детальный план доступен по подписке Premium!\n\nИспользуйте /subscribe для получения доступа.');
  ctx.answerCbQuery();
});

bot.action('cancel_survey', async (ctx) => {
  try {
    const surveyService = require('./services/surveyService');
    await surveyService.completeSurvey(ctx.chat.id);
    await ctx.answerCbQuery('❌ Опрос отменен');
    await ctx.deleteMessage();
    await NotificationManager.info(ctx, 'Опрос отменен. Можете начать заново когда будете готовы.');
    botController.showMainMenu(ctx);
  } catch (error) {
    console.error('❌ Ошибка отмены опроса:', error);
    await ctx.answerCbQuery('❌ Ошибка отмены');
  }
});

// ==================== ОБРАБОТКА ТЕКСТА ====================

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  try {
    const text = ctx.message.text;
    const chatId = ctx.chat.id;

    console.log(`📨 Текст получен: "${text}" от ${chatId}`);

    // Команды главного меню
    const menuCommands = [
      '📋 Пройти опрос', '📋 Новый опрос', '💊 Мои рекомендации',
      '👤 Мой профиль', '💎 Апгрейд до Premium', '💎 Получить Premium',
      '⏰ Мои напоминания', '📊 Статистика', 'ℹ️ Помощь', '⚙️ Настройки',
      '⏰ Утреннее время', '🌅 Дневное время', '🌙 Вечернее время',
      '🔔 Вкл/Выкл уведомления', '📋 Мои напоминания', '🏠 Главное меню'
    ];

    if (menuCommands.includes(text)) {
      console.log('🔍 Это команда меню, передаем в botController');
      await botController.handleTextCommands(ctx);
      return;
    }

    // Проверяем, находится ли пользователь в опросе
    const surveyService = require('./services/surveyService');
    const question = await surveyService.getCurrentQuestion(chatId);

    if (question) {
      console.log('🔍 Пользователь в опросе, передаем в surveyController');
      await surveyController.handleTextAnswer(ctx);
    } else {
      console.log('🔍 Пользователь не в опросе, передаем в botController');
      await botController.handleTextCommands(ctx);
    }

  } catch (error) {
    console.error('❌ Ошибка обработки текста:', error);
    await NotificationManager.error(ctx, 'Ошибка обработки сообщения. Попробуйте еще раз.');
  }
});

// ==================== ЗАПУСК И ОБРАБОТКА ОШИБОК ====================

bot.on('callback_query', (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  console.log('📨 Callback received:', callbackData);

  // Если callback еще не обработан специфическими обработчиками
  if (!callbackData.startsWith('intake_') &&
      !callbackData.startsWith('history_') &&
      !callbackData.startsWith('admin_') &&
      callbackData !== 'subscription_info' &&
      callbackData !== 'main_menu' &&
      callbackData !== 'restart_survey' &&
      callbackData !== 'get_detailed_plan' &&
      callbackData !== 'payment_confirmed' &&
      callbackData !== 'test_payment' &&
      callbackData !== 'cancel_survey') {

    // Передаем в обработчик опросов
    require('./controllers/surveyController').handleButtonAnswer(ctx);
  }
});

// Глобальный обработчик ошибок
bot.catch((err, ctx) => {
  logger.error('Ошибка бота', {
    error: err.message,
    stack: err.stack,
    chatId: ctx.chat?.id
  });

  console.error('❌ Глобальная ошибка:', err);

  const NotificationManager = require('./utils/notifications');
  NotificationManager.error(ctx,
    `Произошла непредвиденная ошибка. Пожалуйста, попробуйте снова через несколько минут.\n\n` +
    `Если ошибка повторяется, используйте /help для связи с поддержкой.`
  );
});

// 🕐 АВТОМАТИЧЕСКИЕ ЕЖЕДНЕВНЫЕ ОТЧЕТЫ
function setupDailyReports() {
  // Отчет каждый день в 09:00
  const now = new Date();
  const targetTime = new Date();
  targetTime.setHours(9, 0, 0, 0);

  if (now > targetTime) {
    targetTime.setDate(targetTime.getDate() + 1);
  }

  const timeUntilReport = targetTime - now;

  setTimeout(() => {
    analyticsService.generateDailyReport();
    // Повторяем каждые 24 часа
    setInterval(() => analyticsService.generateDailyReport(), 24 * 60 * 60 * 1000);
  }, timeUntilReport);

  logger.info('Ежедневные отчеты настроены');
}

// Запуск бота
bot.launch().then(() => {
  console.log('🤖 Бот запущен');
  setupDailyReports();
}).catch(err => {
  console.error('❌ Ошибка запуска бота:', err);
});

// Добавляем обработку неизвестных команд
bot.on('message', (ctx) => {
  if (ctx.message && ctx.message.text && ctx.message.text.startsWith('/')) {
    console.log(`❓ Неизвестная команда: ${ctx.message.text}`);
    ctx.reply(
      '❓ Неизвестная команда. Используйте /help для списка команд.',
      getMainMenuKeyboard()
    );
  }
});

// Команда /myid - только для админа
bot.command('myid', (ctx) => {
  const chatId = ctx.chat.id;
  const adminId = process.env.ADMIN_CHAT_ID;

  if (chatId.toString() === adminId) {
    ctx.reply(`🆔 Ваш Chat ID: \`${chatId}\`\n\nЭтот ID используется как ADMIN_CHAT_ID`,
      { parse_mode: 'Markdown' });
  } else {
    ctx.reply('🚫 Эта команда доступна только администратору');
  }
});

// Улучшаем обработку ошибок
process.on('unhandledRejection', (error) => {
  console.error('🔴 Необработанное исключение:', error);
});

process.on('uncaughtException', (error) => {
  console.error('🔴 Непойманное исключение:', error);
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
