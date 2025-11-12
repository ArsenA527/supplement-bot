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
    survey_message_id INTEGER,
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

  console.log('✅ Таблица истории приема создана/проверена');

  // Таблица notification_settings с updated_at
  db.run(`CREATE TABLE IF NOT EXISTS notification_settings (
    chat_id INTEGER PRIMARY KEY,
    morning_time TEXT DEFAULT '08:00',
    afternoon_time TEXT DEFAULT '13:00',
    evening_time TEXT DEFAULT '20:00',
    allow_notifications BOOLEAN DEFAULT true,
    timezone TEXT DEFAULT 'Europe/Moscow',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES users (chat_id)
  )`, (err) => {
    if (err) {
      console.error('❌ Ошибка создания таблицы notification_settings:', err);
    } else {
      console.log('✅ Таблица notification_settings создана/проверена');
    }
  });

  console.log('✅ Таблицы напоминаний созданы');

  db.run(`DROP TABLE IF EXISTS payments`, (err) => {
    if (err) console.log('ℹ️ Таблица payments не существует');

    // Создаем новую с правильной структурой
    db.run(`CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER,
      amount REAL,
      currency TEXT DEFAULT 'RUB',
      status TEXT,
      yookassa_id TEXT,
      plan TEXT,
      provider_payload TEXT,
      telegram_payment_charge_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES users (chat_id)
    )`, (err) => {
      if (err) {
        console.error('❌ Ошибка создания таблицы payments:', err);
      } else {
        console.log('✅ Таблица payments пересоздана с правильной структурой');
      }
    });
  });

  console.log('✅ Таблица платежей создана');

  // Таблица целей пользователя
  db.run(`CREATE TABLE IF NOT EXISTS user_goals (
    chat_id INTEGER PRIMARY KEY,
    main_goal TEXT DEFAULT 'Общее оздоровление',
    secondary_goals TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES users (chat_id)
  )`);

  console.log('✅ Таблица целей создана/проверена');

  // Таблица достижений
  db.run(`CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    achievement_id TEXT,
    awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, achievement_id),
    FOREIGN KEY (chat_id) REFERENCES users (chat_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    event_name TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS support_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    message TEXT NOT NULL,
    message_id INTEGER,
    status TEXT DEFAULT 'new', -- 'new', 'in_progress', 'answered', 'closed'
    priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    admin_id INTEGER,
    admin_username TEXT,
    admin_notes TEXT,
    response_time INTEGER, -- время ответа в минутах
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    answered_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users (chat_id)
  )`);
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

const backupService = require('../services/backupService.js');

// Автоматический бэкап при старте
backupService.createBackup();

// Бэкап каждые 6 часов
setInterval(() => {
  backupService.createBackup();
}, 6 * 60 * 60 * 1000);

console.log('✅ Сервис бэкапов инициализирован');

module.exports = db;
