class NotificationManager {
  // Успешное завершение операции
  static success(ctx, message) {
    return ctx.reply(`✅ ${message}`);
  }

  // Предупреждение
  static warning(ctx, message) {
    return ctx.reply(`⚠️ ${message}`);
  }

  // Ошибка
  static error(ctx, message) {
    return ctx.reply(`❌ ${message}`);
  }

  // Информационное сообщение
  static info(ctx, message) {
    return ctx.reply(`ℹ️ ${message}`);
  }

  // Сообщение о загрузке
  static loading(ctx, message = 'Пожалуйста, подождите...') {
    return ctx.reply(`⏳ ${message}`);
  }

  // Красивое приветствие
  static welcome(ctx, username) {
    const welcomeMessages = [
      `👋 Привет, ${username}! Рад тебя видеть!`,
      `🎉 Добро пожаловать, ${username}! Начнем улучшение здоровья?`,
      `🌟 Приветствую, ${username}! Готов стать здоровее?`
    ];

    const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
    return ctx.reply(randomMessage);
  }
}

module.exports = NotificationManager;
