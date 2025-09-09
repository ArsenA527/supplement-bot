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
  // Таблица подписок
  db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER UNIQUE,
    plan TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME,
    payment_data TEXT,
    FOREIGN KEY (chat_id) REFERENCES users (chat_id)
  )`);

  // Таблица платежей
  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    amount REAL,
    currency TEXT DEFAULT 'RUB',
    status TEXT,
    yookassa_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES users (chat_id)
  )`);

  console.log('✅ Таблицы подписок и платежей созданы');
});

// Graceful shutdown для БД
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
