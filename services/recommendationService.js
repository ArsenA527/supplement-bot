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
    return '🎉 Отличные привычки! Рекомендуем базовый мультивитаминный комплекс.';
  }

  let message = '🌟 *ВАШИ РЕКОМЕНДАЦИИ:*\n\n';

  recommendations.forEach((supp, index) => {
    message += `${index + 1}. 💊 *${supp.name}*\n`;
    message += `   📏 ${supp.dosage} | ⏰ ${supp.time}\n`;
    message += `   📝 ${supp.reason}\n\n`;
  });

  message += '\n⚠️ *Консультация врача обязательна перед приемом!*';
  return message;
}

module.exports = { generateRecommendations, formatRecommendations };
