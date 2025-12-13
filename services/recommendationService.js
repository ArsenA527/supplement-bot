const recommendationRules = {
  // БАЗА - ФУНДАМЕНТАЛЬНЫЕ ДЕФИЦИТЫ (на основе эпидемиологии и биохимии)
  base: {
    condition: () => true,
    supplements: [
      {
        name: 'Магний (глицинат/малат)',
        dosage: '300-400 мг элементарного магния',
        time: 'вечером',
        reason: 'Участвует в 600+ ферментативных реакциях. Критически важен для работы нервной системы, синтеза АТФ и детоксикации. 80% населения в дефиците.',
        benefits: ['Качество сна', 'Снижение тревожности', 'Энергия', 'Расслабление мышц'],
        with_food: 'На пустой желудок за 1-2 часа до сна',
        important: 'Глицинат - для сна и нервов, Малат - для энергии и мышц',
        priority: 10,
        period: 'evening'
      },
      {
        name: 'Омега-3 (EPA/DHA)',
        dosage: '1000-2000 мг (не менее 500 мг EPA)',
        time: 'с едой',
        reason: 'Структурный компонент мембран нейронов. Снижает системное воспаление, улучшает текучесть мембран и нейротрансмиссию.',
        benefits: ['Когнитивные функции', 'Противовоспалительный эффект', 'Здоровье сердечно-сосудистой системы'],
        with_food: 'Обязательно с жирной пищей для усвоения',
        important: 'Соотношение EPA/DHA не менее 1:1',
        priority: 9,
        period: 'lunch'
      }
    ]
  },

  // ВИТАМИН D - ОСОБЫЙ СЛУЧАЙ (условно-базовый)
  vitamin_d: {
    condition: (answers) => {
      const hasCondition = answers.chronic_conditions &&
        !answers.chronic_conditions.includes('Нет хронических заболеваний');
      return !hasCondition;
    },
    supplements: [
      {
        name: 'Витамин D3 + K2 (МК-7)',
        dosage: '2000-4000 МЕ D3 + 100-200 мкг K2',
        time: 'утром с завтраком',
        reason: 'Гормоноподобный витамин. Регулирует 2000+ генов. При дефиците нарушается работа иммунной, эндокринной и нервной систем.',
        benefits: ['Иммуномодуляция', 'Кальциевый обмен', 'Настроение', 'Гормональный баланс'],
        with_food: 'С жирной пищей для усвоения',
        important: 'K2 направляет кальций в кости, а не в сосуды',
        priority: 8,
        period: 'morning'
      }
    ]
  },

  // АНТИСТРЕСС И НЕРВНАЯ СИСТЕМА
  stress_support: {
    condition: (answers) => answers.stress_symptoms &&
      ['Регулярный умеренный стресс', 'Постоянный высокий стресс', 'Хронический стресс, выгорание'].includes(answers.stress_symptoms),
    supplements: [
      {
        name: 'Ашваганда (KSM-66)',
        dosage: '600 мг',
        time: 'утром и/или вечером',
        reason: 'Адаптоген, нормализующий ось HPA (гипоталамус-гипофиз-надпочечники). Снижает кортизол, улучшает резистентность к стрессу.',
        benefits: ['Снижение кортизола', 'Улучшение сна', 'Повышение стрессоустойчивости'],
        with_food: 'С едой',
        important: 'Курс 2-3 месяца, затем перерыв 1 месяц',
        combo: 'Синергия с магнием для глубокого восстановления',
        priority: 7,
        period: 'morning'
      },
      {
        name: 'L-Теанин',
        dosage: '200-400 мг',
        time: 'по необходимости при стрессе',
        reason: 'Аминокислота, повышающая альфа-ритмы мозга. Дает состояние спокойной сосредоточенности без сонливости.',
        benefits: ['Фокус без тревоги', 'Расслабление', 'Когнитивная функция'],
        with_food: 'Натощак или с едой',
        important: 'Можно комбинировать с кофеином для чистого фокуса',
        priority: 6,
        period: 'morning'
      }
    ]
  },

  // КОГНИТИВНЫЕ ФУНКЦИИ И ЭНЕРГИЯ
  cognitive_support: {
    condition: (answers) => {
      const mentalLoad = answers.workload_type &&
        ['В основном умственная', 'Умственная + стресс', 'Смешанная 50/50'].includes(answers.workload_type);
      const focusIssues = answers.memory_concentration &&
        ['Заметил(а) ухудшение за последний год', 'Частые проблемы с фокусом и вниманием'].includes(answers.memory_concentration);
      return mentalLoad || focusIssues;
    },
    supplements: [
      {
        name: 'L-Тирозин',
        dosage: '500-1000 мг',
        time: 'утром натощак',
        reason: 'Предшественник катехоламинов (дофамин, норадреналин). Восстанавливает нейромедиаторы при умственном переутомлении.',
        benefits: ['Умственная энергия', 'Фокус и концентрация', 'Мотивация'],
        with_food: 'Натощак за 30 мин до еды',
        important: 'Только при необходимости, циклически',
        combo: 'С витаминами B6 и C для синтеза нейромедиаторов',
        priority: 7,
        period: 'morning'
      },
    ]
  },

  // ИММУННАЯ СИСТЕМА
  immune_support: {
    condition: (answers) => answers.immune_health &&
      ['3-4 раза в год', 'Частые и продолжительные болезни', 'Постоянно что-то беспокоит (ослабленный иммунитет)'].includes(answers.immune_health),
    supplements: [
      {
        name: 'Цинк (пиколинат)',
        dosage: '15-25 мг',
        time: 'вечером',
        reason: 'Кофактор тимулина, критичен для функции T-лимфоцитов. Антиоксидант и противовирусный агент.',
        benefits: ['Иммунная функция', 'Антиоксидантная защита', 'Синтез тестостерона'],
        with_food: 'С едой чтобы избетить тошноту',
        important: 'Курс 1-2 месяца, не превышать 40 мг/сутки',
        priority: 7,
        period: 'evening'
      },
      {
        name: 'Витамин C (липосомальный)',
        dosage: '500-1000 мг',
        time: 'утром и днем',
        reason: 'Мощный антиоксидант, поддерживает функцию нейтрофилов и продукцию интерферона. Снижает продолжительность заболеваний.',
        benefits: ['Антиоксидантная защита', 'Поддержка иммунитета', 'Синтез коллагена'],
        with_food: 'С едой',
        important: 'Липосомальная форма лучше усваивается и не раздражает ЖКТ',
        priority: 6,
        period: 'morning'
      }
    ]
  },

  // ВОСПАЛЕНИЕ И СУСТАВЫ
  inflammation_support: {
    condition: (answers) => answers.inflammation_pain &&
      ['Периодические боли в суставах или спине при нагрузке', 'Регулярные боли, скованность в суставах/спине'].includes(answers.inflammation_pain),
    supplements: [
      {
        name: 'Куркумин (с пиперином)',
        dosage: '500-1000 мг куркуминоидов',
        time: 'с едой',
        reason: 'Подавляет NF-kB - главный путь активации воспалительных цитокинов. По эффективности сравним с некоторыми НПВП.',
        benefits: ['Противовоспалительное действие', 'Поддержка суставов', 'Антиоксидантная защита'],
        with_food: 'С жирной пищей и черным перцем (пиперин)',
        important: 'Биодоступность критически зависит от формы',
        priority: 6,
        period: 'lunch'
      }
    ]
  },

  // ПИЩЕВАРИТЕЛЬНАЯ СИСТЕМА
  digestive_support: {
    condition: (answers) => answers.digestion &&
      ['Вздутие/газы после еды', 'Периодические запоры или диарея', 'Частая изжога, тяжесть, несварение'].includes(answers.digestion),
    supplements: [
      {
        name: 'Пробиотики (Lactobacillus + Bifidobacterium)',
        dosage: '10-50 млрд КОЕ',
        time: 'утром натощак',
        reason: 'Восстанавливают микробиом, улучшают целостность кишечного барьера, синтезируют витамины группы B.',
        benefits: ['Здоровье микробиома', 'Иммунная функция', 'Синтез витаминов'],
        with_food: 'За 30 минут до еды',
        important: 'Курс 1-2 месяца, менять штаммы',
        priority: 7,
        period: 'morning'
      },
      {
        name: 'L-Глутамин',
        dosage: '5-10 г',
        time: 'утром натощак и перед сном',
        reason: 'Основной источник энергии для энтероцитов. Восстанавливает целостность кишечного барьера при "дырявом кишечнике".',
        benefits: ['Восстановление слизистой ЖКТ', 'Иммунная функция', 'Детоксикация'],
        with_food: 'Натощак в порошке с водой',
        important: 'Особенно важен при стрессовых нагрузках',
        priority: 6,
        period: 'morning'
      }
    ]
  }
};

