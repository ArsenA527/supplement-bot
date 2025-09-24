#!/bin/bash
echo "🚀 Запуск деплоя Supplement Bot в production..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Проверка переменных окружения
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ Файл .env.production не найден${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Обновление кода...${NC}"
git pull origin master

echo -e "${YELLOW}📦 Установка зависимостей...${NC}"
npm install --production

echo -e "${YELLOW}🔧 Создание папок...${NC}"
mkdir -p logs backups data

echo -e "${YELLOW}🔄 Перезапуск бота...${NC}"
pm2 stop supplement-bot || true
pm2 start ecosystem.config.js --env production

echo -e "${YELLOW}⏳ Ожидание запуска...${NC}"
sleep 5

# Проверка статуса
if pm2 list | grep -q "supplement-bot"; then
    echo -e "${GREEN}✅ Бот успешно запущен!${NC}"
    echo -e "\n📊 Команды для управления:"
    echo -e "   pm2 status              - Статус процессов"
    echo -e "   pm2 logs supplement-bot - Просмотр логов"
    echo -e "   pm2 monit               - Мониторинг в реальном времени"
else
    echo -e "${RED}❌ Ошибка запуска бота${NC}"
    pm2 logs supplement-bot --lines 20
fi
