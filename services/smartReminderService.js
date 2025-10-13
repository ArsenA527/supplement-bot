class SmartReminderService {
  static INTERVALS = {
    morning: 30,    // 30 минут между утренними напоминаниями
    afternoon: 45,  // 45 минут между дневными
    evening: 30     // 30 минут между вечерними
  };

  // Умное распределение напоминаний
  async distributeRemindersSmartly(chatId, supplements, baseTime, period) {
    const interval = SmartReminderService.INTERVALS[period];
    const existingReminders = await this.getUserReminders(chatId);

    const periodSupplements = this.filterSupplementsForPeriod(supplements, period);

    const sortedSupplements = this.sortByOptimalTime(periodSupplements, period);

    const distributed = [];
    let currentTime = this.timeToMinutes(baseTime);

    for (const supplement of sortedSupplements) {
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

    while (this.hasTimeConflict(candidateTime, existingReminders)) {
      candidateTime += interval;

      if (candidateTime > baseTime + 180) {
        candidateTime = baseTime;
        break;
      }
    }

    return candidateTime;
  }

  hasTimeConflict(time, existingReminders) {
    return existingReminders.some(reminder => {
      const reminderTime = this.timeToMinutes(reminder.time);
      return Math.abs(reminderTime - time) < 15;
    });
  }

  // Умные интервалы based на типе добавок
  getSmartInterval(supplement1, supplement2) {
    const incompatiblePairs = [
      ['кальций', 'железо'],
      ['тирозин', 'мелатонин'],
      ['витамин с', 'медь']
    ];

    // Проверяем на конфликтующие пары
    const hasConflict = incompatiblePairs.some(pair =>
      (supplement1.name.toLowerCase().includes(pair[0]) &&
      supplement2.name.toLowerCase().includes(pair[1])) ||
      (supplement1.name.toLowerCase().includes(pair[1]) &&
      supplement2.name.toLowerCase().includes(pair[0]))
    );

    return hasConflict ? 60 : 30;
  }

  // Автоматическое создание умного расписания
  async createSmartSchedule(chatId, supplements) {
    const settings = await settingsService.getUserSettings(chatId);
    const smartSchedule = [];

    // Распределяем по периодам
    const periods = ['morning', 'afternoon', 'evening'];

    for (const period of periods) {
      const baseTime = settings[`${period}_time`];
      const periodSupplements = this.filterSupplementsForPeriod(supplements, period);

      if (periodSupplements.length > 0) {
        const distributed = await this.distributeRemindersSmartly(
          chatId, periodSupplements, baseTime, period
        );
        smartSchedule.push(...distributed);
      }
    }

    return smartSchedule;
  }
  }

module.exports = new SmartReminderService();
