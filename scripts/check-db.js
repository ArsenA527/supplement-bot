const db = require('../config/database');

console.log('🔍 Проверяем структуру базы данных...');

// Проверяем существование таблиц
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('❌ Ошибка проверки таблиц:', err);
    return;
  }

  console.log('📊 Найдены таблицы:');
  tables.forEach(table => {
    console.log(`• ${table.name}`);
  });

  // Проверяем структуру таблицы users
  db.all("PRAGMA table_info(users)", (err, columns) => {
    console.log('\n📋 Структура таблицы users:');
    columns.forEach(col => {
      console.log(`• ${col.name} (${col.type})`);
    });

    db.close();
  });
});
