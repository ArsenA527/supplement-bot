const db = require('../config/database');
const subscriptionService = require('./subscriptionService');
const questions = require('../data/questions'); // Импортируем из отдельного файла

class SurveyService {
  // Начать опрос
  async startSurvey(chatId, userData = {}) {
    const canStart = await this.canStartSurvey(chatId);

    if (!canStart) {
      throw new Error('Вы уже проходили опрос. Для повторного прохождения оформите подписку.');
    }

    const state = {
      current: 0,
      answers: {},
      userData: userData,
      startedAt: new Date().toISOString()
    };

    await this.saveUserData(chatId, state);
    return this.getCurrentQuestion(chatId);
  }

  // Получить текущий вопрос
  async getCurrentQuestion(chatId) {
    const state = await this.getUserState(chatId);
    if (!state) return null;

    const userQuestions = await this.getQuestionsForUser(chatId);

    // Используем длину актуального массива вопросов
    if (state.current >= userQuestions.length) return null;

    const question = userQuestions[state.current];
    return question ? { ...question, index: state.current } : null;
  }

  // Получить вопросы в зависимости от подписки
  async getQuestionsForUser(chatId) {
    try {
      const isPremium = await subscriptionService.isSubscriptionActive(chatId);
      console.log(`📊 User ${chatId} is premium: ${isPremium}`);
      console.log(`📋 Free questions: ${questions.free.length}, Premium questions: ${questions.premium.length}`);

      const selectedQuestions = isPremium ? questions.premium : questions.free;
      console.log(`🎯 Selected ${selectedQuestions.length} questions for user`);

      return selectedQuestions;
    } catch (error) {
      console.error('❌ Ошибка определения подписки:', error);
      return questions.free;
    }
  }

  // Проверить может ли пользователь начать опрос
  async canStartSurvey(chatId) {
    const isPremium = await subscriptionService.isSubscriptionActive(chatId);
    if (isPremium) return true; // Премиум без ограничений

    // Для free проверяем, не проходили ли уже опрос
    const hasCompleted = await this.hasCompletedSurvey(chatId);
    return !hasCompleted;
  }

  // Проверить завершал ли пользователь опрос
  async hasCompletedSurvey(chatId) {
    return new Promise((resolve) => {
      db.get(
        `SELECT answers FROM users WHERE chat_id = ? AND answers IS NOT NULL`,
        [chatId],
        (err, row) => resolve(!!row && Object.keys(JSON.parse(row.answers)).length > 0)
      );
    });
  }

  // Сохранить ответ
  async saveAnswer(chatId, answer) {
    const state = await this.getUserState(chatId);
    if (!state) throw new Error('Сессия опроса не найдена');

    const userQuestions = await this.getQuestionsForUser(chatId);
    const question = userQuestions[state.current];
    if (!question) throw new Error('Вопрос не найден');

    // Валидация числовых полей
    if (['age', 'height', 'weight'].includes(question.key)) {
      const numValue = parseInt(answer);
      if (isNaN(numValue) || numValue <= 0) {
        throw new Error('Пожалуйста, введите корректное положительное число');
      }
      state.answers[question.key] = numValue;
    } else {
      state.answers[question.key] = answer;
    }

    state.current++;
    await this.saveUserData(chatId, state);
    return true;
  }

  // Получить состояние пользователя
  async getUserState(chatId) {
    return new Promise((resolve) => {
      db.get(
        'SELECT state FROM users WHERE chat_id = ?',
        [chatId],
        (err, row) => {
          if (err) {
            console.error('❌ Ошибка чтения состояния:', err);
            resolve(null);
          } else {
            resolve(row && row.state ? JSON.parse(row.state) : null);
          }
        }
      );
    });
  }

  // Сохранить данные пользователя
  async saveUserData(chatId, state) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (chat_id, state, answers)
         VALUES (?, ?, ?)
         ON CONFLICT(chat_id)
         DO UPDATE SET state = ?, answers = ?, updated_at = CURRENT_TIMESTAMP`,
        [
          chatId,
          JSON.stringify(state),
          JSON.stringify(state.answers),
          JSON.stringify(state),
          JSON.stringify(state.answers)
        ],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  // Получить результаты опроса
  async getSurveyResults(chatId) {
    return new Promise((resolve) => {
      db.get(
        'SELECT answers FROM users WHERE chat_id = ?',
        [chatId],
        (err, row) => {
          if (err || !row || !row.answers) {
            resolve(null);
          } else {
            resolve(JSON.parse(row.answers));
          }
        }
      );
    });
  }

  // Завершить опрос
  async completeSurvey(chatId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE users SET state = NULL WHERE chat_id = ?`,
        [chatId],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  // Получить статистику опроса
  async getSurveyStats(chatId) {
    const state = await this.getUserState(chatId);
    const userQuestions = await this.getQuestionsForUser(chatId);

    return {
      totalQuestions: userQuestions.length,
      completedQuestions: state ? state.current : 0,
      progress: state ? Math.round((state.current / userQuestions.length) * 100) : 0,
      isPremium: await subscriptionService.isSubscriptionActive(chatId)
    };
  }

  // Синхронное получение состояния (для обработки кнопок)
  getUserStateSync(chatId) {
    // Простая синхронная версия для проверки
    try {
      const result = db.prepare('SELECT state FROM users WHERE chat_id = ?').get(chatId);
      return result && result.state ? JSON.parse(result.state) : null;
    } catch (error) {
      return null;
    }
  }

  // Синхронное получение вопросов
  getQuestionsForUserSync(chatId) {
    // Для простоты возвращаем free вопросы
    // В реальности нужно проверять подписку
    return questions.free;
  }
}

module.exports = new SurveyService();
