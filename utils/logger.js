const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message} ${JSON.stringify(metadata)}`;

    // Консоль
    console.log(logMessage);

    // Файл
    const logFile = path.join(this.logDir, `${level}.log`);
    fs.appendFileSync(logFile, logMessage + '\n');
  }

  info(message, metadata = {}) {
    this.log('info', message, metadata);
  }

  error(message, metadata = {}) {
    this.log('error', message, metadata);
  }

  warn(message, metadata = {}) {
    this.log('warn', message, metadata);
  }

  debug(message, metadata = {}) {
    if (process.env.LOG_LEVEL === 'debug') {
      this.log('debug', message, metadata);
    }
  }
}

module.exports = new Logger();
