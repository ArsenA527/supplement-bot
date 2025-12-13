@echo off
echo 🚀 Запуск деплоя Supplement Bot в production...
echo.

set DEPLOY_START_TIME=%time%
echo ⏰ Начало деплоя: %DATE% %DEPLOY_START_TIME%
echo.

:: Проверка необходимых утилит
echo 📦 Проверка зависимостей...
git --version >nul 2>&1
if errorlevel  (
  echo ❌ Git не установлен или не найден
  exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
  echo ❌ Node.js не установлен или не найден
  exit /b 1
)

npm --version >nul 2>&1
if errorlevel 1 (
  echo ❌ npm не установлен или не найден
  exit /b 1
)

:: Создание бэкапа
echo 💾 Создание бэкапа базы данных...
node -e "require('./scripts/deploy-utils').createBackup().then(backup => { if (backup) console.log('Бэкап создан:', backup); })"
if errorlevel 1 (
  echo ⚠️ Не удалось создать бэкап, продолжаем...
)

:: Обновление кода
echo 📦 Обновление кода из Git...
git fetch origin
git status >nul 2>&1
if errorlevel 1 (
  echo ❌ Не Git репозиторий
  exit /b 1
)

git pull origin master
if errorlevel 1 (
  echo ❌ Ошибка при обновлении кода
  call :send_failure_notification "Ошибка Git pull"
  exit /b 1
)

:: Проверка изменений
git log -1 --oneline
echo.

:: Установка зависимостей
echo 📦 Установка зависимостей...
call npm install --production
if errorlevel 1 (
  echo ❌ Ошибка установки зависимостей
  call :send_failure_notification "Ошибка npm install"
  exit /b 1
)

:: Создание структуры папок
echo 🔧 Создание папок...
if not exist logs mkdir logs
if not exist backups mkdir backups
if not exist data mkdir data

:: Остановка и запуск бота
echo 🔄 Перезапуск бота...
pm2 stop %bot_name% >nul 2>&1
pm2 start ecosystem.config.js --env production
if errorlevel 1 (
  echo ❌ Ошибка запуска PM2
  call :send_failure_notification "Ошибка PM2"
  exit /b 1
)

:: Ожидание запуска
echo ⏳ Ожидание запуска бота...
timeout /t 5 /nobreak >nul

:: Проверка здоровья
echo 🏥 Проверка здоровья бота...
node -e "require('./scripts/deploy-utils').checkBotHealth().then(health => { if (!health.healthy) { console.log('❌ Бот не здоров:', health.error); process.exit(1); } else { console.log('✅ Бот здоров:', health.status); } })"
if errorlevel 1 (
  echo ❌ Бот не прошел проверку здоровья
  echo 🔄 Пытаемся откатиться...
  call :rollback_deploy
  exit /b 1
)

:: Финальные действия
echo 🧹 Очистка старых бэкапов...
node -e "require('./scripts/deploy-utils').cleanupOldBackups()"

set DEPLOY_END_TIME=%time%
echo ⏰ Конец деплоя: %DATE% %DEPLOY_END_TIME%

echo.
echo ✅ Деплой успешно завершен!
echo.

:: Отправка уведомления об успехе
node -e "require('./scripts/deploy-utils').sendDeployNotification('Деплой успешно завершен! Бот работает нормально.')"

echo 📋 Команды для управления:
echo    pm2 status              - Статус процессов
echo    pm2 logs %bot_name%     - Просмотр логов
echo    pm2 monit               - Мониторинг
echo    npm run deploy          - Повторный деплой
echo.

goto :eof

:rollback_deploy
echo 🔄 Запуск отката...
node -e "require('./scripts/deploy-utils').rollbackToPreviousVersion().then(success => { process.exit(success ? 0 : 1); })"
if errorlevel 1 (
  echo ❌ Откат не удался, требуется ручное вмешательство
  call :send_failure_notification "Критическая ошибка: откат не удался"
)
exit /b 1

:send_failure_notification
setlocal
set message=%~1
node -e "require('./scripts/deploy-utils').sendDeployNotification('Деплой провален: %message%', true)"
endlocal
goto :eof
