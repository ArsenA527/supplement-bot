const Telegraf = require('telegraf');

const bot = new Telegraf('8470299517:AAGCD-OzkgO-ALq12u04KAoAO82MlJoAVYo');

bot.start(ctx => {
  ctx.reply("You have entered the start command");
})

bot.launch();
