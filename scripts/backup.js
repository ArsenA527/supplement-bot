const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function backupDatabase() {
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup-${timestamp}.db`);

  // Копируем базу данных
  fs.copyFileSync(
    path.join(__dirname, '..', 'data', 'bot.db'),
    backupFile
  );

  console.log(`✅ Бэкап создан: ${backupFile}`);
}

// Бэкап каждые 6 часов
setInterval(backupDatabase, 6 * 60 * 60 * 1000);
backupDatabase(); // Первый бэкап сразу
