#!/bin/bash
echo "🚀 Запуск Supplement Bot в production..."

# Проверяем что PM2 установлен
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 не установлен. Устанавливаем..."
    npm install -g pm2
fi

# Проверяем что переменные окружения установлены
if [ -z "$BOT_TOKEN" ]; then
    echo "❌ BOT_TOKEN не установлен. Укажите в .env или экспортируйте:"
    echo "export BOT_TOKEN=your_token_here"
    exit 1
fi

# Создаем папки для логов
mkdir -p logs

# Запускаем бота
pm2 start ecosystem.config.js --env production

# Настраиваем автостарт при загрузке системы
pm2 startup
pm2 save

echo "✅ Бот запущен! Используйте:"
echo "npm run logs    - просмотр логов"
echo "npm run status  - статус процессов"
echo "npm run monit   - мониторинг"
