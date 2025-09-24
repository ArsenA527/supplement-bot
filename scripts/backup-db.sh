#!/bin/bash
echo "💾 Создание бэкапа базы данных..."

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.db"

mkdir -p $BACKUP_DIR

if [ -f "./data/bot.db" ]; then
    cp "./data/bot.db" "$BACKUP_FILE"
    echo "✅ Бэкап создан: $BACKUP_FILE"

    # Удаляем старые бэкапы (оставляем последние 10)
    ls -t $BACKUP_DIR/backup_*.db | tail -n +11 | xargs rm -f
else
    echo "❌ Файл базы данных не найден"
fi
