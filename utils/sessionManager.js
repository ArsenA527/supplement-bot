const sessions = new Map();
class SessionManager {
  set(chatId, data) {
    console.log(`💾 SET session for ${chatId}:`, data);
    sessions.set(chatId.toString(), { ...data, lastUpdated: Date.now() });
  }

  get(chatId) {
    const session = sessions.get(chatId.toString());
    console.log(`💾 GET session for ${chatId}:`, session ? 'EXISTS' : 'NULL');

    if (session && Date.now() - session.lastUpdated > 30 * 60 * 1000) {
      // Сессия устарела (30 минут)
      this.delete(chatId);
      return null;
    }
    return session;
  }

  delete(chatId) {
    console.log(`💾 DELETE session for ${chatId}`);
    sessions.delete(chatId.toString());
  }
}

module.exports = new SessionManager();
