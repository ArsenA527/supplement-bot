const logger = require('../utils/logger');

class MotivationService {
  constructor() {
    this.motivationalMessages = {
      high_compliance: [
        "🎉 Отличная работа! Ваша дисциплина впечатляет!",
        "💪 Вы на правильном пути! Так держать!",
        "🌟 Идеальное соблюдение режима! Вы - пример для подражания!"
      ],
      medium_compliance: [
        "👍 Хорошие результаты! Можно еще лучше!",
        "📈 Неплохо! Попробуйте не пропускать приемы на следующей неделе",
        "💡 Вы близки к отличным результатам! Продолжайте!"
      ],
      low_compliance: [
        "🤔 Заметили пропуски? Попробуйте установить напоминания",
        "🔄 Каждый день - новая возможность начать с чистого листа!",
        "💪 Не сдавайтесь! Регулярность - ключ к успеху!"
      ],
      streak_milestones: {
        3: "🔥 Отличное начало! 3 дня подряд!",
        7: "🚀 Неделя дисциплины! Вы восхитительны!",
        14: "🌈 2 недели регулярного приема! Супер!",
        30: "🏆 Целый месяц! Вы - мастер дисциплины!"
      }
    };
  }

  // Получить мотивационное сообщение based на статистике
  async getMotivationalMessage(chatId) {
    try {
      const reminderService = require('./reminderService');
      const service = new reminderService();
      const goalService = require('./goalService');

      const [weeklyStats, progress] = await Promise.all([
        service.getIntakeStats(chatId, 7),
        goalService.getDetailedProgress(chatId)
      ]);

      let message = '';

      // Based на проценте соблюдения
      if (weeklyStats.compliance >= 90) {
        message = this.getRandomMessage('high_compliance');
      } else if (weeklyStats.compliance >= 70) {
        message = this.getRandomMessage('medium_compliance');
      } else {
        message = this.getRandomMessage('low_compliance');
      }

      // Добавляем сообщение о серии
      if (progress.weekly.streak > 0) {
        const streakMessage = this.motivationalMessages.streak_milestones[progress.weekly.streak];
        if (streakMessage) {
          message += `\n\n${streakMessage}`;
        }
      }

      // Добавляем статистику
      message += `\n\n📊 Ваша статистика: ${weeklyStats.compliance}% соблюдения, серия: ${progress.weekly.streak} дней`;

      return message;

    } catch (error) {
      logger.error('Ошибка генерации мотивационного сообщения', { chatId, error: error.message });
      return "💪 Продолжайте заботиться о своем здоровье! Каждый день важен!";
    }
  }

  getRandomMessage(type) {
    const messages = this.motivationalMessages[type];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  // Отправить еженедельный мотивационный отчет
  async sendWeeklyMotivation(ctx) {
    try {
      const message = await this.getMotivationalMessage(ctx.chat.id);
      await ctx.reply(`💫 *Ваша недельная мотивация*\n\n${message}`, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('Ошибка отправки мотивации', { chatId: ctx.chat.id, error: error.message });
    }
  }
}

module.exports = new MotivationService();
