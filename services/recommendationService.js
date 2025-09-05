const recommendationRules = {
  // Правила для стресса и энергии
  stress: {
    // изменить conditions
    condition: (answers) => answers.stress && answers.stress.includes('стресс'),
    supplements: [
      {
        name: 'Магний',
        dosage: '400 мг',
        time: 'вечером',
        reason: 'Снижает уровень кортизола, улучшает сон и расслабление'
      },
      {
        name: 'L-теанин',
        dosage: '200 мг',
        time: 'утром и днем',
        reason: 'Помогает снизить тревожность без седативного эффекта'
      }
    ]
  },

  // Правила для сна
  sleep: {
    // изменить conditions
    condition: (answers) => answers.sleep && !answers.sleep.includes('Хороший'),
    supplements: [
      {
        name: 'Мелатонин',
        dosage: '3 мг',
        time: 'за 30 минут до сна',
        reason: 'Регулирует циркадные ритмы, улучшает качество сна'
      },
      {
        name: 'Глицин',
        dosage: '1000 мг',
        time: 'перед сном',
        reason: 'Улучшает засыпание и качество сна'
      }
    ]
  },

  // Правила для энергии
  energy: {
    // изменить conditions
    condition: (answers) => answers.sleep && !answers.sleep.includes('усталость'),
    supplements: [
      {
        name: 'Коэнзим Q10',
        dosage: '200 мг',
        time: 'утром с едой',
        reason: 'Улучшает энергетический обмен на клеточном уровне'
      },
      {
        name: 'Витамин B комплекс',
        dosage: '1 капсула',
        time: 'утром',
        reason: 'Необходим для производства энергии'
      }
    ]
  },

  // Правила для иммунитета
  immunity: {
    // изменить conditions
    condition: (answers) => answers.sleep && !answers.sleep.includes('простуды'),
    supplements: [
      {
        name: 'Витамин D3',
        dosage: '2000-5000 МЕ',
        time: 'утром с едой',
        reason: 'Критически важен для работы иммунной системы'
      },
      {
        name: 'Цинк',
        dosage: '15-30 мг',
        time: 'днем',
        reason: 'Поддерживает иммунную функцию'
      }
    ]
  },

  // Правила для кожи, волос, ногтей
  beauty: {
    // изменить conditions
    condition: (answers) => answers.symptoms &&
      (answers.symptoms.includes('кожа') ||
        answers.symptoms.includes('волосы') ||
        answers.symptoms.includes('ногти')),

    supplements: [
      {
        name: 'Коллаген',
        dosage: '10 г',
        time: 'утром натощак',
        reason: 'Улучшает состояние кожи, волос и ногтей'
      },
      {
        name: 'Биотин',
        dosage: '5000 мкг',
        time: 'утром',
        reason: 'Укрепляет волосы и ногти'
      }
    ]
  },

  // Базовые рекомендации для всех
  base: {
    condition: () => true, // Всегда true
    supplements: [
      {
        name: 'Омега-3',
        dosage: '1000 мг',
        time: 'с едой',
        reason: 'Поддерживает здоровье мозга, сердца и противовоспалительный ответ'
      },
      {
        name: 'Витамин C',
        dosage: '500-1000 мг',
        time: 'утром',
        reason: 'Мощный антиоксидант, поддерживает иммунитет'
      }
    ]
  }
}

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


function formatRecommendation(recommendations) {
  if (recommendations.length === 0) {
    return '🎉 Отличные привычки! Рекомендуем базовый мультивитаминный комплекс для поддержки здоровья.';
  }

  let message = '🌟 Ваши персональные рекомендации:\n\n';

  recommendations.forEach((supp, index) => {
    message += `${index + 1}. 💊 ${supp.name}\n`;
    message += `   📏 Дозировка: ${supp.dosage}\n`;
    message += `   ⏰ Время приема: ${supp.time}\n`;
    message += `   📝 Обоснование: ${supp.reason}\n\n`;
  });

  message += '\n⚠️ Важно: перед приемом проконсультируйтесь с врачом.';
  return message;
}


module.exports = { generateRecommendations, formatRecommendation }
