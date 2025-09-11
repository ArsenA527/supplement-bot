function getMainMenuKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['📋 Пройти опрос', '💊 Мои рекомендации'],
        ['👤 Мой профиль', '💳 Подписка'], // Меняем "Настройки" на "Подписка"
        ['ℹ️ Помощь']
      ],
      resize_keyboard: true,
      one_time_keyboard: false
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
  getQuestionKeyboard
};
