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

function getMainKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['📋 Пройти опрос', '💊 Мои рекомендации'],
        ['⚙️ Настройки', 'ℹ️ Помощь']
      ],
      resize_keyboard: true
    }
  };
}

module.exports = {
  getQuestionKeyboard,
  getMainKeyboard
};
