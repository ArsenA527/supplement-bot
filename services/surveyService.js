const db = require('../config/database');
const subscriptionService = require('./subscriptionService');
const questions = require('../data/questions');

class SurveyService {
  // Начать опрос
  async startSurvey(chatId, userData = {}) {
    const canStart = await this.canStartSurvey(chatId);

    if (!canStart) {
      throw new Error('Вы уже проходили опрос. Для повторного прохождения оформите подписку Premium.');
    }

    const state = {
      current: 0,
      answers: {},
      userData: userData,
      startedAt: new Date().toISOString(),
      surveyType: await this.getSurveyType(chatId)
    };

    await this.saveUserData(chatId, state);

    // Логируем начало опроса
    console.log(`📝 Пользователь ${chatId} начал ${state.surveyType} опрос`);

    return this.getCurrentQuestion(chatId);
  }

  async saveSurveyMessageId(chatId, messageId) {
    return new Promise((resolve, reject) => {
      const db = require('../config/database');
      db.run(
        `UPDATE users SET survey_message_id = ? WHERE chat_id = ?`,
        [messageId, chatId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  async getSurveyMessageId(chatId) {
    return new Promise((resolve) => {
      const db = require('../config/database');
      db.get(
        `SELECT survey_message_id FROM users WHERE chat_id = ?`,
        [chatId],
        (err, row) => {
          if (err || !row) resolve(null);
          else resolve(row.survey_message_id);
        }
      );
    });
  }

  async clearSurveyMessageId(chatId) {
    return new Promise((resolve) => {
      const db = require('../config/database');
      db.run(
        `UPDATE users SET survey_message_id = NULL WHERE chat_id = ?`,
        [chatId],
        (err) => {
          if (err) console.error('Ошибка очистки survey_message_id:', err);
          resolve();
        }
      );
    });
  }

  // Получить тип опроса (free/premium)
  async getSurveyType(chatId) {
    const isPremium = await subscriptionService.isSubscriptionActive(chatId);
    return isPremium ? 'premium' : 'free';
  }

  // Получить текущий вопрос
  async getCurrentQuestion(chatId) {
    const state = await this.getUserState(chatId);
    if (!state) return null;

    const userQuestions = await this.getQuestionsForUser(chatId);

    if (state.current >= userQuestions.length) return null;

    const question = userQuestions[state.current];
    const currentAnswers = state.answers[question.key];


    return question ? {
      ...question,
      index: state.current,
      total: userQuestions.length
    } : null;

  }

  // Получить вопросы в зависимости от подписки
  async getQuestionsForUser(chatId) {
    try {
      const isPremium = await subscriptionService.isSubscriptionActive(chatId);
      const selectedQuestions = isPremium ? questions.premium : questions.free;

      console.log(`📋 Загружено ${selectedQuestions.length} вопросов для пользователя ${chatId} (${isPremium ? 'premium' : 'free'})`);

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
        `SELECT answers FROM users WHERE chat_id = ? AND answers IS NOT NULL AND answers != '{}'`,
        [chatId],
        (err, row) => {
          const hasAnswers = !!row && Object.keys(JSON.parse(row.answers)).length > 0;
          console.log(`🔍 Пользователь ${chatId} уже проходил опрос: ${hasAnswers}`);
          resolve(hasAnswers);
        }
      );
    });
  }

  // Сохранить ответ
  async saveAnswer(chatId, answer) {
    const state = await this.getUserState(chatId);
    if (!state) throw new Error('Сессия опроса не найдена. Начните заново: /survey');

    const userQuestions = await this.getQuestionsForUser(chatId);
    const question = userQuestions[state.current];

    if (!question) throw new Error('Вопрос не найден');

    if (question.isMultiple) {
      state.answers[question.key] = state.answers[question.key] || [];

      if (answerData.action === 'add') {
        if (!state.answers[question.key].includes(answer)) {
          state.answers[question.key].push(answer);
        }
      } else if (answerData.action === 'continue') {
        state.current++;
      }

    } else {
      state.answers[question.key] = answer;
    }

    state.current++;
    await this.saveUserData(chatId, state);

    // console.log(`💾 Ответ сохранен: ${question.key} = ${answer} (вопрос ${state.current}/${userQuestions.length})`);

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
            try {
              const state = row && row.state ? JSON.parse(row.state) : null;
              resolve(state);
            } catch (parseError) {
              console.error('❌ Ошибка парсинга состояния:', parseError);
              resolve(null);
            }
          }
        }
      );
    });
  }

  // Сохранить данные пользователя
  async saveUserData(chatId, state) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO users (chat_id, username, first_name, last_name, state, answers, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          chatId,
          state.userData.username,
          state.userData.first_name,
          state.userData.last_name,
          JSON.stringify(state),
          JSON.stringify(state.answers)
        ],
        (err) => {
          if (err) {
            console.error('❌ Ошибка сохранения данных:', err);
            reject(err);
          } else {
            resolve();
          }
        }
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
            try {
              resolve(JSON.parse(row.answers));
            } catch (parseError) {
              console.error('❌ Ошибка парсинга результатов:', parseError);
              resolve(null);
            }
          }
        }
      );
    });
  }

  // Завершить опрос
  async completeSurvey(chatId) {
    return new Promise((resolve, reject) => {
      const db = require('../config/database');
      db.run(
        `UPDATE users SET state = NULL, survey_message_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?`,
        [chatId],
        (err) => {
          if (err) {
            console.error('❌ Ошибка завершения опроса:', err);
            reject(err);
          } else {
            console.log(`✅ Опрос завершен для пользователя ${chatId}`);
            resolve();
          }
        }
      );
    });
  }

  // Получить прогресс опроса
  async getSurveyProgress(chatId) {
    try {
      const state = await this.getUserState(chatId);
      if (!state) return { current: 0, total: 0, percentage: 0 };

      const questions = await this.getQuestionsForUser(chatId);
      const percentage = questions.length > 0 ? Math.round((state.current / questions.length) * 100) : 0;

      return {
        current: state.current,
        total: questions.length,
        percentage: percentage
      };
    } catch (error) {
      console.error('❌ Ошибка получения прогресса:', error);
      return { current: 0, total: 0, percentage: 0 };
    }
  }

  // Проверить существование пользователя
  async userExists(chatId) {
    return new Promise((resolve) => {
      db.get(
        'SELECT 1 FROM users WHERE chat_id = ?',
        [chatId],
        (err, row) => resolve(!!row)
      );
    });
  }

  // Получить статистику опросов
  async getSurveyStats() {
    return new Promise((resolve) => {
      db.get(
        `SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN answers IS NOT NULL AND answers != '{}' THEN 1 END) as completed_surveys,
          COUNT(CASE WHEN state IS NOT NULL THEN 1 END) as active_surveys
          FROM users`,
        (err, row) => {
          if (err) {
            console.error('❌ Ошибка получения статистики:', err);
            resolve({ total_users: 0, completed_surveys: 0, active_surveys: 0 });
          } else {
            resolve(row);
          }
        }
      );
    });
  }
}

module.exports = new SurveyService();
