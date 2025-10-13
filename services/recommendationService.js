const recommendationRules = {
  // БАЗА - КРИТИЧЕСКИ ВАЖНЫЕ ДЛЯ ВСЕХ (по вашей экспертизе)
  base: {
    condition: () => true,
    supplements: [
      {
        name: 'Витамин D3 + K2',
        dosage: '2000-5000 МЕ D3 + 100 мкг K2',
        time: 'утром',
        reason: 'Фундамент! 80% мужчин в дефиците. Без D3 падает тестостерон, иммунитет, настроение.',
        benefits: ['Тестостерон', 'Иммунитет', 'Настроение'],
        with_food: 'С жирной пищей для усвоения',
        important: 'Сначала проверьте уровень 25(OH)D в крови!',
        priority: 10,
        period: 'morning'
      },
      {
        name: 'Магний (глицинат)',
        dosage: '300-400 мг',
        time: 'вечером',
        reason: 'Буфер между тобой и психушкой. Успокаивает нервную систему, улучшает сон.',
        benefits: ['Качество сна', 'Снижение тревожности', 'Расслабление мышц'],
        with_food: 'На пустой желудок перед сном',
        important: 'Глицинат - для сна и нервов, Цитрат - если есть проблемы с ЖКТ',
        priority: 9,
        period: 'evening'
      },
      {
        name: 'Омега-3 (EPA/DHA)',
        dosage: '1000-2000 мг',
        time: 'с едой',
        reason: 'Смазывает мозг, стабилизирует настроение, снижает воспаление.',
        benefits: ['Работа мозга', 'Стабильность настроения', 'Противовоспалительный эффект'],
        with_food: 'Обязательно с едой для усвоения',
        priority: 8,
        period: 'afternoon'
      }
    ]
  },

  // АНТИСТРЕСС (активируется при высоком стрессе)
  high_stress: {
    condition: (answers) => answers.stress_level &&
      ['Постоянный высокий стресс', 'Хронический стресс, выгорание'].includes(answers.stress_level),
    supplements: [
      {
        name: 'Ашваганда',
        dosage: '600 мг',
        time: 'утром и вечером',
        reason: 'Главный антистресс! Снижает кортизол, стабилизирует настроение, улучшает сон и либидо.',
        benefits: ['Снижение кортизола', 'Улучшение сна', 'Повышение либидо'],
        with_food: 'Можно с едой или без',
        important: 'Пить курсами по 2-3 месяца',
        combo: 'Отлично работает в паре с Магнием',
        priority: 7,
        period: 'morning'
      }
    ]
  },

  // ФОКУС И ЭНЕРГИЯ (при умственных нагрузках и тумане в голове)
  focus_energy: {
    condition: (answers) => {
      const highMentalLoad = answers.workload_type &&
        ['В основном умственная', 'Умственная + стресс'].includes(answers.workload_type);
      const lowEnergy = answers.energy_focus &&
        ['Скачет в течение дня', 'Постоянно низкий', 'Сильная усталость с утра'].includes(answers.energy_focus);
      return highMentalLoad || lowEnergy;
    },
    supplements: [
      {
        name: 'L-Тирозин',
        dosage: '500-1000 мг',
        time: 'утром',
        reason: 'Включает голову! Предшественник дофамина - дает фокус и собранность при умственных нагрузках.',
        benefits: ['Фокус и концентрация', 'Умственная энергия', 'Мотивация'],
        with_food: 'Натощак за 30 мин до еды',
        important: 'Только при необходимости, не каждый день!',
        combo: 'Идеально перед важными задачами или тренировкой',
        priority: 6,
        period: 'morning'
      },
      {
        name: 'Цинк (пиколинат)',
        dosage: '15-30 мг',
        time: 'вечером',
        reason: 'Критически важен для тестостерона и иммунитета. Быстро расходуется при стрессе.',
        benefits: ['Поддержка тестостерона', 'Иммунитет', 'Восстановление'],
        with_food: 'С едой чтобы избежать тошноту',
        important: 'Не превышайте 40 мг в день',
        priority: 5,
        period: 'evening'
      }
    ]
  },

  // АДАПТОГЕНЫ ДЛЯ ЭНЕРГИИ (при смешанных или физических нагрузках)
  adaptogens: {
    condition: (answers) => answers.workload_type &&
      ['Смешанная 50/50', 'Физическая + недосып'].includes(answers.workload_type),
    supplements: [
      {
        name: 'Родиола розовая',
        dosage: '200-400 мг',
        time: 'утром',
        reason: 'Адаптоген для фокуса. Учит тело справляться со стрессом, дает энергию без взрыва как кофеин.',
        benefits: ['Устойчивость к стрессу', 'Умственная энергия', 'Адаптация к нагрузкам'],
        with_food: 'За 20-30 минут до завтрака',
        combo: 'Утром - родиола для фокуса, вечером - ашваганда для отключения',
        priority: 4,
        period: 'morning'
      }
    ]
  },

  // ГОРМОНАЛЬНАЯ ПОДДЕРЖКА (при проблемах с либидо и настроением)
  hormonal_support: {
    condition: (answers) => answers.libido_mood &&
      ['Либидо низкое, частые перепады настроения', 'Апатия, раздражительность, нет интереса'].includes(answers.libido_mood),
    supplements: [
      {
        name: 'Ашваганда',
        dosage: '600 мг',
        time: 'утром и вечером',
        reason: 'Помимо антистресс эффекта, нормализует гормональный фон и повышает либидо.',
        benefits: ['Баланс гормонов', 'Повышение либидо', 'Стабильность настроения'],
        with_food: 'Можно с едой или без',
        important: 'Эффект накопительный, проявляется через 2-3 недели',
        priority: 6,
        period: 'morning'
      }
    ]
  }
};

