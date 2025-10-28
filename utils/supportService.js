// services/supportService.js
const db = require('../config/database');

class SupportService {
  constructor() {
    this.supportChatId = process.env.SUPPORT_CHAT_ID || '-4967961833';
  }

  // Отправить сообщение в группу поддержки
  async forwardToSupport(chatId, userMessage, userInfo) {
    try {
      if (!this.supportChatId) {
        throw new Error('SUPPORT_CHAT_ID не настроен');
      }

      const bot = global.botInstance;
      if (!bot) {
        throw new Error('Бот не инициализирован');
      }

      // Форматируем сообщение для группы поддержки
      const supportMessage = this.formatSupportMessage(chatId, userMessage, userInfo);

      // Отправляем в группу поддержки
      await bot.telegram.sendMessage(this.supportChatId, supportMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '💬 Ответить пользователю',
                callback_data: `support_reply_${chatId}`
              }
            ],
            [
              {
                text: '✅ Решено',
                callback_data: `support_resolved_${chatId}`
              },
              {
                text: '📋 Детали',
                callback_data: `support_details_${chatId}`
              }
            ]
          ]
        }
      });

      // Сохраняем в историю обращений
      await this.saveSupportRequest(chatId, userMessage);

      return true;

    } catch (error) {
      console.error('❌ Ошибка отправки в поддержку:', error);
      throw error;
    }
  }

  // Форматирование сообщения для поддержки
  formatSupportMessage(chatId, userMessage, userInfo) {
    const timestamp = new Date().toLocaleString('ru-RU');

    let message = `🆘 *НОВОЕ ОБРАЩЕНИЕ В ПОДДЕРЖКУ*\n\n`;
    message += `👤 *Пользователь:* ${userInfo.first_name || 'Неизвестно'}`;

    if (userInfo.username) {
      message += ` (@${userInfo.username})`;
    }

    message += `\n🆔 *ID:* ${chatId}`;
    message += `\n⏰ *Время:* ${timestamp}`;
    message += `\n\n📝 *Сообщение:*\n${userMessage}`;
    message += `\n\n━━━━━━━━━━━━━━━━━━━━`;

    return message;
  }

  // Сохранить обращение в базу
  async saveSupportRequest(chatId, message) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO support_requests (chat_id, message, status, created_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [chatId, message, 'pending', new Date().toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  // Обновить статус обращения
  async updateRequestStatus(requestId, status) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE support_requests SET status = ?, updated_at = datetime('now') WHERE id = ?`,
        [status, requestId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Ответить пользователю
  async replyToUser(userChatId, supportMessage, adminName) {
    try {
      const bot = global.botInstance;
      if (!bot) throw new Error('Бот не инициализирован');

      const message = `💬 *Ответ от поддержки* (${adminName}):\n\n${supportMessage}`;

      await bot.telegram.sendMessage(userChatId, message, {
        parse_mode: 'Markdown'
      });

      return true;

    } catch (error) {
      console.error('❌ Ошибка ответа пользователю:', error);

      // Если не удалось отправить (пользователь заблокировал бота и т.д.)
      if (error.response && error.response.error_code === 403) {
        throw new Error('Пользователь заблокировал бота');
      }

      throw error;
    }
  }

  // Получить историю обращений пользователя
  async getUserSupportHistory(chatId) {
    return new Promise((resolve) => {
      db.all(
        `SELECT * FROM support_requests
         WHERE chat_id = ?
         ORDER BY created_at DESC
         LIMIT 10`,
        [chatId],
        (err, rows) => {
          if (err) {
            console.error('❌ Ошибка получения истории:', err);
            resolve([]);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }
}

module.exports = new SupportService();
