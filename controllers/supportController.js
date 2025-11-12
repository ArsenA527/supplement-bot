const db = require('../config/database');
const logger = require('../utils/logger');
const NotificationManager = require('../utils/notifications');

class SupportController {
  static async handleSupportCommand(ctx) {
    await ctx.reply(
      '💬 Опишите вашу проблему или вопрос — команда поддержки скоро ответит!\n\n' +
      '✏️ Просто напишите ваше сообщение, и оно будет сразу переправлено нашей команде.'
    );

    // Используем сессию для отслеживания состояния
    ctx.session = ctx.session || {};
    ctx.session.waitingForSupport = true;
    ctx.session.supportRequestTime = new Date();

    logger.info('Пользователь начал диалог с поддержкой', {
      chatId: ctx.chat.id,
      username: ctx.from.username,
      timestamp: ctx.session.supportRequestTime
    });
  }

  static async forwardToSupport(ctx, messageText) {
    try {
      const user = ctx.from;
      const userName = user.username
        ? `@${user.username}`
        : `${user.first_name || 'Пользователь'} ${user.last_name || ''}`.trim();

      const userId = ctx.chat.id;
      const messageId = ctx.message.message_id;

      const forwardedText = `📩 *Новое сообщение в поддержку*\n\n` +
        `👤 *Пользователь:* ${userName}\n` +
        `🆔 *ID:* ${userId}\n` +
        `📅 *Время:* ${new Date().toLocaleString('ru-RU')}\n\n` +
        `💬 *Сообщение:*\n${messageText}\n\n` +
        `_[Ответить](/start)_`;

      // Отправляем в чат поддержки
      await ctx.telegram.sendMessage(
        process.env.SUPPORT_CHAT_ID,
        forwardedText,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              {
                text: '📝 Ответить пользователю',
                url: `tg://user?id=${userId}`
              }
            ]]
          }
        }
      );

      // Сохраняем в базу для истории
      this.saveSupportRequest({
        user_id: userId,
        username: userName,
        message: messageText,
        message_id: messageId,
        created_at: new Date()
      });

      await ctx.reply('✅ Ваше сообщение отправлено в поддержку. Мы ответим в ближайшее время!');

      // Сбрасываем состояние
      ctx.session.waitingForSupport = false;

      logger.info('Сообщение переслано в поддержку', {
        chatId: ctx.chat.id,
        supportChatId: process.env.SUPPORT_CHAT_ID
      });

    } catch (error) {
      logger.error('Ошибка пересылки в поддержку', {
        error: error.message,
        chatId: ctx.chat.id
      });

      await ctx.reply('❌ Произошла ошибка при отправке сообщения. Попробуйте еще раз через несколько минут.');
    }
  }

  static saveSupportRequest(requestData) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO support_requests
         (user_id, username, message, message_id, created_at, status)
         VALUES (?, ?, ?, ?, ?, 'new')`,
        [
          requestData.user_id,
          requestData.username,
          requestData.message,
          requestData.message_id,
          requestData.created_at
        ],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  static async getSupportStats(ctx) {
    // Статистика для админа
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'new' THEN 1 END) as new_requests,
          COUNT(CASE WHEN status = 'answered' THEN 1 END) as answered_requests
         FROM support_requests
         WHERE created_at > datetime('now', '-7 days')`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0]);
        }
      );
    });
  }
}

module.exports = SupportController;
