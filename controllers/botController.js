function handleStart(ctx) {
  ctx.reply('👋 Привет! Я помогу подобрать БАДы персонально.\nНажми /survey чтобы пройти опрос.');
}

function handleHelp(ctx) {
  ctx.reply(
    [
      'Доступные команды:',
      '/start — начать',
      '/survey — пройти опрос',
      '/plan — мои рекомендации',
      '/profile — мой профиль',
      '/edit — изменить данные',
      '/reminders — напоминания',
      '/subscribe — подписка',
      '/status — статус подписки',
      '/reset — сброс анкеты',
      '/feedback — обратная связь',
      '/privacy — политика и дисклеймер',
    ].join('\n')
  );
}

function handlePlan(ctx) {
  ctx.reply('📝 Рекомендации будут после прохождения опроса.');
}

// ... остальные обработчики команд ...

module.exports = {
  handleStart,
  handleHelp,
  handlePlan,
  // handleProfile,
  // handleEdit,
  // handleReminders,
  // handleSubscribe,
  // handleStatus,
  // handleReset,
  // handleFeedback,
  // handlePrivacy
};
