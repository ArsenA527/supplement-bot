require('dotenv').config();
const Telegraf = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Импортируем контроллеры
const surveyController = require('./controllers/surveyController');
const botController = require('./controllers/botController');

// Команды бота
bot.start(botController.handleStart);
bot.help(botController.handleHelp);
bot.command('plan', botController.handlePlan);

// ... остальные обработчики команд ...

// Обработчики сообщений
bot.on('text', surveyController.handleTextAnswer);
bot.on('callback_query', surveyController.handleButtonAnswer);

// Обработчики действий после опроса
bot.action('get_detailed_plan', (ctx) => {
  ctx.reply('💎 Детальный план доступен по подписке. Напишите /subscribe для получения информации.');
  ctx.answerCbQuery();
});

bot.action('restart_survey', (ctx) => {
  surveyController.handleStartSurvey(ctx);
  ctx.answerCbQuery();
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
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

/*
const { generateRecommendations, formatRecommendations } = require('./recommendationEngine');

const userState = {};
const questions = [
  {
    key: "age",
    text: "📅 Укажите ваш возраст:",
    options: null,
    note: ""
  },
  {
    key: "height",
    text: "📏 Ваш рост (в см):",
    options: null,
    note: "Для расчета индекса массы тела (ИМТ) → влияет на дозировку и подбор нутриентов."
  },
  {
    key: "weight",
    text: "⚖️ Ваш вес (в кг):",
    options: null,
    note: "Для расчета индекса массы тела (ИМТ) → влияет на дозировку и подбор нутриентов."
  },
  {
    key: "smoking",
    text: "🚬 Курите?",
    options: ["Курю регулярно", "Курю редко", "Не курю"],
    note: "Курение сильно влияет на усвоение витаминов."
  },
  {
    key: "alcohol",
    text: "🍷 Принимаете алкоголь?",
    options: ["Часто", "Иногда", "Не употребляю"],
    note: "Алкоголь сильно влияет на усвоение витаминов."
  },
  {
    key: "stimulants",
    text: "☕ Употребляете кофе/энергетики или другие стимуляторы?",
    options: ["Ежедневно", "Иногда", "Не употребляю"],
    note: "Кофеин и стимуляторы влияют на усвоение витаминов."
  },
  {
    key: "diet",
    text: "🥗 Какое питание у вас преобладает?",
    options: [
      "Обычный рацион (всё подряд)",
      "Вегетарианство",
      "Мало овощей и фруктов",
      "Много сладкого/фастфуда",
      "Сбалансированное питание"
    ],
    note: "Пищевые привычки → определяют риск дефицита."
  },
  {
    key: "blood_pressure",
    text: "🩸 Какое у вас артериальное давление чаще всего?",
    options: [
      "Низкое (до 100/60)",
      "Нормальное (110–130/70–85)",
      "Повышенное (140–160/90–100)",
      "Очень высокое (>160/100)",
      "Не измеряю"
    ],
    note: "Гипертония/гипотония влияют на рекомендации."
  },
  {
    key: "chronic",
    text: "🏥 Есть ли у вас хронические болезни или состояния?",
    options: [
      "Нет",
      "Сердечно-сосудистые",
      "ЖКТ (желудок, кишечник, печень)",
      "Эндокринные (щитовидка, диабет)",
      "Неврологические",
      "Другое"
    ],
    note: "Влияют на противопоказания (например, при заболеваниях почек ограничивают кальций)."
  },
  {
    key: "sleep",
    text: "😴 Как вы оцениваете свой сон?",
    options: [
      "Хороший, засыпаю легко, просыпаюсь бодрым",
      "Засыпаю долго",
      "Просыпаюсь ночью",
      "Сплю мало (<6 часов)",
      "Хроническая бессонница"
    ],
    note: "Проблемы со сном → возможен дефицит магния, мелатонина."
  },
  {
    key: "energy",
    text: "⚡ Уровень энергии и утомляемость?",
    options: [
      "Всегда бодрый",
      "Устаю к вечеру",
      "Устаю уже к середине дня",
      "Постоянная усталость"
    ],
    note: "Низкая энергия может указывать на дефицит витаминов группы B, железа, Q10."
  },
  {
    key: "stress",
    text: "😵‍💫 Часто у вас стресс?",
    options: ["Редко", "Иногда", "Почти ежедневно", "Постоянный стресс"],
    note: "Стресс истощает магний, витамины группы B; полезны адаптогены."
  },
  {
    key: "symptoms",
    text: "⚠️ Что из нижеперечисленного вас беспокоит?",
    options: [
      "Проблемы с кожей",
      "Волосы выпадают",
      "Ломкие ногти",
      "Частые простуды",
      "Проблемы с ЖКТ",
      "Судороги, подёргивания мышц",
      "Головные боли"
    ],
    note: "Связываем с конкретными добавками (например, ногти → коллаген, цинк)."
  },
  {
    key: "libido",
    text: "❤️ Как оцениваете либидо и половую функцию?",
    options: ["Всё в порядке", "Снижение интереса", "Проблемы с эрекцией (для мужчин)"],
    note: "Низкое либидо → возможен дефицит цинка, витамина D."
  },
  {
    key: "region",
    text: "🌍 В каком регионе вы живёте?",
    options: null,
    note: "Уровень солнца → риск дефицита витамина D."
  },
  {
    key: "activity",
    text: "🏃 Какой у вас уровень физической активности?",
    options: [
      "Минимальный (сидячая работа)",
      "Умеренный (прогулки, лёгкий фитнес)",
      "Высокий (спорт 3+ раз в неделю)",
      "Профессиональный спорт"
    ],
    note: "Активные люди нуждаются в повышенном количестве магния, электролитов, белка."
  },
  {
    key: "priority",
    text: "🎯 Что для вас важнее всего улучшить?",
    options: [
      "Энергия и бодрость",
      "Сон и восстановление",
      "Иммунитет",
      "Кожа, волосы, ногти",
      "Контроль веса",
      "Работа мозга и память",
      "Половое здоровье",
      "Долголетие и профилактика"
    ],
    note: "Помогает приоритизировать рекомендации."
  }
];


function startSurvey(ctx) {
  const chatId = ctx.chat.id;
  userState[chatId] = { current: 0, answers: {} };
  askQuestion(ctx);
}

function askQuestion(ctx) {
  const chatId = ctx.chat.id;
  const state = userState[chatId];
  const question = questions[state.current];

  if (!question) {
    ctx.reply("✅ Спасибо, опрос завершён! Я обработаю ваши ответы.");
    completeSurvey(ctx, state.answers);
    return;
  }

  const txt = `${question.text}\n\n${question.note}`;

  if (question.options) {
    // Используем индекс варианта вместо полного текста для callback_data
    const keyboard = question.options.map((option, index) => [
      {
        text: option,
        callback_data: `q${state.current}a${index}` // Формат: q0a0, q0a1, etc.
      }
    ]);

    bot.telegram.sendMessage(ctx.chat.id, txt, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  } else {
    ctx.reply(txt);
  }
}
function completeSurvey(ctx, answers) {
  const recommendations = generateRecommendations(answers);
  const message = formatRecommendations(recommendations);

    ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '💳 Получить детальный план с дозировками',
            callback_data: 'get_detailed_plan'
          }
        ],
        [
          {
            text: '📋 Пройти опрос заново',
            callback_data: 'restart_survey'
          }
        ]
      ]
    }
  });

  console.log("Рекомендации для пользователя:", recommendations);
}

bot.start((ctx) =>
  ctx.reply('👋 Привет! Я помогу подобрать БАДы персонально.\nНажми /survey чтобы пройти опрос.')
);

bot.command('help', (ctx) =>
  ctx.reply(
    [
      'Доступные команды:',
      '/start — начать',
      '/survey — пройти опрос',
      '/plan — мои рекомендации',
      '/profile — мой профиль',
      '/edit — изменить данные',
      '/reminders — напоминания',
      '/subscribe — подписка',
      '/status — статус подписки',
      '/reset — сброс анкеты',
      '/feedback — обратная связь',
      '/privacy — политика и дисклеймер',
    ].join('\n')
  )
);

bot.command('survey', (ctx) => { ctx.reply('🧩 Начнём опрос.'); startSurvey(ctx) });
bot.command('plan', (ctx) => ctx.reply('📝 Рекомендации будут после прохождения опроса.'));
bot.command('profile', (ctx) => ctx.reply('👤 Профиль: пока пуст. Пройди /survey.'));
bot.command('edit', (ctx) => ctx.reply('✏️ Что изменить? (будет меню)'));
bot.command('reminders', (ctx) => ctx.reply('⏰ Настройка напоминаний (в разработке).'));
bot.command('subscribe', (ctx) => ctx.reply('💳 Подписка (в разработке).'));
bot.command('status', (ctx) => ctx.reply('ℹ️ Статус: подписка не активна, напоминания выкл.'));
bot.command('reset', (ctx) => ctx.reply('♻️ Анкета очищена (пока без хранения).'));
bot.command('feedback', (ctx) => ctx.reply('📮 Напиши свой отзыв в ответ на это сообщение.'));
bot.command('privacy', (ctx) => ctx.reply('⚠️ Дисклеймер: рекомендации носят справочный характер и не заменяют консультацию врача.'));

bot.on("text", (ctx) => {
  const chatId = ctx.chat.id;
  const state = userState[chatId];

  if (!state) return;

  const question = questions[state.current];
  state.answers[question.key] = ctx.message.text;

  state.current++;
  askQuestion(ctx);
})

// Обработка клика по кнопке
bot.on("callback_query", (ctx) => {
  const chatId = ctx.chat.id;
  const state = userState[chatId];

  if (!state) {
    ctx.answerCbQuery('❌ Сессия устарела. Начните заново: /survey');
    return;
  }

  const question = questions[state.current];

  // Парсим callback_data в формате q0a0
  const callbackData = ctx.callbackQuery.data;
  const match = callbackData.match(/q(\d+)a(\d+)/);

  if (match) {
    const questionIndex = parseInt(match[1]);
    const answerIndex = parseInt(match[2]);

    // Проверяем что индекс ответа корректен
    if (questionIndex === state.current && question.options && answerIndex < question.options.length) {
      state.answers[question.key] = question.options[answerIndex];
    } else {
      ctx.answerCbQuery('❌ Ошибка: неверные данные кнопки');
      return;
    }
  } else {
    // Для обратной совместимости (если остались старые форматы)
    state.answers[question.key] = ctx.callbackQuery.data;
  }

  state.current++;
  ctx.answerCbQuery();
  askQuestion(ctx);
});

// Обработка кнопок после опроса - ПРАВИЛЬНАЯ РЕАЛИЗАЦИЯ
bot.action('get_detailed_plan', (ctx) => {
  ctx.reply('💎 Детальный план доступен по подписке. Напишите /subscribe для получения информации.');
  ctx.answerCbQuery();
});

bot.action('restart_survey', (ctx) => {
  startSurvey(ctx);
  ctx.answerCbQuery();
});

bot.launch();
console.log('🤖 Бот запущен');

// Добавьте в начало для отладки
console.log('Количество вопросов:', questions.length);
questions.forEach((q, i) => {
  console.log(`${i}. ${q.key}: ${q.text.substring(0, 30)}...`);
});
*/
