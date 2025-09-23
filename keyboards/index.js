function getMainMenuKeyboard(isPremium = false) {
  const freeUserButtons = [
    ['📋 Пройти опрос', '💊 Мои рекомендации'],
    ['👤 Мой профиль', '💎 Апгрейд до Premium'],
    ['ℹ️ Помощь']
  ];

  const premiumUserButtons = [
    ['📋 Новый опрос', '💊 Мои рекомендации'],
    ['⏰ Мои напоминания', '📊 Статистика'],
    ['👤 Мой профиль', 'ℹ️ Помощь']
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

function getSurveyKeyboard(question, progress) {
  if (!question.options) return null;

  const keyboard = question.options.map((option, index) => [
    {
      text: `${index + 1}. ${option}`,
      callback_data: `q${question.index}a${index}`
    }
  ]);

  // Добавляем кнопку отмены
  keyboard.push([{ text: '❌ Отменить опрос', callback_data: 'cancel_survey' }]);

  return {
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
}

function getReminderActionsKeyboard(reminderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Принял', callback_data: `intake_taken_${reminderId}` },
          { text: '⏰ Через 10 мин', callback_data: `intake_later_${reminderId}` }
        ],
        [
          { text: '❌ Пропустить', callback_data: `intake_skipped_${reminderId}` },
          { text: '⚙️ Настройки', callback_data: `reminder_settings_${reminderId}` }
        ]
      ]
    }
  };
}

function getQuestionKeyboard(question) {
  if (!question.options) return null;

  const keyboard = question.options.map((option, index) => [
    {
      text: option,
      callback_data: `q${question.index}a${index}`
    }
  ]);

  return { reply_markup: { inline_keyboard: keyboard } };
}

// Добавляем отсутствующую функцию
function getReminderSettingsKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['⏰ Утреннее время', '🌅 Дневное время'],
        ['🌙 Вечернее время', '🔔 Вкл/Выкл уведомления'],
        ['🏠 Главное меню']
      ],
      resize_keyboard: true
    }
  };
}

function getIntakeHistoryKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📊 За 7 дней', callback_data: 'history_7' },
          { text: '📈 За 30 дней', callback_data: 'history_30' }
        ],
        [
          { text: '🏠 Главное меню', callback_data: 'main_menu' }
        ]
      ]
    }
  };
}

module.exports = {
  getMainMenuKeyboard,
  getQuestionKeyboard,
  getReminderSettingsKeyboard, // Добавляем в экспорт
  getIntakeHistoryKeyboard
};
