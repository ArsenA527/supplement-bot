module.exports = {
  apps: [{
    name: 'supplement-bot',
    script: 'bot.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    instance_var: 'INSTANCE_ID',

    // Environment
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },

    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },

    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/err.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    time: true,

    // Control
    max_restarts: 10,
    min_uptime: '10s',
    listen_timeout: 5000,
    kill_timeout: 5000
  }]
};
