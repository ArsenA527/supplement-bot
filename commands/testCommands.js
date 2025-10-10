const ReminderService = require('../services/reminderService');
const subscriptionService = require('../services/subscriptionService');
const surveyService = require('../services/surveyService');
const { getMainMenuKeyboard } = require('../keyboards');

module.exports = {
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
      const history = await service.getIntakeHistory(ctx.chat.id, 7);

      if (history.length === 0) {
        ctx.reply('📊 История приема пуста за последние 7 дней.');
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

      ctx.reply(message, { parse_mode: 'Markdown' });
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
  },

  // История приема
  showIntakeHistory: async (ctx, days = 7) => {
    try {
      const service = new ReminderService(ctx.telegram);
      const history = await service.getIntakeHistory(ctx.chat.id, days);
      const stats = await service.getIntakeStats(ctx.chat.id, days);

      if (history.length === 0) {
        ctx.reply('📊 История приема пуста.\n\nНачните прием добавок чтобы отслеживать прогресс!',
          getMainMenuKeyboard()
        );
        return;
      }

      let message = `📊 *История приема (${days} дней):*\n\n`;

      history.forEach((item, index) => {
        const date = new Date(item.taken_at).toLocaleDateString('ru-RU');
        const time = new Date(item.taken_at).toLocaleTimeString('ru-RU', {
          hour: '2-digit', minute: '2-digit'
        });

        const statusIcon = item.status === 'taken' ? '✅' : item.status === 'skipped' ? '⏭️' : '❌';
        message += `${statusIcon} ${date} ${time} - ${item.supplement_name} (${item.dosage})\n`;
      });

      message += `\n📈 *Статистика:*\n` +
                 `• Принято: ${stats.taken} ✅\n` +
                 `• Пропущено: ${stats.skipped} ⏭️\n` +
                 `• Всего: ${stats.total}\n` +
                 `• Соблюдение: ${stats.compliance}%`;

      ctx.reply(message, {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard()
      });
    } catch (error) {
      console.error('❌ Ошибка загрузки истории:', error);
      ctx.reply('❌ Ошибка загрузки истории', getMainMenuKeyboard());
    }
  },

  // Детальная статистика
  showDetailedStats: async (ctx) => {
    try {
      const service = new ReminderService(ctx.telegram);

      const weeklyStats = await service.getIntakeStats(ctx.chat.id, 7);
      const monthlyStats = await service.getIntakeStats(ctx.chat.id, 30);
      const mostSkipped = await service.getMostSkippedSupplements(ctx.chat.id, 30);

      let message = '📊 *Ваша статистика приема:*\n\n';

      message += '📅 *За неделю:*\n';
      message += `✅ Принято: ${weeklyStats.taken}\n`;
      message += `⏭️ Пропущено: ${weeklyStats.skipped}\n`;
      message += `📊 Соблюдение: ${weeklyStats.compliance}%\n\n`;

      message += '📅 *За месяц:*\n';
      message += `✅ Принято: ${monthlyStats.taken}\n`;
      message += `⏭️ Пропущено: ${monthlyStats.skipped}\n`;
      message += `📊 Соблюдение: ${monthlyStats.compliance}%\n\n`;

      if (mostSkipped.length > 0) {
        message += '⚠️ *Чаще всего пропускаете:*\n';
        mostSkipped.forEach((item, index) => {
          message += `${index + 1}. ${item.supplement_name} - ${item.skip_count} раз\n`;
        });
      }

      ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Ошибка просмотра статистики:', error);
      ctx.reply('❌ Ошибка загрузки статистики');
    }
  },

  // Очистить тестовые напоминания
  clearTestReminders: async (ctx) => {
    try {
      const ReminderService = require('../services/reminderService');
      const service = new ReminderService(ctx.telegram);

      await service.clearTestReminders(ctx.chat.id);
      ctx.reply('✅ Тестовые напоминания очищены');

    } catch (error) {
      console.error('❌ Ошибка очистки тестовых напоминаний:', error);
      ctx.reply('❌ Ошибка очистки напоминаний');
    }
  },

  // Показать статус напоминаний
  reminderStatus: async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const ReminderService = require('../services/reminderService');
      const service = new ReminderService(ctx.telegram);

      const reminders = await service.getUserReminders(chatId);
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);

      let message = `📊 *Статус напоминаний*\n\n`;
      message += `⏰ Текущее время: ${currentTime}\n\n`;

      if (reminders.length === 0) {
        message += `📭 Нет активных напоминаний`;
      } else {
        reminders.forEach(reminder => {
          const status = reminder.time === currentTime ? '🟢 СЕЙЧАС' : '⏳ ОЖИДАЕТ';
          message += `${status} ${reminder.time} - ${reminder.supplement_name}\n`;
        });
      }

      message += `\n🔍 Следующая проверка: через 30 секунд`;

      ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Ошибка проверки статуса:', error);
      ctx.reply('❌ Ошибка проверки статуса напоминаний');
    }
  },

  // Управление бэкапами
  backupStatus: async (ctx) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const backupService = require('../services/backupService');
      const backups = backupService.getBackupList();
      let message = '💾 *Статус бэкапов:*\n\n';

      if (backups.length === 0) {
        message += '📭 Бэкапы не найдены';
      } else {
        message += `📊 Всего бэкапов: ${backups.length}\n\n`;
        message += '📋 Последние 5 бэкапов:\n';

        backups.slice(0, 5).forEach((backup, index) => {
          const size = fs.statSync(path.join(__dirname, '..', 'backups', backup)).size;
          const sizeMB = (size / 1024 / 1024).toFixed(2);
          message += `${index + 1}. ${backup} (${sizeMB} MB)\n`;
        });
      }

      ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('❌ Ошибка проверки бэкапов:', error);
      ctx.reply('❌ Ошибка проверки бэкапов');
    }
  },

  createBackupNow: async (ctx) => {
    try {
      const backupService = require('../services/backupService');
      backupService.createBackup();
      ctx.reply('✅ Бэкап создан вручную');

    } catch (error) {
      console.error('❌ Ошибка создания бэкапа:', error);
      ctx.reply('❌ Ошибка создания бэкапа');
    }
  },

  // 📊 КОМАНДЫ АНАЛИТИКИ ДЛЯ АДМИНА
  analyticsDashboard: async (ctx) => {
    try {
      if (ctx.chat.id.toString() !== process.env.ADMIN_CHAT_ID) {
        ctx.reply('🚫 Эта команда доступна только администратору');
        return;
      }

      const analyticsService = require('../services/analyticsService');
      const metrics = await analyticsService.getKeyMetrics(30);

      const message = `📊 *АНАЛИТИКА ЗА 30 ДНЕЙ* 📊

  👥 *Пользователи:*
  • Всего: ${metrics.totalUsers}
  • Новые: ${metrics.newUsers}
  • Активные: ${metrics.activeUsers}

  📝 *Опросник:*
  • Начато: ${metrics.surveyStarts}
  • Завершено: ${metrics.surveyCompletions}
  • Конверсия: ${metrics.surveyCompletionRate}%

  💎 *Premium:*
  • Конверсий: ${metrics.premiumConversions}
  • Конверсия: ${metrics.premiumConversionRate}%

  ⏰ *Напоминания:*
  • Отправлено: ${metrics.reminderSends}
  • Взаимодействий: ${metrics.reminderInteractions}
  • Engagement: ${metrics.reminderEngagementRate}%`;

      ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Ошибка аналитики:', error);
      ctx.reply('❌ Ошибка загрузки аналитики');
    }
  },

  surveyAnalytics: async (ctx) => {
    try {
      if (ctx.chat.id.toString() !== process.env.ADMIN_CHAT_ID) {
        ctx.reply('🚫 Эта команда доступна только администратору');
        return;
      }

      const analyticsService = require('../services/analyticsService');
      const surveyData = await analyticsService.getSurveyAnalytics();

      let message = `📝 *АНАЛИТИКА ОПРОСНИКА* 📝\n\n`;

      // Самые популярные цели
      if (surveyData.mostCommonGoals && surveyData.mostCommonGoals.length > 0) {
        message += `🎯 *Самые популярные цели:*\n`;
        surveyData.mostCommonGoals.forEach((goal, index) => {
          if (goal.goal) { // Проверяем что goal не null
            message += `${index + 1}. ${goal.goal}: ${goal.count} раз\n`;
          }
        });
        message += `\n`;
      }

      // Среднее количество вопросов
      message += `📊 *Среднее количество ответов:* ${surveyData.averageQuestionsCompleted || 'Нет данных'}\n\n`;

      // Процент бросающих опрос
      message += `❌ *Процент бросающих опрос:* ${surveyData.surveyAbandonmentRate || 0}%\n\n`;

      // Удовлетворенность
      if (surveyData.userSatisfaction) {
        message += `😊 *Удовлетворенность пользователей:* ${surveyData.userSatisfaction.estimated_satisfaction}%`;
      }

      if (message.length < 50) {
        message = '📊 Данных для аналитики пока недостаточно. Проведите несколько опросов.';
      }

      ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Ошибка аналитики опросника:', error);
      ctx.reply('❌ Ошибка загрузки аналитики опросника');
    }
  },

  forceDailyReport: async (ctx) => {
    try {
      if (ctx.chat.id.toString() !== process.env.ADMIN_CHAT_ID) {
        ctx.reply('🚫 Эта команда доступна только администратору');
        return;
      }

      const analyticsService = require('../services/analyticsService');
      await analyticsService.generateDailyReport();
      ctx.reply('✅ Ежедневный отчет отправлен!');

    } catch (error) {
      console.error('❌ Ошибка отправки отчета:', error);
      ctx.reply('❌ Ошибка отправки отчета');
    }
  },

  checkMenuStatus: async (ctx) => {
    try {
      const subscriptionService = require('../services/subscriptionService');
      const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id);

      ctx.reply(`🔍 Статус меню:\n• Premium: ${isPremium ? '✅ Да' : '❌ Нет'}\n• Кнопки: ${isPremium ? 'Premium набор' : 'Free набор'}`);

      // Показываем актуальное меню
      const { getMainMenuKeyboard } = require('../keyboards');
      ctx.reply('Актуальное меню:', getMainMenuKeyboard(isPremium));

    } catch (error) {
      console.error('❌ Ошибка проверки меню:', error);
      ctx.reply('❌ Ошибка проверки статуса меню');
    }
  }
};
