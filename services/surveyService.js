const db = require('../config/database');
const questions = require('../data/questions');

class SurveyService {
  async startSurvey(chatId, userData = {}) {
    const state = {
      current: 0,
      answers: {},
      userData: userData
    };
    await this.saveUserData(chatId, state);
    return this.getCurrentQuestion(chatId);
  }

  async getCurrentQuestion(chatId) {
    const state = await this.getUserState(chatId);
    if (!state || state.current >= questions.length) return null;

    const question = questions[state.current];
    return { ...question, index: state.current };
  }

  async saveAnswer(chatId, answer) {
    const state = await this.getUserState(chatId);
    if (!state) return false;

    const question = questions[state.current];
    if (!question) return false;

    // Валидация числовых полей
    if (['age', 'height', 'weight'].includes(question.key)) {
      const numValue = parseInt(answer);
      if (isNaN(numValue) || numValue <= 0) {
        throw new Error('Введите корректное число');
      }
      state.answers[question.key] = numValue;
    } else {
      state.answers[question.key] = answer;
    }

    state.current++;
    await this.saveUserData(chatId, state);
    return true;
  }

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

  async getSurveyResults(chatId) {
    return new Promise((resolve) => {
      db.get(
        'SELECT answers FROM users WHERE chat_id = ?',
        [chatId],
        (err, row) => {
          resolve(row && row.answers ? JSON.parse(row.answers) : null);
        }
      );
    });
  }

  async completeSurvey(chatId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE users SET state = NULL WHERE chat_id = ?`,
        [chatId],
        (err) => err ? reject(err) : resolve()
      );
    });
  }
}

module.exports = new SurveyService();
