require('dotenv').config()

const { Telegraf, session } = require('telegraf');
const mongoose = require('mongoose');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const tls = require('tls');

const getFlashSaleSession = require('./request/other/getFlashSaleSession');
const getAddress = require('./request/other/getAddress');
const postInfoKeranjang = require('./request/buy/postInfoKeranjang');

const User = require('./models/User');
const Event = require('./models/Event');
const FlashSale = require('./models/FlashSale');

const Curl = require('./helpers/curl')

const { sendReportToDev, generateString, ensureRole, setNewCookie } = require('./helpers')

const bot = new Telegraf(process.env.TOKEN);

mongoose.connect(process.env.MONGODB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((res, err) => err ? console.error(chalk.red(err)) : console.log(chalk.green('MongoDB connection successful.')))
  .catch((err) => console.error(chalk.red(err)))

bot.use(session())

bot.telegram.getMe().then(async (botInfo) => {
  process.env.BOT_NAME = botInfo.first_name
  process.env.BOT_USERNAME = botInfo.username
  process.env.BOT_ID = parseInt(botInfo.id)
  process.env.CERT_PATH = path.join(__dirname, 'cert.pem')

  fs.writeFileSync(process.env.CERT_PATH, tls.rootCertificates.join('\n'))

  await User.updateMany({ teleBotId: process.env.BOT_ID }, {
    queue: false,
    alarm: false
  }, async function (err, user, created) { if (err) return sendReportToDev(bot, err) })

  await User.updateMany({ teleChatId: process.env.ADMIN_ID }, {
    userRole: 1
  }, async function (err, user, created) { if (err) return sendReportToDev(bot, err) })

  return await async function tryGetFlashSale(timeout) {

    await User.find(async function (err, users) {
      if (err) return sendReportToDev(bot, err)

      for (const user of users) {
        user.Curl = Curl
        await getAddress({ session: user }).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
          setNewCookie(user.userCookie, headers['set-cookie'])
          curl.close()
        }).catch((err) => sendReportToDev(bot, err))

        user.itemid = 0
        user.modelid = 0
        user.shopid = 0

        await postInfoKeranjang({ session: user }).then(({ statusCode, body, headers, curlInstance, curl }) => {
          setNewCookie(user.userCookie, headers['set-cookie'])
          curl.close()
        }).catch((err) => sendReportToDev(bot, err))

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

      for await (const [index, session] of (getFlashSaleSession.data.sessions).sort((a, b) => a.start_time - b.start_time).entries()) {
        if (index == 0) timeout = session.end_time + 2

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

    await sendReportToDev(bot, botInfo.first_name, `Starting`)

    setTimeout(await tryGetFlashSale.bind(null, 0), (timeout * 1000) - Date.now());
  }(0)

}).catch((err) => console.error(chalk.red(err)))

bot.use((ctx, next) => {
  if (!ctx.message.chat) return;

  const certFilePath = path.join(__dirname, 'cert.pem')
  const tlsData = tls.rootCertificates.join('\n')
  fs.writeFileSync(certFilePath, tlsData)

  return User.findOrCreate({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, {
    teleChatData: {
      id: ctx.message.chat.id,
      firstName: ctx.message.chat.first_name,
      lastName: ctx.message.chat.last_name,
      username: ctx.message.chat.username
    },
    userLoginInfo: { email: null },
    userCookie: {
      csrftoken: {
        value: generateString(32),
        Domain: 'shopee.co.id',
        Path: '/',
        expires: -1
      }
    },
    userRole: 4,
    queue: false,
    alarm: false
  }, async function (err, user, created) {
    if (err) return sendReportToDev(ctx, err)
    if (created) sendReportToDev(ctx, `Akun Baru Terbuat`, 'Info')
    ctx.session = user
    ctx.session.Curl = Curl
    ctx.session.certFilePath = certFilePath
    ctx.session.tlsData = tlsData
    ctx.session.metaPayment = { channels: [{ name_label: "label_shopee_wallet_v2", version: 2, spm_channel_id: 8001400, be_channel_id: 80030, name: "ShopeePay", enabled: !0, channel_id: 8001400 }, { name_label: "label_offline_bank_transfer", version: 2, spm_channel_id: 8005200, be_channel_id: 80060, name: "Transfer Bank", enabled: !0, channel_id: 8005200, banks: [{ bank_name: "Bank BCA (Dicek Otomatis)", option_info: "89052001", be_channel_id: 80061, enabled: !0 }, { bank_name: "Bank Mandiri(Dicek Otomatis)", option_info: "89052002", enabled: !0, be_channel_id: 80062 }, { bank_name: "Bank BNI (Dicek Otomatis)", option_info: "89052003", enabled: !0, be_channel_id: 80063 }, { bank_name: "Bank BRI (Dicek Otomatis)", option_info: "89052004", be_channel_id: 80064, enabled: !0 }, { bank_name: "Bank Syariah Indonesia (BSI) (Dicek Otomatis)", option_info: "89052005", be_channel_id: 80065, enabled: !0 }, { bank_name: "Bank Permata (Dicek Otomatis)", be_channel_id: 80066, enabled: !0, option_info: "89052006" }] }, { channelid: 89e3, name_label: "label_cod", version: 1, spm_channel_id: 0, be_channel_id: 89e3, name: "COD (Bayar di Tempat)", enabled: !0 }] }
    if (process.env.NODE_ENV == 'development' && !ensureRole(ctx, true)) {
      return ctx.reply(`Bot Sedang Maintenance, Silahkan Contact @edosulai`).then(() => sendReportToDev(ctx, `${ctx.session.teleChatId} Mencoba Akses BOT`, 'Info'))
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
bot.command('quit', require('./command/quit'))

bot.catch((err, ctx) => sendReportToDev(ctx, err))

bot.launch()