// ecosystem.config.js
module.exports = {
  apps: [{
    name: "supplement-bot",
    script: "./bot.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "500M",
    max_restarts: 10,
    min_uptime: "10s",

    // Логирование
    log_file: "./logs/combined.log",
    out_file: "./logs/out.log",
    error_file: "./logs/error.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    merge_logs: true,

    // Переменные окружения
    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    },

    // Настройки перезапуска
    restart_delay: 4000,
    exp_backoff_restart_delay: 100
  }]
};
