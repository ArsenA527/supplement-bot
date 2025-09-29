function getMainMenuKeyboard(isPremium = false) {
  const freeUserButtons = [
    ['📋 Пройти опрос', '💊 Мои рекомендации'],
    ['👤 Мой профиль', '💎 Апгрейд до Premium'],
    ['ℹ️ Помощь', '⚙️ Настройки']
  ];

  const premiumUserButtons = [
    ['📋 Новый опрос', '💊 Мои рекомендации'],
    ['⏰ Мои напоминания', '📊 Статистика'],
    ['👤 Мой профиль', '⚙️ Настройки'],
    ['ℹ️ Помощь', '💎 Premium статус']
  ];

  const buttons = isPremium ? premiumUserButtons : freeUserButtons;

  return {
    reply_markup: {
      keyboard: buttons,
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
}

// Клавиатура для опросов с прогрессом
function getQuestionKeyboard(question, progress = { current: 0, total: 0 }) {
  if (!question.options) return null;

  const keyboard = question.options.map((option, index) => [
    {
      text: `${index + 1}. ${option}`,
      callback_data: `q${question.index}a${index}`
    }
  ]);

  // Добавляем прогресс и кнопку отмены
  const progressText = `📊 ${progress.current}/${progress.total}`;
  keyboard.push([
    { text: '❌ Отменить опрос', callback_data: 'cancel_survey' },
    { text: progressText, callback_data: 'progress_info' }
  ]);

  return {
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
}

// Клавиатура действий для напоминаний
function getReminderActionsKeyboard(reminderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '✅ Принял',
            callback_data: `intake_taken_${reminderId}`,
            emoji: '✅'
          },
          {
            text: '⏰ Через 10 мин',
            callback_data: `intake_later_${reminderId}`,
            emoji: '⏰'
          }
        ],
        [
          {
            text: '❌ Пропустить',
            callback_data: `intake_skipped_${reminderId}`,
            emoji: '❌'
          },
          {
            text: '⚙️ Настройки',
            callback_data: `reminder_settings_${reminderId}`,
            emoji: '⚙️'
          }
        ]
      ]
    }
  };
}

// Клавиатура настроек напоминаний
function getReminderSettingsKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['⏰ Утреннее время', '🌅 Дневное время'],
        ['🌙 Вечернее время', '🔔 Вкл/Выкл уведомления'],
        ['📋 Мои напоминания', '🏠 Главное меню']
      ],
      resize_keyboard: true
    }
  };
}

// Клавиатура истории приема
function getIntakeHistoryKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '📊 За 7 дней',
            callback_data: 'history_7',
            emoji: '📊'
          },
          {
            text: '📈 За 30 дней',
            callback_data: 'history_30',
            emoji: '📈'
          }
        ],
        [
          {
            text: '🏠 Главное меню',
            callback_data: 'main_menu',
            emoji: '🏠'
          }
        ]
      ]
    }
  };
}

// Клавиатура настроек времени
function getTimeSettingsKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['🌅 Утреннее время', '☀️ Дневное время'],
        ['🌙 Вечернее время', '🔔 Уведомления'],
        ['🏠 Главное меню']
      ],
      resize_keyboard: true
    }
  };
}

// Клавиатура основных настроек
function getSettingsKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['⏰ Настроить напоминания', '🔔 Управление уведомлениями'],
        ['📊 Мои данные', '🗑️ Очистить историю'],
        ['🏠 Главное меню']
      ],
      resize_keyboard: true
    }
  };
}

// Клавиатура после завершения опроса
function getSurveyCompletionKeyboard(isPremium = false) {
  const buttons = [
    [{ text: '💊 Посмотреть рекомендации', callback_data: 'view_recommendations' }],
    [{ text: '🔄 Пройти заново', callback_data: 'restart_survey' }]
  ];

  if (!isPremium) {
    buttons.push([{ text: '💎 Получить Premium', callback_data: 'get_premium' }]);
  }

  buttons.push([{ text: '🏠 Главное меню', callback_data: 'main_menu' }]);

  return {
    reply_markup: {
      inline_keyboard: buttons
    }
  };
}

// Клавиатура подписки
function getSubscriptionKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '💳 Оформить Premium',
            callback_data: 'subscribe_premium',
            emoji: '💳'
          }
        ],
        [
          {
            text: '📋 Информация о подписках',
            callback_data: 'subscription_info',
            emoji: '📋'
          },
          {
            text: '🏠 Главное меню',
            callback_data: 'main_menu',
            emoji: '🏠'
          }
        ]
      ]
    }
  };
}

// Вспомогательная функция для прогресс-бара
function generateProgressBar(current, total) {
  if (total === 0) return '';

  const percentage = Math.round((current / total) * 100);
  const filled = '█'.repeat(Math.round(percentage / 10));
  const empty = '░'.repeat(10 - filled.length);
  return `[${filled}${empty}] ${percentage}%`;
}

module.exports = {
  getMainMenuKeyboard,
  getQuestionKeyboard,
  getReminderActionsKeyboard,
  getReminderSettingsKeyboard,
  getIntakeHistoryKeyboard,
  getSurveyCompletionKeyboard,
  getSubscriptionKeyboard,
  getTimeSettingsKeyboard,
  getSettingsKeyboard,
  generateProgressBar
};