// УЛУЧШЕННАЯ ФУНКЦИЯ ГЕНЕРАЦИИ РЕКОМЕНДАЦИЙ
function generateRecommendations(answers) {
  const allRecommendations = [];
  const seenSupplements = new Set();

  // Проходим по всем правилам в порядке приоритета
  const ruleOrder = ['base', 'vitamin_d', 'stress_support', 'cognitive_support', 'immune_support', 'inflammation_support', 'digestive_support'];

  for (const ruleName of ruleOrder) {
    const rule = recommendationRules[ruleName];
    if (rule && rule.condition(answers)) {
      for (const supplement of rule.supplements) {
        if (!seenSupplements.has(supplement.name)) {
          allRecommendations.push(supplement);
          seenSupplements.add(supplement.name);
        }
      }
    }
  }

  // Сортируем по приоритету и ограничиваем количество
  return allRecommendations
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6); // Максимум 6 добавок чтобы не перегружать
}

// ФОРМАТИРОВАНИЕ РЕКОМЕНДАЦИЙ С БИОХИМИЧЕСКИМ ОБОСНОВАНИЕМ
function formatRecommendations(recommendations, answers) {
  if (recommendations.length === 0) {
    return `🎉 *Ваш образ жизни близок к идеалу!*\n\nДля поддержания здоровья рекомендуем базовые нутриенты:\n• Магний - для нервной системы\n• Омега-3 - для мозга и противовоспаления\n\nЭти добавки - страховка от дефицитов! 💪`;
  }

  let message = `🔬 *ПЕРСОНАЛЬНЫЙ ПЛАН НУТРИЦИОЛОГИЧЕСКОЙ КОРРЕКЦИИ*\n*по методике профессора Дадали*\n\n`;

  // Группируем по времени приема для удобства
  const byPeriod = {
    morning: [],
    lunch: [],
    afternoon: [],
    evening: []
  };

  recommendations.forEach(supp => {
    if (byPeriod[supp.period]) {
      byPeriod[supp.period].push(supp);
    }
  });

  // Утренние добавки
  if (byPeriod.morning.length > 0) {
    message += `🌅 *УТРЕННИЙ КОМПЛЕКС (с завтраком):*\n`;
    byPeriod.morning.forEach(supp => {
      message += `• **${supp.name}** - ${supp.dosage}\n`;
      if (supp.with_food) message += `  🍽️ ${supp.with_food}\n`;
      message += `  💫 ${supp.reason}\n\n`;
    });
  }

  // Дневные добавки
  if (byPeriod.lunch.length > 0) {
    message += `🍽️ *ОБЕДЕННЫЙ КОМПЛЕКС (с едой):*\n`;
    byPeriod.lunch.forEach(supp => {
      message += `• **${supp.name}** - ${supp.dosage}\n`;
      message += `  💫 ${supp.reason}\n\n`;
    });
  }

  // Вечерние добавки
  if (byPeriod.evening.length > 0) {
    message += `🌙 *ВЕЧЕРНИЙ КОМПЛЕКС (перед сном):*\n`;
    byPeriod.evening.forEach(supp => {
      message += `• **${supp.name}** - ${supp.dosage}\n`;
      if (supp.with_food) message += `  🍽️ ${supp.with_food}\n`;
      message += `  💫 ${supp.reason}\n\n`;
    });
  }

  // Ключевые синергии
  message += `---\n⚗️ *КЛЮЧЕВЫЕ БИОХИМИЧЕСКИЕ СИНЕРГИИ:*\n\n`;

  const hasMagnesium = recommendations.some(s => s.name.includes('Магний'));
  const hasVitaminD = recommendations.some(s => s.name.includes('Витамин D'));
  const hasZinc = recommendations.some(s => s.name.includes('Цинк'));

  if (hasMagnesium && hasVitaminD) {
    message += `• **Магний + Витамин D** - магний необходим для активации витамина D\n`;
  }

  if (hasZinc && hasVitaminD) {
    message += `• **Цинк + Витамин D** - синергия в иммунной функции\n`;
  }

  // Важные предупреждения
  message += `\n---\n⚠️ *ВНИМАНИЕ: БЕЗОПАСНОСТЬ ПРЕВЫШЕ ВСЕГО*\n\n`;
  message += `• Перед началом приема проконсультируйтесь с врачом\n`;
  message += `• Учтите ваши хронические заболевания и принимаемые лекарства\n`;
  message += `• Начинайте с минимальных доз для оценки переносимости\n`;
  message += `• Идеальный подход - сдать анализы на дефициты перед началом\n\n`;

  message += `🔄 *Через 4-6 недель* рекомендую повторную консультацию для коррекции плана.`;

  return message;
}

module.exports = { generateRecommendations, formatRecommendations, recommendationRules };
