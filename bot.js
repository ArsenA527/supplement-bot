require('dotenv').config();
const Telegraf = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const db = require('./config/database');

// Импорты контроллеров
const botController = require('./controllers/botController');
const surveyController = require('./controllers/surveyController');
const subscriptionController = require('./controllers/subscriptionController');

// Middleware
const { injectSubscriptionData } = require('./middlewares/subscriptionMiddleware');

// Middleware для инъекции данных подписки
bot.use(injectSubscriptionData);

// Команды бота
bot.start(botController.handleStart);
bot.help(botController.handleHelp);
bot.command('survey', (ctx) => {
  // Проверяем может ли пользователь начать опрос
  require('./services/surveyService').canStartSurvey(ctx.chat.id)
    .then(canStart => {
      if (canStart) {
        surveyController.handleStartSurvey(ctx);
      } else {
        ctx.reply(`🚫 Вы уже проходили бесплатный опрос.\n\n💎 Для неограниченного доступа и расширенного опроса оформите подписку:\n/subscribe`,
          require('./keyboards').getMainMenuKeyboard()
        );
      }
    })
    .catch(err => {
      ctx.reply('❌ Ошибка проверки доступа к опросу');
    });
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

// Обработка текстовых сообщений
bot.on('text', (ctx) => {
  const chatId = ctx.chat.id;

  // Проверяем, находится ли пользователь в опросе
  require('./services/surveyService').getUserState(chatId)
    .then(state => {
      if (state && state.current !== undefined) {
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
    ctx.reply('💎 Детальный план с дозировками доступен по подписке Premium!\n\n' +
              'Используйте /subscribe для получения полного доступа к:\n' +
              '• Персональным дозировкам\n' +
              '• Расширенному опросу\n' +
              '• Напоминаниям о приеме',
      require('./keyboards').getMainMenuKeyboard()
    );
    ctx.answerCbQuery();
  }
  else if (callbackData === 'restart_survey') {
    // Проверяем может ли пользователь начать опрос
    require('./services/surveyService').canStartSurvey(ctx.chat.id)
      .then(canStart => {
        if (canStart) {
          require('./controllers/surveyController').handleStartSurvey(ctx);
        } else {
          ctx.reply(`🚫 Бесплатный опрос можно пройти только один раз.\n\n` +
                    `💎 Оформите подписку для неограниченного доступа: /subscribe`,
            require('./keyboards').getMainMenuKeyboard()
          );
        }
      });
    ctx.answerCbQuery();
  }
  else if (callbackData === 'main_menu') {
    require('./controllers/botController').showMainMenu(ctx);
    ctx.answerCbQuery();
  }
  else if (callbackData === 'subscription_info') {
    require('./controllers/subscriptionController').showSubscriptionPlans(ctx);
    ctx.answerCbQuery();
  }
  else if (callbackData === 'payment_confirmed') {
    require('./controllers/subscriptionController').handlePaymentConfirmation(ctx);
    ctx.answerCbQuery();
  }
  else {
    require('./controllers/surveyController').handleButtonAnswer(ctx);
  }
});

// Обработка успешных платежей (заглушка для будущей интеграции)
bot.on('successful_payment', (ctx) => {
  ctx.reply('✅ Платеж успешно обработан! Ваша подписка активирована.',
    require('./keyboards').getMainMenuKeyboard()
  );
});

// Команда для отладки подписки
bot.command('debugsub', async (ctx) => {
  const subscriptionService = require('./services/subscriptionService');
  const surveyService = require('./services/surveyService');

  const chatId = ctx.chat.id;
  const subscription = await subscriptionService.getUserSubscription(chatId);
  const isActive = await subscriptionService.isSubscriptionActive(chatId);
  const canStart = await surveyService.canStartSurvey(chatId);

  let message = `🔍 *Debug информации о подписке:*\n\n`;
  message += `• Chat ID: ${chatId}\n`;
  message += `• План: ${subscription.plan}\n`;
  message += `• Статус: ${subscription.status}\n`;
  message += `• Активна: ${isActive ? '✅ Да' : '❌ Нет'}\n`;
  message += `• Может начать опрос: ${canStart ? '✅ Да' : '❌ Нет'}\n`;

  if (subscription.end_date) {
    message += `• Действует до: ${new Date(subscription.end_date).toLocaleDateString('ru-RU')}\n`;
  }

  ctx.reply(message, { parse_mode: 'Markdown' });
});

// Команда для принудительной активации premium
bot.command('activatepremium', async (ctx) => {
  const subscriptionService = require('./services/subscriptionService');

  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  await subscriptionService.updateSubscription(ctx.chat.id, {
    plan: 'premium',
    status: 'active',
    end_date: endDate.toISOString()
  });

  ctx.reply('✅ Premium подписка активирована вручную! Используйте /survey');
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
