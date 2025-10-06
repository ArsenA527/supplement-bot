class SmartReminderService {
  // Оптимальные интервалы между напоминаниями (в минутах)
  static INTERVALS = {
    morning: 30,    // 30 минут между утренними напоминаниями
    afternoon: 45,  // 45 минут между дневными
    evening: 30     // 30 минут между вечерними
  };

  // Умное распределение напоминаний
  async distributeRemindersSmartly(chatId, supplements, baseTime, period) {
    const interval = SmartReminderService.INTERVALS[period];
    const existingReminders = await this.getUserReminders(chatId);

    // Фильтруем добавки для этого периода
    const periodSupplements = this.filterSupplementsForPeriod(supplements, period);

    // Сортируем по приоритету (витамины утром, минералы днем, релакс вечером)
    const sortedSupplements = this.sortByOptimalTime(periodSupplements, period);

    const distributed = [];
    let currentTime = this.timeToMinutes(baseTime);

    for (const supplement of sortedSupplements) {
      // Проверяем нет ли конфликта с существующими напоминаниями
      const optimalTime = this.findOptimalTime(currentTime, existingReminders, interval);

      distributed.push({
        ...supplement,
        optimizedTime: this.minutesToTime(optimalTime)
      });

      currentTime = optimalTime + interval;
    }

    return distributed;
  }

  // Определяем оптимальный период для каждой добавки
  filterSupplementsForPeriod(supplements, period) {
    const periodRules = {
      morning: ['витамин', 'коэнзим', 'энергия', 'тирозин', 'омега'],
      afternoon: ['минерал', 'железо', 'цинк', 'пробиотик', 'фермент'],
      evening: ['магний', 'мелатонин', 'глицин', 'ашваганда', 'релакс']
    };

    const keywords = periodRules[period] || [];

    return supplements.filter(supplement =>
      keywords.some(keyword =>
        supplement.name.toLowerCase().includes(keyword)
      )
    );
  }

  // Сортировка по оптимальному времени приема
  sortByOptimalTime(supplements, period) {
    const priorityRules = {
      morning: ['витамин d', 'тирозин', 'коэнзим', 'витамин b', 'омега'],
      afternoon: ['железо', 'цинк', 'пробиотик', 'фермент', 'минерал'],
      evening: ['магний', 'ашваганда', 'мелатонин', 'глицин']
    };

    const priorities = priorityRules[period] || [];

    return supplements.sort((a, b) => {
      const aPriority = priorities.findIndex(p => a.name.toLowerCase().includes(p));
      const bPriority = priorities.findIndex(p => b.name.toLowerCase().includes(p));

      return aPriority - bPriority;
    });
  }

  // Вспомогательные функции для работы со временем
  timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  minutesToTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  findOptimalTime(baseTime, existingReminders, interval) {
    let candidateTime = baseTime;

    // Ищем свободный слот
    while (this.hasTimeConflict(candidateTime, existingReminders)) {
      candidateTime += interval;

      // Если вышли за пределы периода, возвращаемся к базовому времени
      if (candidateTime > baseTime + 180) { // 3 часа максимум
        candidateTime = baseTime;
        break;
      }
    }

    return candidateTime;
  }

  hasTimeConflict(time, existingReminders) {
    return existingReminders.some(reminder => {
      const reminderTime = this.timeToMinutes(reminder.time);
      return Math.abs(reminderTime - time) < 15; // Конфликт если разница < 15 минут
    });
  }
}

module.exports = new SmartReminderService();
