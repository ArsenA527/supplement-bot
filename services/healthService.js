const db = require('../config/database');
const logger = require('../utils/logger');

class HealthService {
  async checkDatabase() {
    return new Promise((resolve) => {
      db.get('SELECT 1 as test', (err) => {
        if (err) {
          logger.error('Health check: Database error', { error: err.message });
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async checkBotAPI() {
    // Проверяем что бот может отправлять сообщения
    try {
      // Эта проверка будет добавлена позже
      return true;
    } catch (error) {
      logger.error('Health check: Bot API error', { error: error.message });
      return false;
    }
  }

  async fullHealthCheck() {
    const checks = {
      database: await this.checkDatabase(),
      bot_api: await this.checkBotAPI(),
      timestamp: new Date().toISOString()
    };

    const allHealthy = Object.values(checks).every(check => check === true);

    logger.info('Health check completed', {
      healthy: allHealthy,
      checks
    });

    return {
      healthy: allHealthy,
      checks
    };
  }
}

module.exports = new HealthService();
