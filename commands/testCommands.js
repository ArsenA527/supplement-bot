const ReminderService = require('../services/reminderService');
const subscriptionService = require('../services/subscriptionService');
const surveyService = require('../services/surveyService');
const { getMainMenuKeyboard } = require('../keyboards');

module.exports = {
  // Тест напоминания прямо сейчас
  testReminderNow: async (ctx) => {
    try {
      const service = new ReminderService(ctx.telegram);

      // Создаем тестовое напоминание
      const reminderId = await service.createReminder(ctx.chat.id, {
        supplement_name: 'Тестовая добавка',
        dosage: '500 мг',
        time: '00:01', // Через 1 минуту
        days: '1111111'
      });

      // Имитируем отправку сразу для теста
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Принял', callback_data: `intake_taken_${reminderId}` },
              { text: '⏰ Напомнить позже', callback_data: `intake_later_${reminderId}` },
              { text: '❌ Пропустить', callback_data: `intake_skipped_${reminderId}` }
            ]
          ]
        }
      };

      await ctx.reply(
        `⏰ *ТЕСТ Напоминание!*\n\n💊 Тестовая добавка\n📏 500 мг\n\nПодтвердите прием:`,
        { parse_mode: 'Markdown', ...keyboard }
      );

      ctx.reply('✅ Тестовое напоминание отправлено сразу! Проверьте кнопки.');

    } catch (error) {
      console.error('❌ Ошибка testremindernow:', error);
      ctx.reply('❌ Ошибка: ' + error.message);
    }
  },

  // Показать все напоминания пользователя
  showMyReminders: async (ctx) => {
    try {
      const service = new ReminderService(ctx.telegram);
      const reminders = await service.getUserReminders(ctx.chat.id);

      if (reminders.length === 0) {
        ctx.reply('📋 Напоминаний не найдено');
        return;
      }

      let message = '📋 Ваши напоминания:\n\n';
      reminders.forEach(reminder => {
        message += `⏰ ${reminder.time} - ${reminder.supplement_name} (${reminder.dosage})\n`;
      });

      ctx.reply(message);
    } catch (error) {
      console.error('❌ Ошибка myreminders:', error);
      ctx.reply('❌ Ошибка получения напоминаний');
    }
  },

  // Проверка истории приема
  checkHistory: async (ctx) => {
    try {
      const service = new ReminderService(ctx.telegram);
      const history = await service.getIntakeHistory(ctx.chat.id, 1);

      ctx.reply(`📊 Записей в истории: ${history.length}`);
    } catch (error) {
      console.error('❌ Ошибка checkhistory:', error);
      ctx.reply('❌ Ошибка проверки истории');
    }
  },

  // Статистика напоминаний
  reminderStats: async (ctx) => {
    try {
      const service = new ReminderService(ctx.telegram);
      const stats = await service.getIntakeStats(ctx.chat.id, 30);

      ctx.reply(
        `📊 Статистика приема:\n` +
        `✅ Принято: ${stats.taken}\n` +
        `⏭️ Пропущено: ${stats.skipped}\n` +
        `❌ Пропущено: ${stats.missed}\n` +
        `📈 Соблюдение: ${stats.compliance}%`
      );
    } catch (error) {
      console.error('❌ Ошибка reminderstats:', error);
      ctx.reply('❌ Ошибка получения статистики');
    }
  },

  // Отладка подписки
  debugSubscription: async (ctx) => {
    try {
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
    } catch (error) {
      console.error('❌ Ошибка debugsub:', error);
      ctx.reply('❌ Ошибка отладки подписки');
    }
  },

  // Активация premium вручную
  activatePremium: async (ctx) => {
    try {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      await subscriptionService.updateSubscription(ctx.chat.id, {
        plan: 'premium',
        status: 'active',
        end_date: endDate.toISOString()
      });

      ctx.reply('✅ Premium подписка активирована вручную на 1 месяц! Используйте /survey');
    } catch (error) {
      console.error('❌ Ошибка activatepremium:', error);
      ctx.reply('❌ Ошибка активации premium');
    }
  },

  // Очистка своих данных
  clearMyData: async (ctx) => {
    try {
      const db = require('../config/database');
      const chatId = ctx.chat.id;

      await db.run('DELETE FROM users WHERE chat_id = ?', [chatId]);
      await db.run('DELETE FROM subscriptions WHERE chat_id = ?', [chatId]);
      await db.run('DELETE FROM reminders WHERE chat_id = ?', [chatId]);
      await db.run('DELETE FROM intake_history WHERE chat_id = ?', [chatId]);

      ctx.reply('✅ Ваши данные очищены! Можете начать заново: /start',
        getMainMenuKeyboard()
      );
    } catch (error) {
      console.error('❌ Ошибка очистки данных:', error);
      ctx.reply('❌ Ошибка очистки данных');
    }
  },

  // Тест вопросов
  testQuestions: async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const isPremium = await subscriptionService.isSubscriptionActive(chatId);
      const questions = await surveyService.getQuestionsForUser(chatId);

      let message = `🔍 *Тест вопросов:*\n\n`;
      message += `• Premium статус: ${isPremium ? '✅ Да' : '❌ Нет'}\n`;
      message += `• Всего вопросов: ${questions.length}\n\n`;

      // Показываем первые 3 вопроса для примера
      questions.slice(0, 3).forEach((q, i) => {
        message += `${i + 1}. ${q.text}\n`;
      });

      if (questions.length > 3) {
        message += `\n... и еще ${questions.length - 3} вопросов`;
      }

      ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('❌ Ошибка testquestions:', error);
      ctx.reply('❌ Ошибка проверки вопросов');
    }
  }
};
