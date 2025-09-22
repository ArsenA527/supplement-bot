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

// Создаем таблицы при инициализации
db.serialize(() => {
  // Таблица пользователей
  db.run(`CREATE TABLE IF NOT EXISTS users (
    chat_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    state TEXT,
    answers TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица подписок
  db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER UNIQUE,
    plan TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME,
    payment_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

  console.log('✅ База данных инициализирована');
});

// После существующих таблиц добавляем:
db.serialize(() => {
  // Таблица напоминаний
  db.run(`CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    supplement_name TEXT,
    dosage TEXT,
    time TEXT,
    days TEXT DEFAULT '1111111', -- 7 digits for each day of week (1=active, 0=inactive)
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES users (chat_id)
  )`);

  // Таблица истории приема
  db.run(`CREATE TABLE IF NOT EXISTS intake_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    supplement_name TEXT,
    dosage TEXT,
    taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'taken', -- 'taken', 'skipped', 'missed'
    FOREIGN KEY (chat_id) REFERENCES users (chat_id)
  )`);

  // Таблица настроек уведомлений
  db.run(`CREATE TABLE IF NOT EXISTS notification_settings (
    chat_id INTEGER PRIMARY KEY,
    morning_time TEXT DEFAULT '08:00',
    afternoon_time TEXT DEFAULT '13:00',
    evening_time TEXT DEFAULT '20:00',
    allow_notifications BOOLEAN DEFAULT true,
    timezone TEXT DEFAULT 'Europe/Moscow',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES users (chat_id)
  )`);

  console.log('✅ Таблицы напоминаний созданы');

  db.run(`CREATE TABLE IF NOT EXISTS intake_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    supplement_name TEXT,
    dosage TEXT,
    taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'taken',
    FOREIGN KEY (chat_id) REFERENCES users (chat_id)
  )`);

  console.log('✅ Таблица истории приема создана/проверена');

  // Таблица платежей
  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    amount REAL,
    currency TEXT DEFAULT 'RUB',
    status TEXT,
    yookassa_id TEXT,
    plan TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES users (chat_id)
  )`);

  console.log('✅ Таблица платежей создана');
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
