@echo off
echo 🚀 Запуск деплоя Supplement Bot в production...
echo.

echo 📦 Проверка Git...
git --version >nul 2>&1
if errorlevel 1 (
  echo ❌ Git не установлен или не найден
  exit /b 1
)

echo 📦 Обновление кода...
git pull origin master
if errorlevel 1 (
  echo ❌ Ошибка при обновлении кода
  exit /b 1
)

echo 📦 Установка зависимостей...
call npm install --production
if errorlevel 1 (
  echo ❌ Ошибка установки зависимостей
  exit /b 1
)

echo 🔧 Создание папок...
if not exist logs mkdir logs
if not exist backups mkdir backups
if not exist data mkdir data

echo 🔄 Перезапуск бота...
pm2 stop supplement-bot >nul 2>&1
pm2 start ecosystem.config.js --env production
if errorlevel 1 (
  echo ❌ Ошибка запуска PM2
  exit /b 1
)

echo ⏳ Ожидание запуска...
timeout /t 3 /nobreak >nul

echo 📊 Проверка статуса...
pm2 list | findstr supplement-bot
if errorlevel 1 (
  echo ❌ Бот не запущен
  exit /b 1
)

echo.
echo ✅ Деплой успешно завершен!
echo.
echo 📋 Команды для управления:
echo    pm2 status              - Статус процессов
echo    pm2 logs supplement-bot - Просмотр логов
echo    pm2 monit               - Мониторинг
echo.
