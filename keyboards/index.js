function getMainMenuKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['📋 Пройти опрос', '💊 Мои рекомендации'],
        ['👤 Мой профиль', '⚙️ Настройки'],
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

module.exports = {
  getMainMenuKeyboard,
  getQuestionKeyboard
};
