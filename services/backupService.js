const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class BackupService {
  constructor() {
    this.backupDir = path.join(__dirname, '..', 'backups');
    this.ensureBackupDir();
  }

  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  createBackup() {
    try {
      const dbPath = path.join(__dirname, '..', 'data', 'bot.db');

      if (!fs.existsSync(dbPath)) {
        logger.warn('Файл базы данных не найден для бэкапа');
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupDir, `backup-${timestamp}.db`);

      fs.copyFileSync(dbPath, backupFile);

      this.cleanupOldBackups();
      logger.info('Бэкап базы данных создан', { backupFile });

    } catch (error) {
      logger.error('Ошибка создания бэкапа', { error: error.message });
    }
  }

  cleanupOldBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          time: fs.statSync(path.join(this.backupDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > 10) {
        files.slice(10).forEach(file => {
          fs.unlinkSync(file.path);
          logger.info('Удален старый бэкап', { file: file.name });
        });
      }
    } catch (error) {
      logger.error('Ошибка очистки бэкапов', { error: error.message });
    }
  }

  getBackupList() {
    try {
      return fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
        .sort()
        .reverse();
    } catch (error) {
      logger.error('Ошибка получения списка бэкапов', { error: error.message });
      return [];
    }
  }
}

module.exports = new BackupService();
