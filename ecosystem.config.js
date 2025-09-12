module.exports = {
  apps: [{
    name: 'supplement-bot',
    script: 'bot.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      BOT_TOKEN: process.env.BOT_TOKEN
    },
    env_production: {
      NODE_ENV: 'production',
      BOT_TOKEN: process.env.BOT_TOKEN
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
