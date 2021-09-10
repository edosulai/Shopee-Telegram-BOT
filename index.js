require('dotenv').config()

const { Telegraf, session } = require('telegraf');
const mongoose = require('mongoose');
const chalk = require('chalk');

const User = require('./models/User');
const Other = require('./models/Other');

const bot = new Telegraf(process.env.TOKEN);

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('./helpers'))

mongoose.connect(process.env.MONGODB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((res, err) => err ? console.error(chalk.red(err)) : console.log(chalk.green('MongoDB connection successful.')))
  .catch((err) => console.error(chalk.red(err)))

bot.use(session())

bot.telegram.getMe().then(async (botInfo) => {
  process.env.BOT_NAME = botInfo.first_name
  process.env.BOT_USERNAME = botInfo.username
  process.env.BOT_ID = botInfo.id

  await User.updateMany({}, {
    queue: false
  }, async function (err, user, created) { if (err) return sendReportToDev(bot, err) })

  await User.updateMany({ teleChatId: process.env.ADMIN_ID }, {
    userRole: 1
  }, async function (err, user, created) { if (err) return sendReportToDev(bot, err) })

  await Other.findOrCreate({}, {
    "promotionId": [], "disableProducts": [{ "url": null, "itemid": null, "shopid": null, "allowed": [1], "message": "..." }], "eventProducts": [{ "url": null, "itemid": null, "shopid": null, "price": null }], "metaPayment": { "channels": [{ "name_label": "label_shopee_wallet_v2", "version": 2, "spm_channel_id": 8001400, "be_channel_id": 80030, "name": "ShopeePay", "enabled": true, "channel_id": 8001400 }, { "name_label": "label_offline_bank_transfer", "version": 2, "spm_channel_id": 8005200, "be_channel_id": 80060, "name": "Transfer Bank", "enabled": true, "channel_id": 8005200, "banks": [{ "bank_name": "Bank BCA (Dicek Otomatis)", "option_info": "89052001", "be_channel_id": 80061, "enabled": true }, { "bank_name": "Bank Mandiri(Dicek Otomatis)", "option_info": "89052002", "enabled": true, "be_channel_id": 80062 }, { "bank_name": "Bank BNI (Dicek Otomatis)", "option_info": "89052003", "enabled": true, "be_channel_id": 80063 }, { "bank_name": "Bank BRI (Dicek Otomatis)", "option_info": "89052004", "be_channel_id": 80064, "enabled": true }, { "bank_name": "Bank Syariah Indonesia (BSI) (Dicek Otomatis)", "option_info": "89052005", "be_channel_id": 80065, "enabled": true }, { "bank_name": "Bank Permata (Dicek Otomatis)", "be_channel_id": 80066, "enabled": true, "option_info": "89052006" }] }, { "channelid": 89000, "name_label": "label_cod", "version": 1, "spm_channel_id": 0, "be_channel_id": 89000, "name": "COD (Bayar di Tempat)", "enabled": true }] }
  }, async function (err, other, created) { if (err) return sendReportToDev(bot, err) })

}).catch((err) => console.error(chalk.red(err)))

bot.use((ctx, next) => {
  if (!ctx.message.chat) return;
  return User.findOrCreate({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, {
    teleChatData: {
      id: ctx.message.chat.id,
      firstName: ctx.message.chat.first_name,
      lastName: ctx.message.chat.last_name,
      username: ctx.message.chat.username
    },
    userLoginInfo: { email: null, },
    userCookie: { csrftoken: generateString(32) },
    userRole: 4,
    queue: false
  }, async function (err, user, created) {
    if (err) return sendReportToDev(ctx, new Error(err))
    if (created) sendReportToDev(ctx, `Akun Baru Terbuat`, 'Info')
    ctx.session = user
    ctx.session.Curl = require('./helpers/curl')
    if (process.env.NODE_ENV == 'development' && !ensureRole(ctx, true)) {
      ctx.reply(`Bot Sedang Maintenance, Silahkan Contact @edosulai`).then(() => sendReportToDev(ctx, `${ctx.session.teleChatId} Mencoba Akses BOT`, 'Info'))
      return ctx.telegram.leaveChat(ctx.message.chat.id).then().catch((err) => sendReportToDev(ctx, `${ctx.session.teleChatId} Meninggalkan BOT`, 'Info'));
    }
    return next(ctx)
  })
})

bot.start(require('./command/start'))
bot.help(require('./command/help'))

bot.command('alarm', require('./command/alarm'))
// bot.command('info', require('./command/info'))
// bot.command('speed', require('./command/speed'))
// bot.command('log', require('./command/log'))
// bot.command('failure', require('./command/failure'))
// bot.command('user', require('./command/user'))
bot.command('login', require('./command/login'))
bot.command('event', require('./command/event'))
// bot.command('disable', require('./command/disable'))
bot.command('beli', require('./command/beli'))
bot.command('quit', require('./command/quit'))

bot.command((ctx) => {
  let user = ctx.session;
  user.commands = splitAtFirstSpace(ctx.message.text)
  if (user.commands.length < 2) return ctx.reply(`/(user) <code>...message...</code>`, { parse_mode: 'HTML' })
  User.findOne(function (userData) {
    if (Number.isInteger(parseInt(userData))) return {
      teleBotId: process.env.BOT_ID,
      teleChatId: userData
    }
    return {
      teleBotId: process.env.BOT_ID,
      'teleChatData.username': userData
    }
  }(user.commands[0].substring(1)), function (err, u) {
    if (err || !u) return
    return ctx.reply(`<code>${`@${ctx.message.chat.username}` || ctx.message.chat.first_name} : ${user.commands[1].replace(/(<([^>]+)>)/gi, "")}</code>`, { chat_id: u.teleChatId, parse_mode: 'HTML' })
  })
})

bot.catch((err, ctx) => sendReportToDev(ctx, new Error(err)))

bot.launch()