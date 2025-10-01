const recommendationRules = {
  // БАЗОВЫЕ ДЛЯ ВСЕХ
  base: {
    condition: () => true,
    supplements: [
      {
        name: 'Омега-3 (EPA/DHA)',
        dosage: '1000-2000 мг',
        time: 'с едой',
        reason: 'Фундамент здоровья! Снижает воспаление, поддерживает мозг и сердце.',
        benefits: ['Здоровье мозга', 'Снижение воспаления', 'Поддержка сердца']
      },
      {
        name: 'Витамин D3 + K2',
        dosage: '2000-5000 МЕ D3 + 100 мкг K2',
        time: 'утром с жирной пищей',
        reason: 'Солнечный витамин! Критически важен для иммунитета и настроения.',
        benefits: ['Сильный иммунитет', 'Хорошее настроение', 'Здоровые кости']
      }
    ]
  },

  // 🧠 ПАМЯТЬ И КОНЦЕНТРАЦИЯ
  memory: {
    condition: (answers) => answers.memory_concentration &&
      ['Заметил ухудшение', 'Частые проблемы', 'Серьезные нарушения'].some(opt =>
        answers.memory_concentration.includes(opt)),
    supplements: [
      {
        name: 'L-тирозин',
        dosage: '500 мг',
        time: 'утром натощак',
        reason: 'Предшественник дофамина - нейромедиатора мотивации и фокуса.',
        benefits: ['Улучшение концентрации', 'Повышение мотивации']
      },
      {
        name: 'Фосфатидилсерин',
        dosage: '100-300 мг',
        time: 'утром',
        reason: 'Улучшает коммуникацию между нейронами, поддерживает когнитивные функции.',
        benefits: ['Память', 'Обучение', 'Стрессоустойчивость']
      }
    ]
  },

  // 🦵 СУСТАВЫ
  joints: {
    condition: (answers) => answers.joint_health &&
      ['Хруст и легкая боль', 'Регулярные боли', 'Хронические проблемы'].some(opt =>
        answers.joint_health.includes(opt)),
    supplements: [
      {
        name: 'Глюкозамин + Хондроитин',
        dosage: '1500 мг + 1200 мг',
        time: 'с едой',
        reason: 'Строительные блоки для хрящевой ткани, поддерживают здоровье суставов.',
        benefits: ['Подвижность суставов', 'Снижение дискомфорта', 'Защита хряща']
      },
      {
        name: 'Куркумин (с пиперином)',
        dosage: '500-1000 мг',
        time: 'с едой',
        reason: 'Мощный противовоспалительный эффект для облегчения суставных болей.',
        benefits: ['Снижение воспаления', 'Облегчение боли', 'Антиоксидантная защита']
      }
    ]
  },

  // 🍽️ ПИЩЕВАРЕНИЕ
  digestion: {
    condition: (answers) => answers.digestion &&
      ['Вздутие после еды', 'Периодические запоры', 'Частая изжога', 'Хронические проблемы'].some(opt =>
        answers.digestion.includes(opt)),
    supplements: [
      {
        name: 'Пробиотики',
        dosage: '10-50 млрд КОЕ',
        time: 'утром натощак',
        reason: 'Восстанавливают микрофлору кишечника, улучшают пищеварение и иммунитет.',
        benefits: ['Баланс микрофлоры', 'Улучшение пищеварения', 'Поддержка иммунитета']
      },
      {
        name: 'Пищеварительные ферменты',
        dosage: '1-2 капсулы с едой',
        time: 'основные приемы пищи',
        reason: 'Помогают расщеплять пищу, уменьшают вздутие и тяжесть после еды.',
        benefits: ['Легкость после еды', 'Усвоение питательных веществ', 'Снижение вздутия']
      }
    ]
  },

  // ⚡ ЭНЕРГИЯ (обновленная логика)
  energy: {
    condition: (answers) => answers.energy_level &&
      ['Скачет в течение дня', 'Постоянно низкий', 'Сильная усталость с утра'].some(opt =>
        answers.energy_level.includes(opt)),
    supplements: [
      {
        name: 'Коэнзим Q10',
        dosage: '100-200 мг',
        time: 'утром с едой',
        reason: 'Клеточный "энергетик", особенно важен после 30 лет.',
        benefits: ['Повышение энергии', 'Защита сердца', 'Антиоксидантная защита']
      },
      {
        name: 'Витамины группы B',
        dosage: 'B-комплекс',
        time: 'утром',
        reason: 'Критически важны для производства энергии на клеточном уровне.',
        benefits: ['Энергия', 'Работа нервной системы', 'Метаболизм']
      }
    ]
  },

  // 😵‍💫 СТРЕСС (обновленная логика)
  stress: {
    condition: (answers) => answers.stress_level &&
      ['Регулярный умеренный стресс', 'Постоянный высокий стресс', 'Хронический стресс'].some(opt =>
        answers.stress_level.includes(opt)),
    supplements: [
      {
        name: 'Магний (глицинат/малат)',
        dosage: '300-400 мг',
        time: 'вечером',
        reason: 'Минерал релаксации, расходуется при стрессе.',
        benefits: ['Глубокий сон', 'Снижение тревожности', 'Расслабление мышц']
      },
      {
        name: 'Ашваганда',
        dosage: '500-600 мг',
        time: 'утром/вечером',
        reason: 'Адаптоген, помогает организму справляться со стрессом.',
        benefits: ['Снижение cortisol', 'Улучшение сна', 'Повышение устойчивости']
      }
    ]
  }
};

