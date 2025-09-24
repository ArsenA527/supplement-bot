const logger = require('../utils/logger');

logger.info('🧪 Тестирование production окружения...');

// Проверяем критически важные функции
const tests = [
  {
    name: 'База данных',
    test: () => require('../config/database').get('SELECT 1')
  },
  {
    name: 'Логгер',
    test: () => {
      logger.info('Тест логгера');
      return true;
    }
  },
  {
    name: 'Бэкап сервис',
    test: () => require('../services/backupService').getBackupList()
  }
];

async function runTests() {
  logger.info('Запуск тестов...');

  for (const test of tests) {
    try {
      await test.test();
      logger.info(`✅ ${test.name} - ОК`);
    } catch (error) {
      logger.error(`❌ ${test.name} - ОШИБКА`, { error: error.message });
    }
  }

  logger.info('Тестирование завершено');
}

runTests();
