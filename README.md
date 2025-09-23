# supplement-bot


*Тестовые команды (для разработки):*
/testremindernow - Тест напоминания (мгновенно)
/myreminders - Мои напоминания
/checkhistory - Проверить историю
/reminderstats - Статистика напоминаний
/debugsub - Отладка подписки
/activatepremium - Активировать premium
/clearmydata - Очистить мои данные
/testquestions - Тест вопросов


testremindernow
myreminders
checkhistory
reminderstats
debugsub
activatepremium
clearmydata
testquestions
testbuttons
testremindersnow
createremindersfromplan

# Запуск
pm2 start ecosystem.config.js --env production

# Проверка статуса
pm2 list

# Остановка
pm2 stop supplement-bot  # или то имя, которое указано в конфиге

# Или альтернативно - остановка по ID
pm2 stop 0  # где 0 - ID из pm2 list
