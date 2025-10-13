class AntiSpam {
  constructor() {
    this.processingRequests = new Map();
    this.timeoutMs = 2000;
  }

  canProcess(chatId, actionType) {
    const key = `${chatId}_${actionType}`;

    if (this.processingRequests.has(key)) {
      return false;
    }

    this.processingRequests.set(key, Date.now());

    setTimeout(() => {
      this.processingRequests.delete(key);
    }, this.timeoutMs);

    return true;
  }

  release(chatId, actionType) {
    const key = `${chatId}_${actionType}`;
    this.processingRequests.delete(key);
  }

  getRemainingTime(chatId, actionType) {
    const key = `${chatId}_${actionType}`;
    const startTime = this.processingRequests.get(key);

    if (!startTime) return 0;

    const elapsed = Date.now() - startTime;
    return Math.max(0, this.timeoutMs - elapsed);
  }
}

module.exports = new AntiSpam();
