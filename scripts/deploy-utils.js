// scripts/deploy-utils.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class DeployUtils {
  constructor() {
    this.botName = 'supplement-bot';
  }

  // Выполнение команды с Promise
  async executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      exec(command, options, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ Ошибка выполнения: ${command}`, error);
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

  // Создание бэкапа базы данных
  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(__dirname, '..', 'backups');
      const backupFile = path.join(backupDir, `backup-${timestamp}.db`);

      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const dbPath = path.join(__dirname, '..', 'data', 'bot.db');
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupFile);
        console.log(`✅ Бэкап создан: ${backupFile}`);
        return backupFile;
      } else {
        console.log('⚠️ Файл базы данных не найден для бэкапа');
        return null;
      }
    } catch (error) {
      console.error('❌ Ошибка создания бэкапа:', error);
      return null;
    }
  }

  // Очистка старых бэкапов (оставляем последние 5)
  async cleanupOldBackups() {
    try {
      const backupDir = path.join(__dirname, '..', 'backups');
      if (!fs.existsSync(backupDir)) return;

      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
        .map(f => path.join(backupDir, f))
        .sort((a, b) => fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime());

      if (files.length > 5) {
        const toDelete = files.slice(5);
        toDelete.forEach(file => {
          fs.unlinkSync(file);
          console.log(`🗑️ Удален старый бэкап: ${path.basename(file)}`);
        });
      }
    } catch (error) {
      console.error('❌ Ошибка очистки бэкапов:', error);
    }
  }

  // Проверка здоровья бота
  async checkBotHealth() {
    try {
      const { stdout } = await this.executeCommand('pm2 jlist');
      const processes = JSON.parse(stdout);
      const botProcess = processes.find(p => p.name === this.botName);

      if (!botProcess) {
        return { healthy: false, error: 'Процесс не найден' };
      }

      if (botProcess.pm2_env.status !== 'online') {
        return { healthy: false, error: `Статус: ${botProcess.pm2_env.status}` };
      }

      // Проверяем что бот отвечает (можно добавить ping до webhook)
      return {
        healthy: true,
        uptime: botProcess.pm2_env.pm_uptime,
        memory: botProcess.monit.memory,
        status: botProcess.pm2_env.status
      };

    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  // Отправка уведомления в Telegram
  async sendDeployNotification(message, isError = false) {
    try {
      const botToken = process.env.BOT_TOKEN;
      const adminChatId = process.env.ADMIN_CHAT_ID;

      if (!botToken || !adminChatId) {
        console.log('⚠️ Не могу отправить уведомление: нет BOT_TOKEN или ADMIN_CHAT_ID');
        return;
      }

      const emoji = isError ? '❌' : '✅';
      const text = `${emoji} *Деплой Бота*\n\n${message}\n\n_${new Date().toLocaleString('ru-RU')}_`;

      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: text,
          parse_mode: 'Markdown'
        })
      });

      if (!response.ok) {
        console.error('❌ Ошибка отправки уведомления:', await response.text());
      } else {
        console.log('✅ Уведомление отправлено');
      }

    } catch (error) {
      console.error('❌ Ошибка отправки уведомления:', error);
    }
  }

  // Откат на предыдущую версию (простой вариант через git)
  async rollbackToPreviousVersion() {
    try {
      console.log('🔄 Попытка отката...');
      await this.executeCommand('git reset --hard HEAD~1');
      await this.executeCommand('npm install --production');
      await this.executeCommand(`pm2 restart ${this.botName}`);

      const health = await this.checkBotHealth();
      if (health.healthy) {
        await this.sendDeployNotification('✅ Откат выполнен успешно! Бот работает на предыдущей версии.');
        return true;
      } else {
        throw new Error('Бот не запустился после отката');
      }
    } catch (error) {
      await this.sendDeployNotification(`❌ Ошибка отката: ${error.message}`, true);
      return false;
    }
  }
}

module.exports = new DeployUtils();
