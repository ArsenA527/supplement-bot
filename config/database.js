const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Создаем папку data если ее нет
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'bot.db');
const db = new sqlite3.Database(dbPath);

// Создаем таблицы
db.serialize(() => {
  // Основная таблица пользователей
  db.run(`CREATE TABLE IF NOT EXISTS users (
    chat_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    state TEXT,
    answers TEXT,
    subscription TEXT DEFAULT 'free',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('✅ База данных инициализирована');
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('❌ Ошибка закрытия БД:', err);
    } else {
      console.log('✅ БД соединение закрыто');
    }
    process.exit(0);
  });
});

module.exports = db;
