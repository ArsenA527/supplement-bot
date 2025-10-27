#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функции для логирования
log_info() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️ $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Основная функция
main() {
  echo -e "${GREEN}🚀 Запуск Supplement Bot в production...${NC}"

  # Проверка переменных окружения
  if [ -z "$BOT_TOKEN" ]; then
    log_error "BOT_TOKEN не установлен"
    echo "Укажите в .env или экспортируйте:"
    echo "export BOT_TOKEN=your_token_here"
    exit 1
  fi

  if [ -z "$ADMIN_CHAT_ID" ]; then
      log_warning "ADMIN_CHAT_ID не установлен - уведомления не будут работать"
  fi

  # Проверка PM2
  if ! command -v pm2 &> /dev/null; then
    log_warning "PM2 не установлен. Устанавливаем..."
    npm install -g pm2
    if [ $? -ne 0 ]; then
      log_error "Не удалось установить PM2"
      exit 1
    fi
    log_info "PM2 установлен"
  fi

  # Создание структуры папок
  log_info "Создание структуры папок..."
  mkdir -p logs backups data

  # Создание бэкапа перед первым запуском
  log_info "Создание начального бэкапа..."
  node -e "require('./scripts/deploy-utils').createBackup()"

  # Запуск бота
  log_info "Запуск бота через PM2..."
  pm2 start ecosystem.config.js --env production

  if [ $? -ne 0 ]; then
    log_error "Ошибка запуска PM2"
    exit 1
  fi

  # Настройка автозапуска
  log_info "Настройка автозапуска..."
  pm2 startup
  if [ $? -eq 0 ]; then
    pm2 save
    log_info "Автозапуск настроен"
  else
    log_warning "Не удалось настроить автозапуск (может потребоваться sudo)"
  fi

  # Проверка здоровья
  log_info "Проверка здоровья бота..."
  sleep 3

  node -e "
  const utils = require('./scripts/deploy-utils');
  utils.checkBotHealth().then(health => {
    if (health.healthy) {
      console.log('✅ Бот запущен и здоров');
      console.log('💾 Память:', Math.round(health.memory / 1024 / 1024) + 'MB');
      console.log('⏱️ Uptime:', Math.round(health.uptime / 1000) + 's');
      utils.sendDeployNotification('Бот успешно запущен в production! 🚀');
    } else {
      console.log('❌ Проблемы с ботом:', health.error);
      process.exit(1);
    }
  });
  "

  if [ $? -ne 0 ]; then
    log_error "Бот не прошел проверку здоровья"
    exit 1
  fi

  log_info "Настройка завершена!"
  echo ""
  echo "📋 Команды для управления:"
  echo "   pm2 status              - Статус процессов"
  echo "   pm2 logs supplement-bot - Просмотр логов"
  echo "   pm2 monit               - Мониторинг в реальном времени"
  echo "   npm run deploy          - Обновление и деплой"
  echo ""
  echo "🔧 Утилиты:"
  echo "   npm run health-check    - Проверка здоровья"
  echo "   npm run backup          - Создание бэкапа"
  echo "   npm run logs            - Просмотр логов"
}

# Обработка ошибок
set -e
trap 'log_error "Скрипт завершился с ошибкой на строке $LINENO"; exit 1' ERR

# Запуск основной функции
main "$@"
