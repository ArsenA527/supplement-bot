const questions = require('../data/questions');
const userState = {};

function startSurvey(chatId) {
  userState[chatId] = { current: 0, answers: {} };
  return getCurrentQuestion(chatId);
}

function getCurrentQuestion(chatId) {
  const state = userState[chatId];
  if (!state || state.current >= questions.length) return null;

  return questions[state.current];
}

function saveAnswer(chatId, answer) {
  const state = userState[chatId];
  if (!state) return false;

  const question = questions[state.current];
  if (!question) return false;

  state.answers[question.key] = answer;
  state.current++;

  return true;
}

function getSurveyResults(chatId) {
  const state = userState[chatId];
  if (!state) return null;

  return state.answers;
}

function isSurveyCompleted(chatId) {
  const state = userState[chatId];
  return state && state.current >= questions.length;
}

function clearSurvey(chatId) {
  delete userState[chatId];
}

module.exports = {
  startSurvey,
  getCurrentQuestion,
  saveAnswer,
  getSurveyResults,
  isSurveyCompleted,
  clearSurvey
};
