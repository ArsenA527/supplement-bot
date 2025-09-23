const recommendationRules = {
  stress: {
    condition: (answers) => answers.stress && ['Часто', 'Постоянно'].includes(answers.stress),
    supplements: [
      {
        name: 'Магний',
        dosage: '400 мг',
        time: 'вечером',
        reason: 'Снижает cortisol, улучшает сон'
      },
      {
        name: 'L-теанин',
        dosage: '200 мг',
        time: 'утром/днем',
        reason: 'Снижает тревожность без сонливости'
      }
    ]
  },
  sleep: {
    condition: (answers) => answers.sleep && !answers.sleep.includes('Хороший'),
    supplements: [
      {
        name: 'Мелатонин',
        dosage: '3 мг',
        time: 'перед сном',
        reason: 'Регулирует циркадные ритмы'
      }
    ]
  },
  energy: {
    condition: (answers) => answers.energy && answers.energy.includes('усталость'),
    supplements: [
      {
        name: 'Коэнзим Q10',
        dosage: '200 мг',
        time: 'утром',
        reason: 'Улучшает энергообмен в клетках'
      }
    ]
  },
  base: {
    condition: () => true,
    supplements: [
      {
        name: 'Омега-3',
        dosage: '1000 мг',
        time: 'с едой',
        reason: 'Поддержка сердца, мозга, противовоспалительный эффект'
      },
      {
        name: 'Витамин D3',
        dosage: '2000 МЕ',
        time: 'утром',
        reason: 'Критически важен для иммунитета и настроения'
      }
    ]
  }
};

function generateRecommendations(answers) {
  const allRecommendations = [];
  const seenSupplements = new Set();

  for (const [ruleName, rule] of Object.entries(recommendationRules)) {
    if (rule.condition(answers)) {
      for (const supplement of rule.supplements) {
        if (!seenSupplements.has(supplement.name)) {
          allRecommendations.push(supplement);
          seenSupplements.add(supplement.name);
        }
      }
    }
  }

  return allRecommendations;
}

function formatRecommendations(recommendations) {
  if (recommendations.length === 0) {
    return `🎉 *Отличные привычки!*\n\nВаш текущий образ жизни достаточно сбалансирован. Рекомендуем базовый мультивитаминный комплекс для поддержания здоровья.`;
  }

  let message = `🌟 *ПЕРСОНАЛЬНЫЕ РЕКОМЕНДАЦИИ*\n\n`;
  message += `На основе ваших ответов мы подобрали оптимальную программу:\n\n`;

  recommendations.forEach((supp, index) => {
    const timeEmoji = getTimeEmoji(supp.time);
    message += `**${index + 1}. ${supp.name}** ${timeEmoji}\n`;
    message += `   💊 *Дозировка:* ${supp.dosage}\n`;
    message += `   ⏰ *Время приема:* ${supp.time}\n`;
    message += `   📝 *Эффект:* ${supp.reason}\n\n`;
  });

  message += `---\n`;
  message += `💡 *Рекомендации по приему:*\n`;
  message += `• Принимайте добавки регулярно для лучшего эффекта\n`;
  message += `️• Запивайте достаточным количеством воды\n`;
  message += `• Соблюдайте рекомендованные дозировки\n\n`;
  message += `⚠️ *Консультация врача обязательна перед приемом!*`;

  return message;
}

function getTimeEmoji(time) {
  const emojis = {
    'утром': '🌅', 'утро': '🌅',
    'днем': '☀️', 'дневное': '☀️',
    'вечером': '🌙', 'вечер': '🌙',
    'перед сном': '😴', 'сон': '😴',
    'с едой': '🍽️', 'еда': '🍽️'
  };
  return emojis[time.toLowerCase()] || '⏰';
}

module.exports = { generateRecommendations, formatRecommendations };
