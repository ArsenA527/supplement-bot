const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

function backupDatabase() {
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup-${timestamp}.db`);

  try {
    fs.copyFileSync(
      path.join(__dirname, '..', 'data', 'bot.db'),
      backupFile
    );

    logger.info('Бэкап базы данных создан', { backupFile });

    // Очищаем старые бэкапы (оставляем последние 5)
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
      .sort()
      .reverse();

    if (files.length > 5) {
      files.slice(5).forEach(file => {
        fs.unlinkSync(path.join(backupDir, file));
        logger.info('Удален старый бэкап', { file });
      });
    }

  } catch (error) {
    logger.error('Ошибка создания бэкапа', { error: error.message });
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  backupDatabase();
}

module.exports = backupDatabase;
