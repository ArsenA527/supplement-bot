require('dotenv').config();
const Telegraf = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

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

bot.command('survey', (ctx) => ctx.reply('🧩 Опрос скоро начнётся… (заглушка)'));
bot.command('plan', (ctx) => ctx.reply('📝 Рекомендации будут после прохождения опроса.'));
bot.command('profile', (ctx) => ctx.reply('👤 Профиль: пока пуст. Пройди /survey.'));
bot.command('edit', (ctx) => ctx.reply('✏️ Что изменить? (будет меню)'));
bot.command('reminders', (ctx) => ctx.reply('⏰ Настройка напоминаний (в разработке).'));
bot.command('subscribe', (ctx) => ctx.reply('💳 Подписка (в разработке).'));
bot.command('status', (ctx) => ctx.reply('ℹ️ Статус: подписка не активна, напоминания выкл.'));
bot.command('reset', (ctx) => ctx.reply('♻️ Анкета очищена (пока без хранения).'));
bot.command('feedback', (ctx) => ctx.reply('📮 Напиши свой отзыв в ответ на это сообщение.'));
bot.command('privacy', (ctx) =>
  ctx.reply('⚠️ Дисклеймер: рекомендации носят справочный характер и не заменяют консультацию врача.')
);

bot.launch();
console.log('🤖 Бот запущен');
