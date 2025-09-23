# supplement-bot


*Тестовые команды (для разработки):*
# Очистить все данные и начать заново
/clearmydata

# Активировать Premium для тестирования
/activatepremium

# Принудительно отправить напоминание
/testremindernow

# Проверить статистику
/mystats

# Проверить историю
/myhistory

# Отладка подписки
/debugsub

# Тест кнопок
/testbuttons


# Запуск
pm2 start ecosystem.config.js --env production

# Проверка статуса
pm2 list

# Остановка
pm2 stop supplement-bot  # или то имя, которое указано в конфиге

# Или альтернативно - остановка по ID
pm2 stop 0  # где 0 - ID из pm2 list
