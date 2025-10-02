// /utils/antiSpam.js
class AntiSpam {
  constructor() {
    this.processingRequests = new Map();
    this.timeoutMs = 2000; // 2 секунды защиты
  }

  // Проверяем можно ли обработать запрос
  canProcess(chatId, actionType) {
    const key = `${chatId}_${actionType}`;

    if (this.processingRequests.has(key)) {
      return false;
    }

    // Помечаем как обрабатываемый
    this.processingRequests.set(key, Date.now());

    // Автоматически очищаем через timeoutMs
    setTimeout(() => {
      this.processingRequests.delete(key);
    }, this.timeoutMs);

    return true;
  }

  // Принудительно освобождаем запрос (если обработка завершена)
  release(chatId, actionType) {
    const key = `${chatId}_${actionType}`;
    this.processingRequests.delete(key);
  }

  // Получаем оставшееся время блокировки
  getRemainingTime(chatId, actionType) {
    const key = `${chatId}_${actionType}`;
    const startTime = this.processingRequests.get(key);

    if (!startTime) return 0;

    const elapsed = Date.now() - startTime;
    return Math.max(0, this.timeoutMs - elapsed);
  }
}

module.exports = new AntiSpam();
