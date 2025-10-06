class SessionManager {
  constructor() {
    this.sessions = new Map();
    // Очистка старых сессий каждые 5 минут
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  // Получить сессию пользователя
  get(chatId) {
    const session = this.sessions.get(chatId);

    if (session && Date.now() - session.lastAccess < 30 * 60 * 1000) { // 30 минут
      // Обновляем время доступа
      session.lastAccess = Date.now();
      return session.data;
    }

    // Если сессия устарела или не существует
    if (session) {
      this.sessions.delete(chatId); // Удаляем устаревшую
    }

    return null;
  }

  // Сохранить сессию
  set(chatId, data) {
    this.sessions.set(chatId, {
      data: data,
      lastAccess: Date.now(),
      createdAt: Date.now()
    });
    console.log(`💾 Сессия сохранена для ${chatId}`);
  }

  // Обновить данные сессии
  update(chatId, updates) {
    const session = this.sessions.get(chatId);
    if (session) {
      session.data = { ...session.data, ...updates };
      session.lastAccess = Date.now();
      console.log(`✏️ Сессия обновлена для ${chatId}`);
    }
  }

  // Удалить сессию
  delete(chatId) {
    if (this.sessions.has(chatId)) {
      this.sessions.delete(chatId);
      console.log(`🗑️ Сессия удалена для ${chatId}`);
    }
  }

  // Получить конкретное поле из сессии
  getField(chatId, field) {
    const session = this.get(chatId);
    return session ? session[field] : null;
  }

  // Очистка старых сессий (старше 30 минут)
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [chatId, session] of this.sessions.entries()) {
      if (now - session.lastAccess > 30 * 60 * 1000) { // 30 минут
        this.sessions.delete(chatId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Очищено ${cleanedCount} устаревших сессий`);
    }
  }

  // Статистика сессий (для отладки)
  getStats() {
    return {
      total: this.sessions.size,
      active: Array.from(this.sessions.values()).filter(s =>
        Date.now() - s.lastAccess < 10 * 60 * 1000 // Активные за последние 10 минут
      ).length
    };
  }
}

module.exports = new SessionManager();
