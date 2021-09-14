require('dotenv').config()

const { Telegraf, session } = require('telegraf');
const mongoose = require('mongoose');
const chalk = require('chalk');

const getFlashSaleSession = require('./request/other/getFlashSaleSession');
const getAddress = require('./request/other/getAddress');

const User = require('./models/User');
const Event = require('./models/Event');
const FlashSale = require('./models/FlashSale');

const Curl = require('./helpers/curl')

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
  process.env.BOT_ID = parseInt(botInfo.id)

  await sendReportToDev(bot, botInfo.first_name, `Starting`)

  await User.updateMany({ teleBotId: process.env.BOT_ID }, {
    queue: false,
    alarm: false
  }, async function (err, user, created) { if (err) return sendReportToDev(bot, err) })

  await User.updateMany({ teleChatId: process.env.ADMIN_ID }, {
    userRole: 1
  }, async function (err, user, created) { if (err) return sendReportToDev(bot, err) })

  return await async function _tryGetFlashSale(timeout) {
    await User.find(async function (err, users) {
      if (err) return sendReportToDev(bot, err)

      for (const user of users) {
        user.Curl = Curl
        await getAddress(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
          setNewCookie(user.userCookie, headers['set-cookie'])
          curl.close()
        })

        await User.updateOne({
          teleBotId: user.teleBotId,
          teleChatId: user.teleChatId
        }, {
          userCookie: user.userCookie
        }).exec()
      }
    })

    await Event.deleteMany({ teleBotId: process.env.BOT_ID }).exec()
    await FlashSale.deleteMany({ teleBotId: process.env.BOT_ID }).exec()

    await getFlashSaleSession({ Curl: Curl }).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      const getFlashSaleSession = typeof body == 'string' ? JSON.parse(body) : body;

      for await (const [index, session] of getFlashSaleSession.data.sessions.entries()) {
        if (index == 0) timeout = session.end_time + 10

        await FlashSale.findOrCreate({
          end_time: session.end_time,
          promotionid: session.promotionid,
          start_time: session.start_time,
          teleBotId: process.env.BOT_ID
        }, {
          description: session.description,
          end_time: session.end_time,
          is_ongoing: session.is_ongoing,
          name: session.name,
          promotionid: session.promotionid,
          start_time: session.start_time,
          status: session.statuss
        }, async function (err, event, created) { if (err) return sendReportToDev(bot, err) })
      }

      curl.close()
    }).catch((err) => console.error(chalk.red(err)));

    setTimeout(await _tryGetFlashSale.bind(null, 0), (timeout * 1000) - Date.now());
  }(0)

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
    userLoginInfo: { email: null },
    userCookie: { csrftoken: generateString(32) },
    userRole: 4,
    queue: false,
    alarm: false
  }, async function (err, user, created) {
    if (err) return sendReportToDev(ctx, new Error(err))
    if (created) sendReportToDev(ctx, `Akun Baru Terbuat`, 'Info')
    ctx.session = user
    ctx.session.Curl = Curl
    ctx.session.metaPayment = { channels: [{ name_label: "label_shopee_wallet_v2", version: 2, spm_channel_id: 8001400, be_channel_id: 80030, name: "ShopeePay", enabled: !0, channel_id: 8001400 }, { name_label: "label_offline_bank_transfer", version: 2, spm_channel_id: 8005200, be_channel_id: 80060, name: "Transfer Bank", enabled: !0, channel_id: 8005200, banks: [{ bank_name: "Bank BCA (Dicek Otomatis)", option_info: "89052001", be_channel_id: 80061, enabled: !0 }, { bank_name: "Bank Mandiri(Dicek Otomatis)", option_info: "89052002", enabled: !0, be_channel_id: 80062 }, { bank_name: "Bank BNI (Dicek Otomatis)", option_info: "89052003", enabled: !0, be_channel_id: 80063 }, { bank_name: "Bank BRI (Dicek Otomatis)", option_info: "89052004", be_channel_id: 80064, enabled: !0 }, { bank_name: "Bank Syariah Indonesia (BSI) (Dicek Otomatis)", option_info: "89052005", be_channel_id: 80065, enabled: !0 }, { bank_name: "Bank Permata (Dicek Otomatis)", be_channel_id: 80066, enabled: !0, option_info: "89052006" }] }, { channelid: 89e3, name_label: "label_cod", version: 1, spm_channel_id: 0, be_channel_id: 89e3, name: "COD (Bayar di Tempat)", enabled: !0 }] }
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
bot.command('info', require('./command/info'))
bot.command('speed', require('./command/speed'))
bot.command('log', require('./command/log'))
bot.command('user', require('./command/user'))
bot.command('login', require('./command/login'))
bot.command('event', require('./command/event'))
bot.command('beli', require('./command/beli'))
bot.command('restart', require('./command/restart'))
bot.command('quit', require('./command/quit'))

bot.command((ctx) => {
  let user = ctx.session;
  user.commands = splitAtFirstSpace(ctx.message.text)
  if (user.commands.length < 2) return ctx.reply(`/user <code>...message...</code>`, { parse_mode: 'HTML' })
  User.findOne({ teleBotId: process.env.BOT_ID }, function (userData) {
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