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
        ctx.reply('📋 Напоминаний не найдено\n\nСоздайте напоминания после прохождения опроса для получения персонализированного плана.');
        return;
      }

      let message = '📋 *Ваши напоминания:*\n\n';
      let activeCount = 0;

      reminders.forEach(reminder => {
        const daysActive = reminder.days ? reminder.days.split('').filter(d => d === '1').length : 7;
        const status = reminder.is_active ? '🟢' : '🔴';
        if (reminder.is_active) activeCount++;

        message += `${status} ${reminder.time} - ${reminder.supplement_name}\n`;
        message += `   📏 ${reminder.dosage} | ${daysActive} дней/неделю\n\n`;
      });

      message += `*Всего: ${reminders.length} напоминаний (${activeCount} активных)*`;

      ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('❌ Ошибка myreminders:', error);
      ctx.reply('❌ Ошибка получения напоминаний. Попробуйте позже.');
    }
  },

  // Проверка истории приема
  checkHistory: async (ctx) => {
    try {
      const service = new ReminderService(ctx.telegram);
      const history = await service.getIntakeHistory(ctx.chat.id, 7);
      const stats = await service.getIntakeStats(ctx.chat.id, 7);

      if (history.length === 0) {
        ctx.reply('📊 *История приема пуста за последние 7 дней.*\n\nНачните прием добавок, чтобы отслеживать свой прогресс! 💪',
          { parse_mode: 'Markdown' });
        return;
      }

      // Группируем по дням для лучшей читаемости
      const dailyHistory = {};
      history.forEach(item => {
        const date = new Date(item.taken_at).toLocaleDateString('ru-RU');
        if (!dailyHistory[date]) dailyHistory[date] = [];
        dailyHistory[date].push(item);
      });

      let message = '📊 *История приема за 7 дней:*\n\n';

      Object.entries(dailyHistory).forEach(([date, items]) => {
        message += `*${date}:*\n`;
        items.forEach(item => {
          const time = new Date(item.taken_at).toLocaleTimeString('ru-RU', {
            hour: '2-digit', minute: '2-digit'
          });
          const statusIcon = item.status === 'taken' ? '✅' :
                            item.status === 'skipped' ? '⏭️' : '❌';
          message += `${statusIcon} ${time} - ${item.supplement_name}\n`;
        });
        message += '\n';
      });

      message += `📈 *Статистика за неделю:*\n` +
                 `• Соблюдение режима: ${stats.compliance}%\n` +
                 `• Принято: ${stats.taken} ✅\n` +
                 `• Пропущено: ${stats.skipped} ⏭️\n` +
                 `• Всего приемов: ${stats.total}`;

      ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('❌ Ошибка checkhistory:', error);
      ctx.reply('❌ Ошибка загрузки истории. Попробуйте позже.');
    }
  },

  // Статистика напоминаний
  reminderStats: async (ctx) => {
    try {
      const service = new ReminderService(ctx.telegram);
      const stats = await service.getIntakeStats(ctx.chat.id, 30);
      const weeklyStats = await service.getIntakeStats(ctx.chat.id, 7);

      let complianceAnalysis = '';
      if (stats.compliance >= 90) {
        complianceAnalysis = '🎉 Отличная дисциплина!';
      } else if (stats.compliance >= 70) {
        complianceAnalysis = '💪 Хорошие результаты!';
      } else if (stats.compliance >= 50) {
        complianceAnalysis = '📈 Есть куда стремиться!';
      } else {
        complianceAnalysis = '🔄 Попробуйте настроить напоминания удобнее';
      }

      const message = `📊 *Статистика приема за 30 дней*\n\n` +
        `✅ Принято: ${stats.taken} приемов\n` +
        `⏭️ Пропущено: ${stats.skipped} приемов\n` +
        `❌ Пропущено: ${stats.missed} приемов\n` +
        `📈 Соблюдение: ${stats.compliance}%\n\n` +
        `*Анализ:* ${complianceAnalysis}\n\n` +
        `*За неделю:* ${weeklyStats.compliance}% соблюдения`;

      ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('❌ Ошибка reminderstats:', error);
      ctx.reply('❌ Ошибка получения статистики. Попробуйте позже.');
    }
  },

  // Отладка подписки
  debugSubscription: async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const subscription = await subscriptionService.getUserSubscription(chatId);
      const isActive = await subscriptionService.isSubscriptionActive(chatId);
      const canStart = await surveyService.canStartSurvey(chatId);

      const now = new Date();
      let daysLeft = 'неограниченно';
      if (subscription.end_date) {
        const endDate = new Date(subscription.end_date);
        daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        daysLeft = daysLeft > 0 ? `${daysLeft} дней` : 'истекла';
      }

      let message = `🔍 *Детальная информация о подписке*\n\n` +
        `• Chat ID: ${chatId}\n` +
        `• План: ${subscription.plan === 'premium' ? '💎 Premium' : '🎁 Free'}\n` +
        `• Статус: ${subscription.status || 'active'}\n` +
        `• Активна: ${isActive ? '✅ Да' : '❌ Нет'}\n` +
        `• Может начать опрос: ${canStart ? '✅ Да' : '❌ Нет'}\n` +
        `• Осталось дней: ${daysLeft}\n`;

      if (subscription.start_date) {
        const startDate = new Date(subscription.start_date);
        message += `• Начало: ${startDate.toLocaleDateString('ru-RU')}\n`;
      }

      if (subscription.end_date) {
        const endDate = new Date(subscription.end_date);
        message += `• Окончание: ${endDate.toLocaleDateString('ru-RU')}\n`;
      }

      if (!isActive && subscription.plan === 'free') {
        message += `\n💡 *Рекомендация:* Используйте /subscribe для получения Premium доступа`;
      }

      ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('❌ Ошибка debugsub:', error);
      ctx.reply('❌ Ошибка получения информации о подписке.');
    }
  },

  // Добавь эту команду для исправления даты
  fixSubscriptionDate: async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      console.log(`🔧 Исправление даты для ${chatId}`);

      const endDate = new Date();
      console.log(`📅 Текущая дата: ${endDate.toISOString()}`);

      endDate.setMonth(endDate.getMonth() + 1); // +1 месяц
      console.log(`📅 Новая дата окончания: ${endDate.toISOString()}`);

      await subscriptionService.updateSubscription(chatId, {
        plan: 'premium',
        status: 'active',
        end_date: endDate.toISOString()
      });

      // Проверяем
      const sub = await subscriptionService.getUserSubscription(chatId);
      const isActive = await subscriptionService.isSubscriptionActive(chatId);

      console.log(`🔍 Проверка после исправления:`);
      console.log(`- Сохраненная дата: ${sub.end_date}`);
      console.log(`- Premium активен: ${isActive}`);

      ctx.reply(`✅ Дата исправлена!\n\n` +
        `Новая дата окончания: ${new Date(sub.end_date).toLocaleDateString('ru-RU')}\n` +
        `Premium статус: ${isActive ? '✅ Активен' : '❌ Не активен'}`);

    } catch (error) {
      console.error('❌ Ошибка исправления даты:', error);
      ctx.reply('❌ Ошибка исправления даты: ' + error.message);
    }
  },

  // Принудительная активация Premium
  forcePremium: async (ctx) => {
    try {
      const chatId = ctx.chat.id;

      // Просто устанавливаем подписку без сложных проверок
      const db = require('../config/database');

      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR REPLACE INTO subscriptions (chat_id, plan, status, end_date)
          VALUES (?, ?, ?, ?)`,
          [
            chatId,
            'premium',
            'active',
            null // Без даты окончания - вечная подписка для теста
          ],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Проверяем
      const isActive = await subscriptionService.isSubscriptionActive(chatId);

      ctx.reply(`🎉 Premium принудительно активирован!\n` +
        `Статус: ${isActive ? '✅ Активен' : '❌ Не активен'}\n\n` +
        `Проверь командами:\n` +
        `/debugsub - статус подписки\n` +
        `/checkmenustatus - меню Premium`);

    } catch (error) {
      console.error('❌ Ошибка принудительной активации:', error);
      ctx.reply('❌ Ошибка: ' + error.message);
    }
  },

  // Активация premium вручную
  activatePremium: async (ctx) => {
    try {
      const endDate = new Date();
      console.log(`🔵 Ручная активация, текущая дата: ${endDate.toISOString()}`);

      endDate.setMonth(endDate.getMonth() + 1);
      console.log(`🔵 Дата после +1 месяц: ${endDate.toISOString()}`);

      await subscriptionService.updateSubscription(ctx.chat.id, {
        plan: 'premium',
        status: 'active',
        end_date: endDate.toISOString()
      });

      const surveyService = require('../services/surveyService');
      await surveyService.completeSurvey(ctx.chat.id);

      const message = `✅ *Premium подписка активирована!*\n\n` +
        `Действует до: ${endDate.toLocaleDateString('ru-RU')}\n\n` +
        `Теперь вам доступны:\n` +
        `• 📋 Расширенный опрос (17+ вопросов)\n` +
        `• 💊 Персональные дозировки\n` +
        `• ⏰ Умные напоминания\n` +
        `• 🔄 Неограниченные опросы\n\n` +
        `*Используйте /survey для нового расширенного опроса!*`;

      ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('❌ Ошибка activatepremium:', error);
      ctx.reply('❌ Ошибка активации Premium. Попробуйте позже.');
    }
  },

  // Очистка своих данных
  clearMyData: async (ctx) => {
    try {
      const db = require('../config/database');
      const chatId = ctx.chat.id;

      const remindersCount = await new Promise(resolve => {
        db.get('SELECT COUNT(*) as count FROM reminders WHERE chat_id = ?', [chatId], (err, row) => {
          resolve(row?.count || 0);
        });
      });

      const historyCount = await new Promise(resolve => {
        db.get('SELECT COUNT(*) as count FROM intake_history WHERE chat_id = ?', [chatId], (err, row) => {
          resolve(row?.count || 0);
        });
      });

      await db.run('DELETE FROM users WHERE chat_id = ?', [chatId]);
      await db.run('DELETE FROM subscriptions WHERE chat_id = ?', [chatId]);
      await db.run('DELETE FROM reminders WHERE chat_id = ?', [chatId]);
      await db.run('DELETE FROM intake_history WHERE chat_id = ?', [chatId]);
      await db.run('DELETE FROM notification_settings WHERE chat_id = ?', [chatId]);

      const message = `✅ *Все ваши данные очищены!*\n\n` +
        `Удалено:\n` +
        `• 👤 Профиль пользователя\n` +
        `• 💎 Данные подписки\n` +
        `• ⏰ ${remindersCount} напоминаний\n` +
        `• 📊 ${historyCount} записей истории приема\n` +
        `• ⚙️ Настройки уведомлений\n\n` +
        `Можете начать заново: /start`;

      ctx.reply(message, {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard(false)
      });
    } catch (error) {
      console.error('❌ Ошибка очистки данных:', error);
      ctx.reply('❌ Ошибка очистки данных. Попробуйте позже.');
    }
  },

  // История приема
  showIntakeHistory: async (ctx, days = 7) => {
    try {
      const service = new ReminderService(ctx.telegram);
      const history = await service.getIntakeHistory(ctx.chat.id, days);
      const stats = await service.getIntakeStats(ctx.chat.id, days);
      const mostSkipped = await service.getMostSkippedSupplements(ctx.chat.id, days);

      if (history.length === 0) {
        ctx.reply(`📊 *История приема пуста за ${days} дней.*\n\nНачните прием добавок, чтобы отслеживать свой прогресс! 💪`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      let message = `📊 *История приема за ${days} дней:*\n\n`;

      const dailyStats = {};
      history.forEach(item => {
        const date = new Date(item.taken_at).toLocaleDateString('ru-RU');
        if (!dailyStats[date]) dailyStats[date] = { taken: 0, skipped: 0, total: 0 };

        dailyStats[date].total++;
        if (item.status === 'taken') dailyStats[date].taken++;
        if (item.status === 'skipped') dailyStats[date].skipped++;
      });

      Object.entries(dailyStats).forEach(([date, dayStats]) => {
        const compliance = dayStats.total > 0 ? Math.round((dayStats.taken / dayStats.total) * 100) : 0;
        message += `*${date}:* ${compliance}% (${dayStats.taken}/${dayStats.total})\n`;
      });

      message += `\n📈 *Общая статистика:*\n` +
                 `• Соблюдение: ${stats.compliance}%\n` +
                 `• Принято: ${stats.taken} ✅\n` +
                 `• Пропущено: ${stats.skipped} ⏭️\n` +
                 `• Всего: ${stats.total} приемов`;

      if (mostSkipped.length > 0) {
        message += `\n\n⚠️ *Чаще пропускаются:*\n`;
        mostSkipped.slice(0, 3).forEach((item, index) => {
          message += `${index + 1}. ${item.supplement_name} - ${item.skip_count} раз\n`;
        });
      }

      ctx.reply(message, {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard(true)
      });
    } catch (error) {
      console.error('❌ Ошибка загрузки истории:', error);
      ctx.reply('❌ Ошибка загрузки истории. Попробуйте позже.', getMainMenuKeyboard(true));
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
      const currentDay = now.getDay();

      const getDayName = (dayIndex) => {
        const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        return days[dayIndex];
      };

      const isReminderActiveToday = (reminder, currentDay) => {
        if (!reminder.days || reminder.days.length !== 7) return true;
        const dbDayIndex = currentDay === 0 ? 6 : currentDay - 1;
        return reminder.days[dbDayIndex] === '1';
      };

      let message = `📊 *Статус системы напоминаний*\n\n` +
        `⏰ Текущее время: ${currentTime}\n` +
        `📅 Текущий день: ${getDayName(currentDay)}\n\n`;

      if (reminders.length === 0) {
        message += `📭 Нет активных напоминаний\n\n` +
          `Создайте напоминания после прохождения опроса для автоматических уведомлений.`;
      } else {
        let activeCount = 0;
        let dueSoon = 0;

        reminders.forEach(reminder => {
          const isActiveToday = isReminderActiveToday(reminder, currentDay);
          const status = isActiveToday ? (reminder.time === currentTime ? '🟢 СЕЙЧАС' : '⏳ ОЖИДАЕТ') : '🔴 НЕАКТИВНО';

          if (isActiveToday) activeCount++;
          if (reminder.time === currentTime) dueSoon++;

          message += `${status} ${reminder.time} - ${reminder.supplement_name}\n`;
        });

        message += `\n📈 *Сводка:*\n` +
          `• Всего напоминаний: ${reminders.length}\n` +
          `• Активных сегодня: ${activeCount}\n` +
          `• Ожидающих сейчас: ${dueSoon}\n\n` +
          `🔍 Следующая проверка: через 30 секунд`;
      }

      ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Ошибка проверки статуса:', error);
      ctx.reply('❌ Ошибка проверки статуса напоминаний. Попробуйте позже.');
    }
  },

  // Управление бэкапами
  backupStatus: async (ctx) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const backupService = require('../services/backupService');
      const backups = backupService.getBackupList();

      let message = '💾 *Статус системы бэкапов*\n\n';

      if (backups.length === 0) {
        message += '📭 Бэкапы не найдены\n\n' +
          'Система автоматически создает бэкапы каждые 6 часов.';
      } else {
        const totalSize = backups.reduce((sum, backup) => {
          try {
            const size = fs.statSync(path.join(__dirname, '..', 'backups', backup)).size;
            return sum + size;
          } catch {
            return sum;
          }
        }, 0);

        const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

        message += `📊 Всего бэкапов: ${backups.length}\n` +
          `💾 Общий размер: ${totalSizeMB} MB\n\n` +
          `📋 *Последние 5 бэкапов:*\n`;

        backups.slice(0, 5).forEach((backup, index) => {
          try {
            const size = fs.statSync(path.join(__dirname, '..', 'backups', backup)).size;
            const sizeMB = (size / 1024 / 1024).toFixed(2);
            const date = backup.replace('backup-', '').replace('.db', '').substring(0, 16);
            message += `${index + 1}. ${date} (${sizeMB} MB)\n`;
          } catch {
            message += `${index + 1}. ${backup} (ошибка чтения)\n`;
          }
        });

        message += `\n🔄 Автобэкап: каждые 6 часов\n` +
          `🗑️ Хранится: последние 10 бэкапов`;
      }

      ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('❌ Ошибка проверки бэкапов:', error);
      ctx.reply('❌ Ошибка проверки статуса бэкапов.');
    }
  },

  createBackupNow: async (ctx) => {
    try {
      const backupService = require('../services/backupService');

      await ctx.reply('🔄 Создание бэкапа...');
      backupService.createBackup();

      // Даем время на создание бэкапа
      setTimeout(async () => {
        const backups = backupService.getBackupList();
        const latestBackup = backups[0];

        let message = '✅ *Бэкап успешно создан!*\n\n';
        if (latestBackup) {
          message += `Последний бэкап: ${latestBackup.replace('backup-', '').replace('.db', '').substring(0, 16)}\n`;
        }
        message += `Всего бэкапов: ${backups.length}\n\n` +
          `Следующий автоматический бэкап через 6 часов.`;

        await ctx.reply(message, { parse_mode: 'Markdown' });
      }, 1000);

    } catch (error) {
      console.error('❌ Ошибка создания бэкапа:', error);
      ctx.reply('❌ Ошибка создания бэкапа. Проверьте права доступа.');
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

      const weeklyMetrics = await analyticsService.getKeyMetrics(7);
      const userGrowth = metrics.newUsers > 0 ? '📈' : '📉';
      const conversionTrend = metrics.premiumConversionRate > 10 ? '🟢' : metrics.premiumConversionRate > 5 ? '🟡' : '🔴';

      const message = `📊 *АНАЛИТИКА СИСТЕМЫ ЗА 30 ДНЕЙ* 📊\n\n` +

        `👥 *Пользователи ${userGrowth}*\n` +
        `• Всего: ${metrics.totalUsers}\n` +
        `• Новые: ${metrics.newUsers}\n` +
        `• Активные: ${metrics.activeUsers}\n` +
        `• Активность: ${Math.round((metrics.activeUsers / metrics.totalUsers) * 100)}%\n\n` +

        `📝 *Опросник*\n` +
        `• Начато: ${metrics.surveyStarts}\n` +
        `• Завершено: ${metrics.surveyCompletions}\n` +
        `• Конверсия: ${metrics.surveyCompletionRate}%\n` +
        `• Бросают: ${100 - metrics.surveyCompletionRate}%\n\n` +

        `💎 *Premium ${conversionTrend}*\n` +
        `• Конверсий: ${metrics.premiumConversions}\n` +
        `• Конверсия: ${metrics.premiumConversionRate}%\n` +
        `• Доход (оценка): ${metrics.premiumConversions * 9.99} руб\n\n` +

        `⏰ *Напоминания*\n` +
        `• Отправлено: ${metrics.reminderSends}\n` +
        `• Взаимодействий: ${metrics.reminderInteractions}\n` +
        `• Engagement: ${metrics.reminderEngagementRate}%\n\n` +

        `📈 *За неделю:* ${weeklyMetrics.newUsers} новых пользователей`;

      ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Ошибка аналитики:', error);
      ctx.reply('❌ Ошибка загрузки аналитики. Проверьте подключение к БД.');
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

      let message = `📝 *ДЕТАЛЬНАЯ АНАЛИТИКА ОПРОСНИКА* 📝\n\n`;

      // Самые популярные цели
      if (surveyData.mostCommonGoals && surveyData.mostCommonGoals.length > 0) {
        message += `🎯 *Топ-5 целей пользователей:*\n`;
        surveyData.mostCommonGoals.slice(0, 5).forEach((goal, index) => {
          if (goal.goal) {
            const percentage = goal.count > 0 ? Math.round((goal.count / surveyData.mostCommonGoals.reduce((sum, g) => sum + g.count, 0)) * 100) : 0;
            message += `${index + 1}. ${goal.goal}: ${goal.count} (${percentage}%)\n`;
          }
        });
        message += `\n`;
      }

      // Статистика завершения
      message += `📊 *Статистика завершения:*\n`;
      message += `• Среднее количество ответов: ${surveyData.averageQuestionsCompleted || 'Нет данных'}\n`;
      message += `• Процент бросающих опрос: ${surveyData.surveyAbandonmentRate || 0}%\n`;
      message += `• Удовлетворенность: ${surveyData.userSatisfaction?.estimated_satisfaction || 'Нет данных'}%\n\n`;

      // Рекомендации для админа
      message += `💡 *Рекомендации:*\n`;
      if (surveyData.surveyAbandonmentRate > 50) {
        message += `• Высокий процент бросающих - упростите опрос\n`;
      }
      if (surveyData.averageQuestionsCompleted < 5) {
        message += `• Пользователи проходят мало вопросов\n`;
      }
      if (!surveyData.mostCommonGoals || surveyData.mostCommonGoals.length === 0) {
        message += `• Недостаточно данных для анализа целей\n`;
      }

      if (message.length < 100) {
        message = '📊 *Данных для аналитики пока недостаточно.*\n\nПроведите несколько опросов для получения статистики.';
      }

      ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Ошибка аналитики опросника:', error);
      ctx.reply('❌ Ошибка загрузки аналитики опросника.');
    }
  },

  forceDailyReport: async (ctx) => {
    try {
      if (ctx.chat.id.toString() !== process.env.ADMIN_CHAT_ID) {
        ctx.reply('🚫 Эта команда доступна только администратору');
        return;
      }

      const analyticsService = require('../services/analyticsService');

      await ctx.reply('📊 Генерация ежедневного отчета...');
      const report = await analyticsService.generateDailyReport();

      if (report) {
        ctx.reply('✅ Ежедневный отчет сгенерирован и отправлен!');
      } else {
        ctx.reply('❌ Не удалось сгенерировать отчет. Проверьте логи.');
      }

    } catch (error) {
      console.error('❌ Ошибка отправки отчета:', error);
      ctx.reply('❌ Ошибка генерации отчета. Проверьте настройки бота.');
    }
  },

  checkMenuStatus: async (ctx) => {
    try {
      const subscriptionService = require('../services/subscriptionService');
      const isPremium = await subscriptionService.isSubscriptionActive(ctx.chat.id);

      const message = `🔍 *Диагностика меню*\n\n` +
        `• Premium статус: ${isPremium ? '✅ Да' : '❌ Нет'}\n` +
        `• Кнопки меню: ${isPremium ? 'Premium набор' : 'Free набор'}\n` +
        `• Chat ID: ${ctx.chat.id}\n\n` +
        `💡 *Доступные функции:*\n` +
        `${isPremium ? '✅ Все функции разблокированы' : '❌ Только базовые функции'}`;

      ctx.reply(message, { parse_mode: 'Markdown' });

      const { getMainMenuKeyboard } = require('../keyboards');
      ctx.reply('*Актуальное меню:*', {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard(isPremium)
      });

    } catch (error) {
      console.error('❌ Ошибка проверки меню:', error);
      ctx.reply('❌ Ошибка проверки статуса меню. Попробуйте позже.');
    }
  },

  checkPaymentSystem: async (ctx) => {
    try {
      const paymentService = require('../services/telegramPaymentService');
      const subscriptionService = require('../services/subscriptionService');

      const paymentInfo = paymentService.getPaymentSystemInfo();
      const plans = subscriptionService.getSubscriptionPlans();

      let message = `💳 ДИАГНОСТИКА ПЛАТЕЖНОЙ СИСТЕМЫ\n\n`;

      message += `📊 МЕТОД ПЛАТЕЖЕЙ:\n`;
      message += `• Telegram Payments (встроенные)\n`;
      message += `• Provider Token: ${paymentInfo.providerToken}\n`;
      message += `• Валюта: ${paymentInfo.currency}\n\n`;

      message += `📦 ПЛАН ПОДПИСКИ:\n`;
      message += `• ${plans.premium?.name || 'Premium'} - ${plans.premium?.price || '0'} руб\n\n`;

      message += `🔍 СТАТУС:\n`;

      if (!paymentInfo.providerToken) {
        message += `❌ Provider Token не установлен\n\n`;
        message += `💡 РЕКОМЕНДАЦИИ:\n`;
        message += `1. Получите provider_token от @BotFather\n`;
        message += `2. Добавьте в .env: YOOKASSA_PROVIDER_TOKEN=ваш_токен\n`;
        message += `3. Перезапустите бота\n`;
      } else {
        message += `✅ Готов к приему платежей\n\n`;
        message += `💡 ИСПОЛЬЗОВАНИЕ:\n`;
        message += `Используйте /subscribe для тестирования\n`;
        message += `Платежи будут проходить через Telegram\n`;
      }

      await ctx.reply(message);

    } catch (error) {
      console.error('❌ Ошибка диагностики:', error);
      await ctx.reply('❌ Ошибка диагностики платежной системы: ' + error.message);
    }
  },

  yookassaSettings: async (ctx) => {
    try {
      let message = `⚙️ *Проверка настроек ЮKassa*\n\n`;

      message += `1. ✅ Shop ID: ${process.env.YOOKASSA_SHOP_ID ? 'установлен' : 'не установлен'}\n`;
      message += `2. ✅ Secret Key: ${process.env.YOOKASSA_SECRET_KEY ? 'установлен' : 'не установлен'}\n`;
      message += `3. 🔄 Статус магазина: проверьте в кабинете ЮKassa\n`;
      message += `4. 🔄 API доступ: проверьте ключи API\n`;
      message += `5. 🔄 Способы оплаты: банковские карты должны быть включены\n\n`;

      message += `*Для тестирования:*\n`;
      message += `• Используйте /subscribe - создаст тестовый платеж\n`;
      message += `• Нажмите "Активировать Premium" для имитации оплаты\n`;

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Ошибка:', error);
      await ctx.reply('❌ Ошибка проверки настроек');
    }
  },

  checkTelegramPayments: async (ctx) => {
    try {
      const paymentService = require('../services/telegramPaymentService');

      let message = `💳 *СТАТУС TELEGRAM PAYMENTS*\n\n`;

      const paymentInfo = paymentService.getPaymentSystemInfo();

      message += `📊 *РЕЖИМ:* ${paymentInfo.providerToken.includes('LIVE') ? '💎 LIVE' : '🧪 TEST'}\n`;
      message += `🔧 *Метод:* ${paymentInfo.method}\n`;
      message += `✅ *Provider Token:* ${paymentInfo.providerToken}\n`;
      message += `📈 *Статус:* ${paymentInfo.status}\n\n`;

      if (paymentInfo.providerToken.includes('LIVE')) {
        message += `🎉 *ВСЕ НАСТРОЕНО ДЛЯ РЕАЛЬНЫХ ПЛАТЕЖЕЙ!*\n\n`;
        message += `💡 *Что делать:*\n`;
        message += `1. Используйте /subscribe\n`;
        message += `2. Оплачивайте реальной картой\n`;
        message += `3. Деньги будут поступать на ваш аккаунт ЮKassa\n\n`;
        message += `⚠️ *Примечание:*\n`;
        message += `• Secret Key не требуется\n`;
        message += `• Telegram сам обрабатывает платежи\n`;
        message += `• Вы получите provider_payment_charge_id\n`;
      } else {
        message += `❌ *Проблема:* Provider Token не настроен\n\n`;
        message += `💡 *Решение:*\n`;
        message += `1. Получите provider_token от @BotFather\n`;
        message += `2. Добавьте в .env: YOOKASSA_PROVIDER_TOKEN=ваш_токен\n`;
        message += `3. Перезапустите бота\n`;
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Ошибка проверки:', error);
      await ctx.reply('❌ Ошибка проверки статуса платежей');
    }
  },

  supportStatus: async (ctx) => {
    try {
      const supportService = require('../services/supportService');
      const history = await supportService.getUserSupportHistory(ctx.chat.id);

      let message = `📋 *Ваши обращения в поддержку:*\n\n`;

      if (history.length === 0) {
        message += `У вас пока нет обращений в поддержку.\nИспользуйте /support для создания обращения.`;
      } else {
        history.forEach((req, index) => {
          const date = new Date(req.created_at).toLocaleString('ru-RU');
          const status = req.status === 'resolved' ? '✅ Решено' : '⏳ В обработке';
          message += `${index + 1}. ${date} - ${status}\n`;
          message += `   📝 ${req.message}\n\n`;
        });
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Ошибка проверки статуса поддержки:', error);
      await ctx.reply('❌ Ошибка загрузки истории обращений.');
    }
  }

};
