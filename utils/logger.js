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

  getTimestamp() {
    return new Date().toISOString();
  }

  log(level, message, metadata = {}) {
    const timestamp = this.getTimestamp();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...metadata
    };
    const logLine = JSON.stringify(logEntry);

    const colors = {
      info: '\x1b[36m',    // cyan
      error: '\x1b[31m',   // red
      warn: '\x1b[33m',    // yellow
      debug: '\x1b[35m'    // magenta
    };

    console.log(`${colors[level] || ''}[${timestamp}] ${level.toUpperCase()}: ${message}\x1b[0m`);

    const logFile = path.join(this.logDir, `${level}.log`);
    fs.appendFileSync(logFile, logLine + '\n');
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
