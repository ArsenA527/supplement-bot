const supplementsDatabase = require('../data/supplementsDatabase');

class EnhancedRecommendationService {
  generatePersonalizedRecommendations(answers) {
    const recommendations = [];

    // 🔄 ОБЯЗАТЕЛЬНЫЕ ДЛЯ ВСЕХ
    recommendations.push(...this.getEssentialSupplements(answers));

    // 🎯 ПО ЦЕЛЯМ ПОЛЬЗОВАТЕЛЯ
    recommendations.push(...this.getGoalBasedSupplements(answers));

    // ⚠️ ПО СИМПТОМАМ
    recommendations.push(...this.getSymptomBasedSupplements(answers));

    // 👤 ПЕРСОНАЛИЗАЦИЯ ПО ПОЛУ/ВОЗРАСТУ
    recommendations.push(...this.getDemographicSupplements(answers));

    return this.removeDuplicates(recommendations);
  }

  getEssentialSupplements(answers) {
    const essentials = [];

    // Омега-3 почти всем
    if (!answers.diet?.includes('Много рыбы')) {
      essentials.push(this.createSupplement('Омега-3', answers));
    }

    // Витамин D особенно важен в России
    essentials.push(this.createSupplement('Витамин D3', answers));

    // Магний при стрессе или плохом сне
    if (answers.stress !== 'Редко' || answers.sleep !== 'Хороший') {
      essentials.push(this.createSupplement('Магний', answers));
    }

    return essentials;
  }

  getGoalBasedSupplements(answers) {
    const goalSupplements = [];
    const goal = answers.goal;

    const goalMap = {
      'Энергия и бодрость': ['Коэнзим Q10', 'Железо'],
      'Сон и восстановление': ['Магний', 'L-Теанин'],
      'Иммунитет': ['Витамин C', 'Цинк'],
      'Работа мозга и память': ['Омега-3', 'L-Теанин'],
      'Кожа, волосы, ногти': ['Коллаген', 'Биотин'],
      'Контроль веса': ['Хром', 'L-Карнитин'],
      'Половое здоровье': ['Цинк', 'Мака перуанская'],
      'Долголетие и профилактика': ['Куркумин', 'Ресвератрол']
    };

    if (goalMap[goal]) {
      goalMap[goal].forEach(supp => {
        goalSupplements.push(this.createSupplement(supp, answers));
      });
    }

    return goalSupplements;
  }

  createSupplement(name, userData) {
    const supplement = supplementsDatabase[name];
    if (!supplement) return null;

    return {
      name: name,
      dosage: this.getPersonalizedDosage(supplement, userData),
      time: supplement.bestTime,
      reason: this.generateMotivationalReason(supplement, userData),
      benefits: supplement.benefits,
      importantNotes: supplement.note,
      synergy: supplement.synergy
    };
  }

  generateMotivationalReason(supplement, userData) {
    const reasons = {
      'Омега-3': `Ваш мозг на 60% состоит из жиров - Омега-3 поможет ему работать на полную мощность! 💡`,
      'Витамин D3': `В вашем регионе солнца недостаточно для выработки витамина D. Этот "солнечный витамин" критически важен для иммунитета и настроения! ☀️`,
      'Магний': `Современная жизнь истощает запасы магния. Восстановите их для глубокого сна и спокойствия! 😴`,
      'Коэнзим Q10': `После 30 лет выработка CoQ10 снижается. Верните себе энергию молодости! ⚡`
    };

    return reasons[supplement.name] || `${supplement.name} поможет достичь ваших целей!`;
  }

  getPersonalizedDosage(supplement, userData) {
    if (supplement.dosage?.therapeutic && this.needsTherapeuticDosage(userData)) {
      return supplement.dosage.therapeutic;
    }
    return supplement.dosage.standard || supplement.dosage;
  }

  needsTherapeuticDosage(userData) {
    return userData.age > 50 ||
            userData.stress === 'Постоянный стресс' ||
            userData.energy === 'Постоянная усталость';
  }
}