// ОБНОВЛЕННАЯ ФУНКЦИЯ ГЕНЕРАЦИИ РЕКОМЕНДАЦИЙ
function generateRecommendations(answers) {
  const allRecommendations = [];
  const seenSupplements = new Set();

  // Сначала БАЗОВЫЕ
  if (recommendationRules.base.condition(answers)) {
    recommendationRules.base.supplements.forEach(supplement => {
      if (!seenSupplements.has(supplement.name)) {
        allRecommendations.push(supplement);
        seenSupplements.add(supplement.name);
      }
    });
  }

  // Затем СПЕЦИФИЧЕСКИЕ по всем правилам
  for (const [ruleName, rule] of Object.entries(recommendationRules)) {
    if (ruleName !== 'base' && rule.condition(answers)) {
      for (const supplement of rule.supplements) {
        if (!seenSupplements.has(supplement.name)) {
          allRecommendations.push(supplement);
          seenSupplements.add(supplement.name);
        }
      }
    }
  }

  // Лимит для удобства + приоритизация
  return allRecommendations
    .sort((a, b) => b.priority - (a.priority || 0))
    .slice(0, 6);
}

function formatRecommendations(recommendations) {
  if (recommendations.length === 0) {
    return `🎉 *Ваш образ жизни близок к идеалу!*

Но даже самым здоровым людям мы рекомендуем базовую поддержку:
• Омега-3 для мозга и противовоспаления
• Витамин D3 для иммунитета в нашем климате

Эти добавки - страховка для вашего здоровья! 💪`;
  }

  let message = `🌟 *ВАШ ПЕРСОНАЛЬНЫЙ ПЛАН ОЗДОРОВЛЕНИЯ* 🌟\n\n`;

  message += `*На основе ваших ответов мы подобрали оптимальную программу,* которая поможет:\n`;

  // Динамическое описание benefits
  const allBenefits = [...new Set(recommendations.flatMap(s => s.benefits || []))];
  if (allBenefits.length > 0) {
    message += `✅ ${allBenefits.slice(0, 3).join('\n✅ ')}\n\n`;
  }

  message += `---\n📋 *ВАШИ ДОБАВКИ ДЛЯ МАКСИМАЛЬНОГО РЕЗУЛЬТАТА:*\n\n`;

  recommendations.forEach((supp, index) => {
    message += `**${index + 1}. ${supp.name}**\n`;
    message += `   💊 *Дозировка:* ${supp.dosage}\n`;
    message += `   ⏰ *Время приема:* ${supp.time}\n`;
    message += `   💫 *Почему это важно:* ${supp.reason}\n`;

    if (supp.benefits) {
      message += `   ✅ *Конкретные benefits:* ${supp.benefits.join(', ')}\n`;
    }

    if (supp.important) {
      message += `   💡 *Ключевой совет:* ${supp.important}\n`;
    }

    if (supp.combo) {
      message += `   🔄 *Отлично сочетается:* ${supp.combo}\n`;
    }

    message += `\n`;
  });

  message += `---\n🎯 *КАК ДОБИТЬСЯ МАКСИМАЛЬНОГО ЭФФЕКТА:*\n\n`;

  // Советы по комбинациям
  const hasMagnesium = recommendations.some(s => s.name.includes('Магний'));
  const hasVitaminD = recommendations.some(s => s.name.includes('Витамин D'));

  if (hasMagnesium && hasVitaminD) {
    message += `💡 *Комбо-совет:* Принимайте Магний и Витамин D вместе - они усиливают действие друг друга!\n\n`;
  }

  message += `📅 *Регулярность важнее дозировки!* Старайтесь принимать добавки ежедневно.\n\n`;
  message += `📝 *Ведите дневник самочувствия* - отмечайте изменения каждую неделю.\n\n`;
  message += `🔄 *Через 30 дней* пройдите опрос заново для корректировки плана.\n\n`;

  message += `⚠️ *Важно:* Перед началом приема проконсультируйтесь с врачом, особенно если у вас есть хронические заболевания.`;

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
