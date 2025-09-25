const recommendationRules = {
  // 🎯 СУЩЕСТВУЮЩИЕ ПРАВИЛА (оставляем)
  stress: {
    condition: (answers) => answers.stress && ['Часто', 'Постоянно'].includes(answers.stress),
    supplements: [
      {
        name: 'Магний',
        dosage: '400 мг',
        time: 'вечером',
        reason: 'Снижает cortisol, улучшает сон и помогает справляться со стрессом. Ваш организм расходует магний при стрессе - пора восполнить запасы! 💆‍♂️',
        benefits: ['Глубокий сон', 'Снижение тревожности', 'Расслабление мышц'],
        important: '💡 Принимайте за 1-2 часа до сна для максимального эффекта'
      },
      {
        name: 'L-теанин',
        dosage: '200 мг',
        time: 'утром/днем',
        reason: 'Уникальная аминокислота из зеленого чая, которая снимает тревожность без сонливости. Идеально для рабочего дня! 🍵',
        benefits: ['Фокус без тревоги', 'Расслабление', 'Улучшение качества сна'],
        combo: 'Отлично сочетается с кофе для "спокойной энергии"'
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
        reason: 'Естественный гормон сна, который регулирует ваши циркадные ритмы. Поможет засыпать быстрее и просыпаться отдохнувшим! 😴',
        benefits: ['Быстрое засыпание', 'Глубокий сон', 'Легкое пробуждение'],
        important: '🔦 Принимайте в темноте - свет разрушает мелатонин'
      },
      {
        name: 'Магний + Глицин',
        dosage: '300 мг магния + 3 г глицина',
        time: 'за 30 мин до сна',
        reason: 'Комбинация для глубокого восстановительного сна. Магний расслабляет мышцы, глицин успокаивает нервную систему! 🌙',
        benefits: ['Качественный сон', 'Восстановление организма', 'Свежесть утром']
      }
    ]
  },

  energy: {
    condition: (answers) => answers.energy && answers.energy.includes('усталость'),
    supplements: [
      {
        name: 'Коэнзим Q10',
        dosage: '200 мг',
        time: 'утром с едой',
        reason: 'Ваш клеточный "энергетик". После 25 лет выработка снижается - пора поддержать энергообмен на уровне клеток! ⚡',
        benefits: ['Повышение энергии', 'Защита сердца', 'Антиоксидантная защита'],
        target: 'Особенно важен после 30 лет и при приеме статинов'
      },
      {
        name: 'Железо (если нужно)',
        dosage: '25 мг',
        time: 'утром натощак с витамином C',
        reason: 'Критически важно для переноса кислорода в крови. Дефицит железа - частая причина хронической усталости! 🔴',
        benefits: ['Борьба с анемией', 'Улучшение когнитивных функций', 'Повышение энергии'],
        important: '❗ Сначала сдайте анализ на ферритин!'
      }
    ]
  },

  immunity: {
    condition: (answers) => answers.goal === 'Иммунитет' || answers.symptoms?.includes('Частые простуды'),
    supplements: [
      {
        name: 'Витамин D3 + K2',
        dosage: '2000-5000 МЕ D3 + 100 мкг K2',
        time: 'утром с жирной пищей',
        reason: 'Главный иммуномодулятор! В России дефицит у 80% населения, особенно с октября по апрель. ☀️',
        benefits: ['Укрепление иммунитета', 'Защита от вирусов', 'Улучшение настроения'],
        important: '🔆 K2 направляет кальций в кости, а не в сосуды'
      },
      {
        name: 'Цинк',
        dosage: '15-30 мг',
        time: 'с едой',
        reason: 'Минерал-защитник! Укорачивает продолжительность простуд и снижает риск заражения. 🛡️',
        benefits: ['Поддержка иммунитета', 'Здоровье кожи', 'Гормональный баланс'],
        synergy: 'Принимайте с витамином C для усиления эффекта'
      }
    ]
  },

  brain: {
    condition: (answers) => answers.goal === 'Работа мозга и память',
    supplements: [
      {
        name: 'Омега-3 (EPA/DHA)',
        dosage: '1000-2000 мг',
        time: 'с едой',
        reason: 'Ваш мозг на 60% состоит из жиров! Омега-3 - строительный материал для нейронов и защиты от воспаления. 🧠',
        benefits: ['Улучшение памяти', 'Защита от возрастных изменений', 'Снижение воспаления'],
        important: '✅ Выбирайте с высоким содержанием EPA/DHA, а не общего рыбьего жира'
      },
      {
        name: 'L-тирозин',
        dosage: '500 мг',
        time: 'утром натощак',
        reason: 'Предшественник дофамина и норадреналина - нейромедиаторов мотивации и фокуса. 💡',
        benefits: ['Улучшение концентрации', 'Повышение мотивации', 'Снижение стресса'],
        combo: 'Отлично работает с L-теанином для "спокойного фокуса"'
      }
    ]
  },

  skin: {
    condition: (answers) => answers.goal === 'Кожа, волосы, ногти' || answers.symptoms?.includes('Проблемы с кожей'),
    supplements: [
      {
        name: 'Коллаген + Витамин C',
        dosage: '10 г коллагена + 500 мг витамина C',
        time: 'утром натощак',
        reason: 'Коллаген - белок молодости! После 25 лет выработка снижается на 1.5% в год. 💎',
        benefits: ['Улучшение кожи', 'Укрепление волос и ногтей', 'Здоровье суставов'],
        important: '🍋 Витамин C необходим для синтеза коллагена'
      },
      {
        name: 'Биотин',
        dosage: '5000-10000 мкг',
        time: 'с едой',
        reason: 'Витамин красоты! Укрепляет волосы, ногти и улучшает состояние кожи изнутри. ✨',
        benefits: ['Рост волос', 'Укрепление ногтей', 'Здоровая кожа']
      }
    ]
  },

  // 🔄 БАЗОВЫЕ ДЛЯ ВСЕХ
  base: {
    condition: () => true,
    supplements: [
      {
        name: 'Омега-3',
        dosage: '1000 мг',
        time: 'с едой',
        reason: 'Фундамент здоровья! Снижает воспаление, поддерживает мозг и сердце. Необходим практически каждому современному человеку. 🌊',
        benefits: ['Здоровье мозга', 'Снижение воспаления', 'Поддержка сердца'],
        important: '🐟 Если едите рыбу реже 2 раз в неделю - обязательно!'
      },
      {
        name: 'Витамин D3',
        dosage: '2000 МЕ',
        time: 'утром',
        reason: 'Солнечный витамин! В условиях российского климата дефицит есть у 80-90% населения. Критически важен для иммунитета и настроения. 🌞',
        benefits: ['Сильный иммунитет', 'Хорошее настроение', 'Здоровые кости'],
        important: '📅 Особенно важен с октября по апрель'
      }
    ]
  }
};

function generateRecommendations(answers) {
  const allRecommendations = [];
  const seenSupplements = new Set();

  // Сначала добавляем БАЗОВЫЕ (важные для всех)
  if (recommendationRules.base.condition(answers)) {
    recommendationRules.base.supplements.forEach(supplement => {
      if (!seenSupplements.has(supplement.name)) {
        allRecommendations.push(supplement);
        seenSupplements.add(supplement.name);
      }
    });
  }

  // Затем добавляем СПЕЦИФИЧЕСКИЕ по условиям
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

  // Лимитируем количество рекомендаций для удобства
  return allRecommendations.slice(0, 6);
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