// ОБНОВЛЕННАЯ ФУНКЦИЯ ГЕНЕРАЦИИ РЕКОМЕНДАЦИЙ
function generateRecommendations(answers) {
  const allRecommendations = [];
  const seenSupplements = new Set();

  // Сначала БАЗОВЫЕ (всегда)
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

  // Сортируем по приоритету и лимитируем
  return allRecommendations
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);
}

// ОБНОВЛЕННАЯ ФУНКЦИЯ ФОРМАТИРОВАНИЯ РЕКОМЕНДАЦИЙ
function formatRecommendations(recommendations) {
  if (recommendations.length === 0) {
    return `🎉 *Ваш образ жизни близок к идеалу!*\n\nНо даже самым здоровым людям мы рекомендуем базовую поддержку:\n• Омега-3 для мозга и противовоспаления\n• Витамин D3 для иммунитета в нашем климате\n\nЭти добавки - страховка для вашего здоровья! 💪`;
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

    // 🔥 НОВОЕ: Информация о приеме с едой
    if (supp.with_food) {
      message += `   🍽️ *Прием:* ${supp.with_food}\n`;
    }

    message += `   💫 *Почему это важно:* ${supp.reason}\n`;

    if (supp.important) {
      message += `   💡 *Ключевой совет:* ${supp.important}\n`;
    }

    if (supp.combo) {
      message += `   🔄 *Отлично сочетается:* ${supp.combo}\n`;
    }

    message += `\n`;
  });

  message += `---\n🎯 *КАК ДОБИТЬСЯ МАКСИМАЛЬНОГО ЭФФЕКТА:*\n\n`;

  // Умные советы based на комбинациях
  const hasMagnesium = recommendations.some(s => s.name.includes('Магний'));
  const hasVitaminD = recommendations.some(s => s.name.includes('Витамин D'));
  const hasAshwagandha = recommendations.some(s => s.name.includes('Ашваганда'));

  if (hasMagnesium && hasVitaminD) {
    message += `💡 *Комбо-совет:* Принимайте Магний и Витамин D вместе - они усиливают действие друг друга!\n\n`;
  }

  if (hasAshwagandha && hasMagnesium) {
    message += `💡 *Комбо-совет:* Ашваганда утром + Магний вечером = идеальная антистресс комбинация!\n\n`;
  }

  message += `📅 *Регулярность важнее дозировки!* Старайтесь принимать добавки ежедневно.\n\n`;
  message += `🔄 *Через 30 дней* пройдите опрос заново для корректировки плана.\n\n`;

  message += `⚠️ *Важно:* Перед началом приема проконсультируйтесь с врачом, особенно если у вас есть хронические заболевания.`;

  return message;
}

module.exports = { generateRecommendations, formatRecommendations };
