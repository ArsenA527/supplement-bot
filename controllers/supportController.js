const db = require('../config/database');

class SupportController {
  static async handleSupportCommand(ctx) {
    try {
      const supportChatId = process.env.SUPPORT_CHAT_ID;
      if (!supportChatId) {
        await ctx.reply(
          '❌ Система поддержки временно недоступна. ' +
          'Администратору нужно настроить SUPPORT_CHAT_ID.'
        );
        return;
      }

      await ctx.reply(
        '💬 *Режим поддержки активирован*\n\n' +
        'Опишите вашу проблему или вопрос. Наша команда ответит в ближайшее время.\n\n' +
        'Просто напишите ваше сообщение ниже 👇\n\n' +
        '_Для отмены используйте /cancel_',
        { parse_mode: 'Markdown' }
      );

      const sessionManager = require('../utils/sessionManager');
      sessionManager.set(ctx.chat.id, {
        waitingForSupport: true,
        supportRequestTime: new Date()
      });
    } catch (error) {
      console.error('❌ Ошибка активации поддержки:', error);
      await ctx.reply('❌ Ошибка активации поддержки. Попробуйте позже.');
    }
  }

  static async forwardToSupport(ctx, messageText) {
    try {
      const user = ctx.from;
      const chatId = ctx.chat.id;

      const supportChatId = process.env.SUPPORT_CHAT_ID;
      if (!supportChatId) {
        throw new Error('SUPPORT_CHAT_ID не установлен');
      }

      const supportMessage = `🆘 *НОВОЕ ОБРАЩЕНИЕ В ПОДДЕРЖКУ*\n\n` +
        `👤 *Пользователь:* ${user.first_name}${user.last_name ? ' ' + user.last_name : ''}\n` +
        `📱 *Username:* ${user.username ? '@' + user.username : 'не указан'}\n` +
        `🆔 *ID:* ${chatId}\n` +
        `⏰ *Время:* ${new Date().toLocaleString('ru-RU')}\n\n` +
        `💬 *Сообщение:*\n${messageText}`;

      await ctx.telegram.sendMessage(supportChatId, supportMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '📝 Ответить пользователю',
              url: `tg://user?id=${chatId}`
            }
          ]]
        }
      });

      await this.saveSupportRequest(ctx, messageText);
      await ctx.reply('✅ Ваше сообщение отправлено в поддержку! Мы ответим в ближайшее время.');

      const sessionManager = require('../utils/sessionManager');
      sessionManager.delete(ctx.chat.id);
    } catch (error) {
      console.error('❌ Ошибка пересылки в поддержку:', error);
      await ctx.reply('❌ Ошибка отправки сообщения. Попробуйте позже.');
    }
  }

  static async saveSupportRequest(ctx, messageText) {
    return new Promise((resolve, reject) => {
      const user = ctx.from;

      db.run(
        `INSERT INTO support_requests
          (user_id, username, first_name, last_name, message, message_id)
          VALUES (?, ?, ?, ?, ?, ?)`,
        [
          ctx.chat.id,
          user.username || null,
          user.first_name || null,
          user.last_name || null,
          messageText,
          ctx.message.message_id
        ],
        function(err) {
          if (err) {
            console.error('❌ Ошибка сохранения обращения:', err);
            reject(err);
          } else {
            console.log('✅ Обращение сохранено, ID:', this.lastID);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  static async getSupportStats() {
    return new Promise((resolve) => {
      db.get(
        `SELECT
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'new' THEN 1 END) as new_requests,
          COUNT(CASE WHEN status = 'answered' THEN 1 END) as answered_requests
          FROM support_requests
          WHERE created_at > datetime('now', '-7 days')`,
        (err, row) => {
          if (err) {
            console.error('❌ Ошибка получения статистики поддержки:', err);
            resolve({ total_requests: 0, new_requests: 0, answered_requests: 0 });
          } else {
            resolve(row || { total_requests: 0, new_requests: 0, answered_requests: 0 });
          }
        }
      );
    });
  }
}

module.exports = SupportController;
