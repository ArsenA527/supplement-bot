const sessions = new Map();
class SessionManager {
  set(chatId, data) {
    sessions.set(chatId.toString(), { ...data, lastUpdated: Date.now() });
  }

  get(chatId) {
    const session = sessions.get(chatId.toString());

    if (session && Date.now() - session.lastUpdated > 30 * 60 * 1000) {
      this.delete(chatId);
      return null;
    }
    return session;
  }

  delete(chatId) {
    sessions.delete(chatId.toString());
  }
}

module.exports = new SessionManager();
