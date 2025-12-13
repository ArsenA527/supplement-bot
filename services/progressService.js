const db = require('../config/database');

class ProgressService {
  async getSurveyProgress(chatId) {
    return new Promise((resolve) => {
      db.get('SELECT state FROM users WHERE chat_id = ?', [chatId], (err, row) => {
        if (err || !row || !row.state) {
          resolve({ current: 0, total: 0 });
          return;
        }

        try {
          const state = JSON.parse(row.state);
          const surveyService = require('./surveyService');

          surveyService.getQuestionsForUser(chatId).then(questions => {
            resolve({
              current: state.current,
              total: questions.length,
              percentage: Math.round((state.current / questions.length) * 100)
            });
          });
        } catch (error) {
          resolve({ current: 0, total: 0 });
        }
      });
    });
  }

  async sendProgressUpdate(ctx, message, progress) {
    const progressBar = this.generateProgressBar(progress.current, progress.total);
    const fullMessage = `${progressBar}\n\n${message}`;

    return ctx.reply(fullMessage);
  }

  generateProgressBar(current, total) {
    if (total === 0) return '';

    const percentage = Math.round((current / total) * 100);
    const filled = '█'.repeat(Math.round(percentage / 10));
    const empty = '░'.repeat(10 - filled.length);
    return `📊 Прогресс: [${filled}${empty}] ${percentage}%`;
  }
}

module.exports = new ProgressService();
