const db = require('../config/database');

class AdminController {
  static async handleAdminReply(ctx) {
    try {
      if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.text) {
        return; // Не ответ на обращение поддержки
      }

      const replyToMessage = ctx.message.reply_to_message.text;
      const adminReply = ctx.message.text;
      const admin = ctx.from;

      const userIdMatch = replyToMessage.match(/🆔\s*\*\*ID:\*\*\s*(\d+)/);
      if (!userIdMatch) {
        await ctx.reply('❌ Не удалось определить пользователя для ответа');
        return;
      }

      const userId = userIdMatch[1];

      await this.sendReplyToUser(ctx, userId, adminReply, admin);
      await this.updateSupportRequestStatus(userId, adminReply, admin);
      await ctx.reply('✅ Ответ отправлен пользователю!');
    } catch (error) {
      console.error('❌ Ошибка обработки ответа админа:', error);
      await ctx.reply('❌ Ошибка отправки ответа');
    }
  }

  static async sendReplyToUser(ctx, userId, reply, admin) {
    const adminName = admin.first_name + (admin.last_name ? ' ' + admin.last_name : '');
    const adminUsername = admin.username ? `@${admin.username}` : adminName;

    const userMessage = `💌 *Ответ от поддержки*\n\n` +
      `📝 *Сообщение:*\n${reply}\n\n` +
      `👨‍💼 *От:* ${adminUsername}\n\n` +
      `_Для продолжения диалога используйте /support_`;

    await ctx.telegram.sendMessage(userId, userMessage, {
      parse_mode: 'Markdown'
    });
  }

  static async updateSupportRequestStatus(userId, adminReply, admin) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE support_requests
          SET status = 'answered',
              admin_id = ?,
              admin_username = ?,
              answered_at = ?,
              response_time = ROUND((julianday(?) - julianday(created_at)) * 24 * 60)
          WHERE user_id = ? AND status = 'new'
          ORDER BY created_at DESC
          LIMIT 1`,
        [
          admin.id,
          admin.username || `${admin.first_name}${admin.last_name ? ' ' + admin.last_name : ''}`,
          new Date().toISOString(),
          new Date().toISOString(),
          userId
        ],
        function(err) {
          if (err) {
            console.error('❌ Ошибка обновления статуса обращения:', err);
            reject(err);
          } else {
            console.log('✅ Статус обращения обновлен, изменено записей:', this.changes);
            resolve(this.changes);
          }
        }
      );
    });
  }

  static async getSupportStats(ctx) {
    try {
      const stats = await this.fetchSupportStats();

      const message = `📊 *Статистика поддержки*\n\n` +
        `📨 Всего обращений: ${stats.total_requests}\n` +
        `🆕 Новых: ${stats.new_requests}\n` +
        `✅ Отвеченных: ${stats.answered_requests}\n` +
        `⏱️ Среднее время ответа: ${stats.avg_response_time || 0} мин.`;

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('❌ Ошибка получения статистики:', error);
      await ctx.reply('❌ Ошибка загрузки статистики');
    }
  }

  static async fetchSupportStats() {
    return new Promise((resolve) => {
      db.get(
        `SELECT
            COUNT(*) as total_requests,
            COUNT(CASE WHEN status = 'new' THEN 1 END) as new_requests,
            COUNT(CASE WHEN status = 'answered' THEN 1 END) as answered_requests,
            AVG(response_time) as avg_response_time
          FROM support_requests
          WHERE created_at > datetime('now', '-7 days')`,
        (err, row) => {
          if (err) {
            console.error('❌ Ошибка получения статистики:', err);
            resolve({ total_requests: 0, new_requests: 0, answered_requests: 0, avg_response_time: 0 });
          } else {
            resolve(row || { total_requests: 0, new_requests: 0, answered_requests: 0, avg_response_time: 0 });
          }
        }
      );
    });
  }
}

module.exports = AdminController;
