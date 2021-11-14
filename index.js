require('dotenv').config()

const { Telegraf, session } = require('telegraf');
const mongoose = require('mongoose');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const tls = require('tls');

const FlashSaleSession = require('./request/other/FlashSaleSession');
const Address = require('./request/other/Address');

const User = require('./models/User');
const Event = require('./models/Event');
const FlashSale = require('./models/FlashSale');

const { logReport, generateString, ensureRole, setNewCookie } = require('./helpers')

const bot = new Telegraf(process.env.TOKEN);

mongoose.connect(process.env.MONGODB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((res, err) => err ? console.error(chalk.red(err)) : console.log(chalk.green('MongoDB connection successful.')))
  .catch((err) => console.error(chalk.red(err)))

bot.use(session())

bot.telegram.getMe().then(async (botInfo) => {
  process.env.BOT_NAME = botInfo.first_name
  process.env.BOT_USERNAME = botInfo.username
  process.env.BOT_ID = parseInt(botInfo.id)
  process.env.CERT_PATH = path.join(__dirname + '/temp', 'cert.pem')

  fs.writeFileSync(process.env.CERT_PATH, tls.rootCertificates.join('\n'))

  await User.updateMany({ teleBotId: process.env.BOT_ID }, {
    queue: false,
    alarm: false
  }, async function (err, user, created) { if (err) return logReport(bot, err) })

  await User.updateMany({ teleChatId: process.env.ADMIN_ID }, {
    userRole: 1
  }, async function (err, user, created) { if (err) return logReport(bot, err) })

  return await async function tryGetFlashSale(timeout) {

    await User.find(async function (err, users) {
      if (err) return logReport(bot, err)

      for (const user of users) {
        await Address({ session: user }).then(async ({ statusCode, data, headers }) => {
          setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
        }).catch((err) => logReport(bot, err))

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

    await FlashSaleSession().then(async ({ statusCode, data, headers }) => {
      const FlashSaleSession = typeof data == 'string' ? JSON.parse(data) : data;

      for await (const [index, session] of (FlashSaleSession.data.sessions).sort((a, b) => a.start_time - b.start_time).entries()) {
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
        }, async function (err, event, created) { if (err) return logReport(bot, err) })
      }

    }).catch((err) => console.error(chalk.red(err)));

    await logReport(bot, botInfo.first_name, `Starting`)

    setTimeout(await tryGetFlashSale.bind(null, 0), (timeout * 1000) - Date.now());
  }(0)

}).catch((err) => console.error(chalk.red(err)))

bot.use((ctx, next) => {
  if (!ctx.message.chat) return;

  const certFilePath = path.join(__dirname + '/temp', 'cert.pem')
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
    if (err) return logReport(ctx, err)
    ctx.session = user
    if (process.env.NODE_ENV == 'development' && !ensureRole(ctx, true)) return ctx.reply(`Bot Sedang Maintenance, Silahkan Contact @edosulai`).then(() => logReport(ctx, `${ctx.session.teleChatId} Mencoba Akses BOT`, 'Info'))
    return next(ctx)
  })
})

bot.start(require('./command/start'))
bot.help(require('./command/help'))

bot.command('alarm', require('./command/alarm'))
bot.command('info', require('./command/info'))
bot.command('log', require('./command/log'))
bot.command('user', require('./command/user'))
bot.command('login', require('./command/login'))
bot.command('event', require('./command/event'))
bot.command('beli', require('./command/beli'))
bot.command('quit', require('./command/quit'))

bot.catch((err, ctx) => logReport(ctx, err))
bot.launch()