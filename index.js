const dotenv = require('dotenv'),
  { Telegraf, session } = require('telegraf'),
  mongoose = require('mongoose'),
  fs = require('fs'),
  { exec } = require('child_process'),
  fetch = require('node-fetch'),
  crypto = require('crypto'),
  findOrCreate = require('mongoose-findorcreate'),
  psl = require('psl'),
  { parse } = require('node-html-parser'),
  tr = require('tor-request'),

  packageJson = require('./package.json'),
  Curl = require('./helpers/curl'),
  waitUntil = require('./helpers/waitUntil'),

  getLogin = require('./request/auth/getLogin'),
  postLogin = require('./request/auth/postlogin'),
  postSendOtp = require('./request/auth/postSendOtp'),
  postVerifyOtp = require('./request/auth/postVerifyOtp'),

  getInfoBarang = require('./request/buy/getInfoBarang'),
  postKeranjang = require('./request/buy/postKeranjang'),
  postUpdateKeranjang = require('./request/buy/postUpdateKeranjang'),
  postInfoKeranjang = require('./request/buy/postInfoKeranjang'),
  postInfoCheckoutQuick = require('./request/buy/postInfoCheckoutQuick'),
  postInfoCheckout = require('./request/buy/postInfoCheckout'),
  postBuy = require('./request/buy/postBuy'),

  getInfoPengiriman = require('./request/other/getInfoPengiriman'),
  getAddress = require('./request/other/getAddress'),
  getOrders = require('./request/other/getOrders'),
  getCheckouts = require('./request/other/getCheckouts'),
  postCancel = require('./request/other/postCancel');

dotenv.config();

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('./helpers'))

let queuePromotion = []

mongoose.connect(process.env.MONGODB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((res, err) => console.log('Database Connected...'))
  .catch((err) => console.error(err))

const User = mongoose.model('User', new mongoose.Schema({
  teleChatId: Number,
  teleChatData: Object,
  userLoginInfo: Object,
  userCookie: Object,
  userRole: String,
  updatedAt: {
    type: Date,
    default: Date.now
  }
}).plugin(findOrCreate))

const Others = mongoose.model('Others', new mongoose.Schema({
  prohibitedProducts: Array,
  metaPayment: Object,
  updatedAt: {
    type: Date,
    default: Date.now
  }
}).plugin(findOrCreate))

const Logs = mongoose.model('Logs', {
  teleChatId: Number,
  itemid: Number,
  shopid: Number,
  modelid: Number,
  infoKeranjang: Object,
  updateKeranjang: Object,
  infoCheckoutQuick: Object,
  infoCheckoutLong: Object,
  payment: Object,
  selectedShop: Object,
  selectedItem: Object,
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

const Failures = mongoose.model('Failures', {
  teleChatId: Number,
  itemid: Number,
  shopid: Number,
  modelid: Number,
  postBuyBody: Object,
  postBuyBodyLong: Object,
  infoBarang: Object,
  infoPengiriman: Object,
  infoKeranjang: Object,
  updateKeranjang: Object,
  infoCheckoutQuick: Object,
  infoCheckoutLong: Object,
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

// const express = require("express");

// const app = express();
// const port = process.env.PORT || 8000

// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));
// app.use(express.static(path.join(__dirname, 'public')));
// app.listen(port, () => console.log(`Listening on port ${port}`))

const bot = new Telegraf(process.env.TOKEN)

bot.telegram.getMe().then((botInfo) => {
  process.env.BOT_NAME = botInfo.first_name
  process.env.BOT_USERNAME = botInfo.username
  return bot.telegram.sendMessage(process.env.ADMIN_ID, `<code>Server has Initialized By Nick : ${process.env.BOT_USERNAME}</code>`, { parse_mode: 'HTML' })
}).catch((err) => console.log(err))

bot.use(session())

bot.use((ctx, next) => {
  return User.findOrCreate({ teleChatId: process.env.ADMIN_ID }, {
    teleChatData: ctx.message.chat,
    userLoginInfo: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36 Edg/88.0.705.74', },
    userCookie: { csrftoken: null },
    userRole: "admin"
  }, async function (err, user, created) {
    if (err) return sendReportToDev(ctx, err)
    if (created) sendReportToDev(ctx, `Akun Admin Terbuat`, 'Info')
    return next(ctx)
  })
})

bot.use((ctx, next) => {
  return Others.findOrCreate({}, {
    "prohibitedProducts": [{ "itemid": null, "allowed": ["admin"], "message": "..." }], "metaPayment": { "channels": [{ "name_label": "label_shopee_wallet_v2", "version": 2, "spm_channel_id": 8001400, "be_channel_id": 80030, "name": "ShopeePay", "enabled": true, "channel_id": 8001400 }, { "name_label": "label_offline_bank_transfer", "version": 2, "spm_channel_id": 8005200, "be_channel_id": 80060, "name": "Transfer Bank", "enabled": true, "channel_id": 8005200, "banks": [{ "bank_name": "Bank BCA (Dicek Otomatis)", "option_info": "89052001", "be_channel_id": 80061, "enabled": true }, { "bank_name": "Bank Mandiri(Dicek Otomatis)", "option_info": "89052002", "enabled": true, "be_channel_id": 80062 }, { "bank_name": "Bank BNI (Dicek Otomatis)", "option_info": "89052003", "enabled": true, "be_channel_id": 80063 }, { "bank_name": "Bank BRI (Dicek Otomatis)", "option_info": "89052004", "be_channel_id": 80064, "enabled": true }, { "bank_name": "Bank Syariah Indonesia (BSI) (Dicek Otomatis)", "option_info": "89052005", "be_channel_id": 80065, "enabled": true }, { "bank_name": "Bank Permata (Dicek Otomatis)", "be_channel_id": 80066, "enabled": true, "option_info": "89052006" }] }, { "channelid": 89000, "name_label": "label_cod", "version": 1, "spm_channel_id": 0, "be_channel_id": 89000, "name": "COD (Bayar di Tempat)", "enabled": true }] }
  }, async function (err, other, created) {
    if (err) return sendReportToDev(ctx, err)
    if (created) sendReportToDev(ctx, `Meta Data Other Berhasil Terbuat`, 'Info')
    return next(ctx)
  })
})

bot.use((ctx, next) => {
  return User.findOrCreate({ teleChatId: ctx.message.chat.id }, {
    teleChatData: ctx.message.chat,
    userLoginInfo: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36 Edg/88.0.705.74', },
    userCookie: { csrftoken: null },
    userRole: "member"
  }, async function (err, user, created) {
    if (err) return sendReportToDev(ctx, err)
    if (created) sendReportToDev(ctx, `Akun Baru Terbuat`, 'Info')
    ctx.session = user
    ctx.session.Curl = Curl
    if (process.env.NODE_ENV == 'development' && !ensureRole(ctx, true)) {
      ctx.reply(`Bot Sedang Maintenance, Silahkan Contact @edosulai`).then(() => sendReportToDev(ctx, `Mencoba Akses BOT`, 'Info'))
      return ctx.telegram.leaveChat(ctx.message.chat.id).then().catch((err) => sendReportToDev(ctx, `Meninggalkan BOT`, 'Info'));
    }
    return next(ctx)
  })
})

bot.start((ctx) => {
  let banner = `${process.env.BOT_NAME} <b>v.${packageJson.version}</b>`
  banner += `\n\n<b>==== LIST OPSI SHOP BOT ====</b>`
  banner += `\n\nOpsi <code>/beli</code> ini lah BOT online shopee nya, Agan akan Diperingatkan Login terlebih dahulu apabila email password Agan masih kosong`
  banner += `\n >> Contohnya : /beli <code>url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`
  banner += `\n\nOpsi <code>/stop</code> Digunakan untuk membatalkan atau stop antrian pembelian flashsale berjadwal`
  banner += `\n >> Contohnya : /stop <code>url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`
  banner += `\n\nOpsi <code>/login</code> di gunakan untuk melakukan input data untuk Login Sekaligus Login ke akun Shopee Agan`
  banner += `\n >> Contohnya : /login <code>email=emailagan@email.com password=rahasia</code>`
  banner += `\n\nOpsi <code>/otp</code> di gunakan apabila ketika Login memerlukan verifikasi OTP dalam authentikasi akun`
  banner += `\n >> Contohnya : /otp <code>123456</code>`
  banner += `\n\n==== CATATAN TAMBAHAN ====`
  banner += `\n\nPada opsi <code>/beli</code> Transaksi Bank Cek Otomasis akan terdefault pada Bank BNI agan bisa merubah nya dengan menuliskan opsi transfer ketika menggunakan opsi beli`
  banner += `\n\List Opsi Pembayaran : `
  banner += `\n # Bank BCA <code>transfer=bca</code>`
  banner += `\n # Bank Mandiri <code>transfer=mandiri</code>`
  banner += `\n # Bank BNI <code>transfer=bni</code>`
  banner += `\n # Bank BRI <code>transfer=bri</code>`
  banner += `\n # Bank BSI <code>transfer=bsi</code>`
  banner += `\n # Bank Permata <code>transfer=permata</code>`
  banner += `\n >> Contohnya : /beli <code>transfer=mandiri url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`
  banner += `\n\nUntuk memilih Opsi Pembayaran lainnya lewat COD atau ShopeePay agan bisa beri perintah seperti contoh berikut : `
  banner += `\n # COD : /beli <code>-cod url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`
  banner += `\n # ShopeePay : /beli <code>-shopeepay url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`
  banner += `\n\n<b>"SEMUA PERINTAH DI ATAS BOLEH DI INPUT TIDAK BERURUTAN ASALKAN DENGAN SYNTAX YANG BENAR"</b>`
  banner += `\n\n<i>Contact Person : ngufeel@gmail.com | +6282386007722</i>`
  banner += `\n<i>BOT Created by: @edosulai</i>`
  return ctx.reply(banner, { parse_mode: 'HTML' });
})

bot.help(async (ctx) => {
  let commands = ctx.message.text.split('/help ')
  if (commands.length < 2) return ctx.reply(`/help <code>...message...</code>`, { parse_mode: 'HTML' })
  return sendReportToDev(ctx, commands[1].replace(/(<([^>]+)>)/gi, ""), 'Help');
})

bot.command('quit', (ctx) => ctx.telegram.leaveChat(ctx.message.chat.id).then().catch((err) => sendReportToDev(ctx, `Meninggalkan BOT`, 'Info')))

bot.command('announce', (ctx) => {
  if (!ensureRole(ctx)) return
  let commands = ctx.message.text.split('/announce ')
  if (commands.length < 2) return ctx.reply(`/announce <code>...message...</code>`, { parse_mode: 'HTML' })
  let msg = commands[1].replace(/(<([^>]+)>)/gi, "")
  return User.find(async function (err, users) {
    if (err) return sendReportToDev(ctx, err)
    for (let user of users) {
      await ctx.reply(`<i>Annouce</i> : ${msg}`, { chat_id: JSON.parse(JSON.stringify(user)).teleChatData.id, parse_mode: 'HTML' })
    }
  })
})

bot.command('speedtest', async (ctx) => {
  if (!ensureRole(ctx)) return
  let commands = getCommands(ctx.message.text, '/speedtest ')
  if (commands == null) return ctx.reply(`/speedtest <code>type=curl limit=1 url=http://example.com/</code>`, { parse_mode: 'HTML' })

  if (typeof commands.url != 'string') return ctx.reply('Syntax Tidak Lengkap')
  if (!isValidURL(commands.url)) return ctx.reply('Format Url Salah')

  let totalRequest = 0;
  let totalWaktu = 0;
  let tunggu = Date.now();

  switch (commands.type) {
    case 'curl':
      while (totalWaktu < (commands.limit * 1000)) {
        let curl = new Curl();
        await curl._setUrl(commands.url)
          .setOpt(curl.libcurl.option.CUSTOMREQUEST, (commands.method || 'GET').toUpperCase())
          .setOpt(curl.libcurl.option.SSL_VERIFYPEER, false)
          ._submit().then(({ statusCode, body, headers, curlInstance, curl }) => {
            curl.close()
            totalWaktu = Date.now() - tunggu;
            totalRequest++;
          }).catch((err) => sendReportToDev(ctx, err));
      }
      return ctx.reply(`Total CURL Dalam ${commands.limit} Detik = ${totalRequest}`)

    case 'fetch':
      while (totalWaktu < (commands.limit * 1000)) {
        await fetch(commands.url, {
          method: (commands.method || 'GET').toUpperCase()
        }).then((result) => {
          totalWaktu = Date.now() - tunggu;
          totalRequest++;
        }).catch((err) => sendReportToDev(ctx, err));
      }
      return ctx.reply(`Total FETCH Dalam ${commands.limit} Detik = ${totalRequest}`)

    case 'terminal':
      (async function syncTerm() {
        try {
          return exec(`curl -X ${(commands.method || 'GET').toUpperCase()} ${commands.url}`, async (err, stdout, stderr) => {
            totalWaktu = Date.now() - tunggu;
            totalRequest++;
            if (totalWaktu < (commands.limit * 1000)) {
              return syncTerm();
            } else {
              return ctx.reply(`Total TERMINAL CURL Dalam ${commands.limit} Detik = ${totalRequest}`)
            }
          });
        } catch (err) {
          sendReportToDev(ctx, err)
        }
      })()
  }
})

bot.command('logs', async (ctx) => {
  if (!ensureRole(ctx)) return
  let user = ctx.session;
  let commands = getCommands(ctx.message.text, '/logs ')
  if (commands == null) return ctx.reply(`/logs <code>opsi=...</code>`, { parse_mode: 'HTML' })

  if (commands['-clear']) {
    return Logs.deleteMany()
      .then((result) => {
        return ctx.reply(`${result.deletedCount} Logs Telah Terhapus`)
      }).catch((err) => sendReportToDev(ctx, err));
  }
})

bot.command('failures', async (ctx) => {
  if (!ensureRole(ctx)) return
  let user = ctx.session;
  let commands = getCommands(ctx.message.text, '/failures ')
  if (commands == null) return ctx.reply(`/failures <code>opsi=...</code>`, { parse_mode: 'HTML' })

  if (commands['-clear']) {
    return Failures.deleteMany()
      .then((result) => {
        return ctx.reply(`${result.deletedCount} Failures Telah Terhapus`)
      }).catch((err) => sendReportToDev(ctx, err));
  }
})

bot.command('user', async (ctx) => {
  if (!ensureRole(ctx)) return
  let commands = getCommands(ctx.message.text, '/user ')

  if (commands == null) {
    return User.find(function (err, users) {
      if (err) return sendReportToDev(ctx, err)
      let alluser = ``
      for (let user of users) {
        let theUser = JSON.parse(JSON.stringify(user)).teleChatData
        alluser += `\n`
        for (const key in theUser) {
          if (Object.hasOwnProperty.call(theUser, key)) {
            alluser += `<code>${key}: ${theUser[key]}, </code>`
          }
        }
      }
      return ctx.reply(alluser, { parse_mode: 'HTML' })
    })
  }

  if (commands.id) {
    let someUser = {}
    for (let command in commands) {
      if (Object.hasOwnProperty.call(commands, command) && !['id'].includes(command) && commands[command]) {
        someUser[command] = commands[command]
      }
    }

    if (objectSize(someUser) > 0) {
      return User.updateOne({
        teleChatId: commands.id
      }, someUser).exec(async (err) => {
        if (err) return sendReportToDev(ctx, err)
        return ctx.reply(`User ${commands.id} Telah Di Update`)
      })
    }

    return User.findOne({ teleChatId: commands.id }, function (err, user) {
      if (err) return sendReportToDev(ctx, err)
      return ctx.reply(`<code>${user}</code>`, { parse_mode: 'HTML' })
    })
  }
})

bot.command('login', async (ctx) => {
  let user = ctx.session;
  let commands = getCommands(ctx.message.text, '/login ')
  if (commands == null) return ctx.reply(`/login <code>email=emailagan@email.com password=rahasia</code>`, { parse_mode: 'HTML' })

  for (let command in commands) {
    command = command.toLowerCase()
    if (Object.hasOwnProperty.call(commands, command) && ['email', 'password'].includes(command) && commands[command]) {
      if (command == 'password') {
        user.userLoginInfo.metaPassword = commands[command];
        let md5pass = crypto.createHash('md5').update(commands[command]).digest('hex');
        commands[command] = crypto.createHash('sha256').update(md5pass).digest('hex');
      }
      user.userLoginInfo[command] = commands[command]
    }
  }

  if (!user.userCookie.csrftoken) user.userCookie.csrftoken = generateString(32)

  if (!checkAccount(ctx)) return

  user.config = {
    otp: function (otp) {
      if (!otp) return 1
      let otpMethod = { wa: 3, sms: 1 }
      if (['sms', 'wa'].includes(otp.toLowerCase())) return otpMethod[otp]
    }(commands.otp) || 1
  }

  await getLogin(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
    curl.close()
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
  }).catch((err) => sendReportToDev(ctx, err));

  return async function _tryLogin(msg) {
    if (msg) await ctx.reply(msg)
    return postLogin(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      curl.close()
      user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])

      switch (JSON.parse(body).error) {
        case 1:
          return _tryLogin('Ada Yang Error.. Sedang Mencoba Kembali..');
        case 2:
          return ctx.reply('Akun dan/atau password Anda salah, silakan coba lagi')
        case 3:
          return ctx.reply('Permintaan OTP kamu telah melewati batas. Silakan coba lagi nanti')
        case 77:
          await postSendOtp(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
            curl.close()
            user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
            ctx.reply('Silahkan Cek SMS / WhatsApp Anda')
          }).catch((err) => sendReportToDev(ctx, err));
          break;

        default:
          await ctx.reply(`Login Berhasil`)
      }

      return User.updateOne({
        teleChatId: ctx.message.chat.id
      }, {
        userLoginInfo: user.userLoginInfo,
        userCookie: user.userCookie
      }).exec(async (err, res) => {
        if (err) return ctx.reply(`User Gagal Di Update`).then(() => sendReportToDev(ctx, 'User Gagal Di Update')).catch((err) => sendReportToDev(ctx, err));
      })

    }).catch((err) => sendReportToDev(ctx, err));
  }()
})

bot.command('otp', async (ctx) => {
  let user = ctx.session;
  let commands = ctx.message.text.split('/otp ')
  if (commands.length < 2) return ctx.reply(`/otp <code>...message...</code>`, { parse_mode: 'HTML' })

  if (!checkAccount(ctx)) return
  return postVerifyOtp(user, commands[1]).then(({ statusCode, body, headers, curlInstance, curl }) => {
    curl.close()
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    switch (JSON.parse(body).error) {
      case 1:
        return ctx.reply('Gagal Verify OTP Login Shopee')

      default:
        return User.updateOne({
          teleChatId: ctx.message.chat.id
        }, {
          userLoginInfo: user.userLoginInfo,
          userCookie: user.userCookie
        }).exec(function () {
          return ctx.reply(`Verify OTP dan Login Berhasil..`)
        })
    }
  }).catch((err) => sendReportToDev(ctx, err));
})

bot.command('stop', async (ctx) => {
  let commands = getCommands(ctx.message.text, '/stop ')
  if (commands == null) return ctx.reply(`/stop <code>url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`, { parse_mode: 'HTML' })

  if (!checkAccount(ctx) || !isValidURL(commands.url)) return ctx.reply('Format Url Salah')
  if (psl.get(extractRootDomain(commands.url)) != 'shopee.co.id') return ctx.reply('Bukan Url Dari Shopee')
  return ctx.reply(dropQueue(`${getSessionKey(ctx)}:${parseInt(commands.url.split(".")[commands.url.split(".").length - 1])}`)), { parse_mode: 'HTML' };
})

bot.command('beli', async (ctx) => {
  let user = ctx.session
  let commands = getCommands(ctx.message.text, '/beli ')
  if (commands == null) return ctx.reply(`/beli <code>url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`, { parse_mode: 'HTML' })

  await ctx.reply(`Prepare... <code>${commands.url}</code>`, { parse_mode: 'HTML' }).then((replyCtx) => {
    user.config = {
      message: {
        chatId: replyCtx.chat.id,
        msgId: replyCtx.message_id,
        inlineMsgId: replyCtx.inline_message_id,
        text: replyCtx.text
      }
    }
  })

  if (!checkAccount(ctx) || !isValidURL(commands.url)) return replaceMessage(ctx, user.config.message, 'Format Url Salah / Anda Belum Login')
  if (psl.get(extractRootDomain(commands.url)) != 'shopee.co.id') return replaceMessage(ctx, user.config.message, 'Bukan Url Dari Shopee')
  if (commands['-cod'] && commands['-shopeepay']) return replaceMessage(ctx, user.config.message, 'Silahkan Pilih Hanya Salah Satu Metode Pembayaran')

  for (let queue of queuePromotion) {
    if (queue.split(':')[0] == getSessionKey(ctx) && !ensureRole(ctx, true)) return replaceMessage(ctx, user.config.message, 'Hanya Bisa Mendaftarkan 1 Produk Dalam Antrian!!')
  }

  user.others = (await Others.find())[0]

  user.config = {
    ...user.config, ...{
      itemid: parseInt(commands.url.split(".")[commands.url.split(".").length - 1]),
      shopid: parseInt(commands.url.split(".")[commands.url.split(".").length - 2]),
      quantity: parseInt(commands.qty) || 1,
      url: commands.url,
      payment: {
        cod: commands['-cod'] || false,
        shopeePay: commands['-shopeepay'] || false,
        transferBank: function (tansferPrioritys) {
          if (tansferPrioritys.includes(commands.transfer)) {
            tansferPrioritys.sort(function (index, transfer) {
              return index == commands.transfer ? -1 : transfer == commands.transfer ? 1 : 0;
            });
            return tansferPrioritys;
          } else {
            return tansferPrioritys
          }
        }(['bni', 'bri', 'bca', 'mandiri', 'bsi', 'permata'])
      },
      skiptimer: commands['-skiptimer'] || false,
      autocancel: commands['-autocancel'] || false,
      cache: commands['-cache'] ? ensureRole(ctx, false, ['admin', 'vip', 'premium']) : false,
      repeat: commands['-repeat'] ? ensureRole(ctx, false, ['admin', 'vip', 'premium']) : false,
      predictPrice: commands.price ? parseInt(commands.price) * 100000 : false,
      fail: 0,
      outstock: false,
      info: []
    }
  }

  if (
    !Number.isInteger(user.config.itemid) ||
    !Number.isInteger(user.config.shopid)
  ) return replaceMessage(ctx, user.config.message, 'Identitas Barang Tidak Terbaca, Harap Coba Kembali')

  if (user.config.cache) {
    await Logs.findOne({
      teleChatId: ctx.message.chat.id,
      itemid: parseInt(commands.url.split(".")[commands.url.split(".").length - 1]),
    }, async function (err, logs) {
      if (err || !logs) return ensureRole(ctx, true) ? replaceMessage(ctx, user.config.message, 'Cache Untuk Produk Ini Tidak Tersedia!!') : null
      logs = JSON.parse(JSON.stringify(logs))
      for (const key in logs) {
        if (Object.hasOwnProperty.call(logs, key) && typeof logs[key] == 'object') user[key] = logs[key]
      }
    })
  }

  user.payment = user.payment || require('./helpers/paymentMethod')(user.config.payment, user.others.metaPayment.channels)
  await ctx.reply(`Metode Pembayaran Saat Ini : ${user.payment.msg}`, { parse_mode: 'HTML' }).then((replyCtx) => {
    user.config.paymentMsg = {
      chatId: replyCtx.chat.id,
      msgId: replyCtx.message_id,
      inlineMsgId: replyCtx.inline_message_id,
      text: replyCtx.text
    }
  })

  return getAddress(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    curl.close()
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    user.address = JSON.parse(body);
    if (user.address.error) return replaceMessage(ctx, user.config.message, 'Sesi Anda Sudah Habis Silahkan Login Kembali')
    user.address = function (addresses) {
      for (const address of addresses) {
        return address
      }
    }(user.address.addresses)

    queuePromotion.push(`${getSessionKey(ctx)}:${user.config.itemid}`)
    if (user.config.cache) user.config.firstCache = true

    do {
      user.config.start = Date.now()

      if (!queuePromotion.includes(`${getSessionKey(ctx)}:${user.config.itemid}`)) {
        return replaceMessage(ctx, user.config.message, `Timer Untuk Barang ${user.infoBarang ? user.infoBarang.item.name.replace(/<[^>]*>?/gm, "") : ''} Sudah Di Matikan`)
      }

      await getInfoBarang(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
        curl.close();
        user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
        let chunk = JSON.parse(body);
        if (chunk.error != null) {
          user.config.start = false
        } else {
          user.infoBarang = chunk;
        }
      }).catch((err) => userLogs(ctx, err, 'Error', () => user.config.start = false));

      if (!user.infoBarang || !user.config.start) continue;
      if (!user.infoBarang.item.upcoming_flash_sale) break;

      user.config.modelid = parseInt(user.infoBarang.item.upcoming_flash_sale.modelids[0])
      user.config.promotionid = parseInt(user.infoBarang.item.upcoming_flash_sale.promotionid)
      user.config.end = user.infoBarang.item.upcoming_flash_sale.start_time * 1000

      if ((user.config.end) < Date.now() + 10000) break;

      let msg = ``
      msg += timeConverter(Date.now() - user.config.end, { countdown: true })
      msg += ` - ${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")}`

      if (user.infoBarang.item.stock < 1) {
        user.config.outstock = true
        msg += ` - Barang Sudah Di Ikat Untuk Flash Sale${function (barang) {
          for (const model of barang.item.models) {
            for (const stock of model.price_stocks) {
              if (stock.stockout_time) return ` Sejak : ${timeConverter(stock.stockout_time * 1000, { usemilis: false })}`
            }
          }
        }(user.infoBarang)}`
      } else if (user.config.outstock || user.config.firstCache) {
        let info = await getCart(ctx, true)
        if (typeof msg == 'string') {
          msg += ` - ${info}`
          user.config.outstock = false
          if (user.config.firstCache) user.config.firstCache = false
        }
      }

      await replaceMessage(ctx, user.config.message, msg)

      sleep(ensureRole(ctx, true) ? 200 : (200 * queuePromotion.length) - (Date.now() - user.config.start))

    } while (!user.config.skiptimer)

    await getInfoPengiriman(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
      curl.close()
      user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
      user.infoPengiriman = JSON.parse(body);
    }).catch((err) => sendReportToDev(ctx, err));

    user.config = {
      ...user.config,
      ...function (barang) {
        if (user.config.modelid && user.config.promotionid) return
        for (const model of barang.item.models) {
          if (model.stock < 1 || model.price_stocks.length < 1) continue
          for (const stock of model.price_stocks) {
            if (barang.item.flash_sale ? barang.item.flash_sale.promotionid == stock.promotion_id : false) {
              return {
                modelid: stock.model_id,
                promotionid: stock.promotion_id
              }
            }
          }
        }

        for (const model of barang.item.models) {
          if (model.stock < 1 || model.price_stocks.length < 1) continue
          for (const stock of model.price_stocks) {
            return {
              modelid: stock.model_id,
              promotionid: stock.promotion_id
            }
          }
        }

        for (const model of barang.item.models) {
          if (model.stock < 1) continue
          return {
            modelid: model.modelid,
            promotionid: model.promotionid
          }
        }
      }(user.infoBarang)
    }

    if (!user.config.modelid) return replaceMessage(ctx, user.config.message, `Semua Stok Barang Sudah Habis\n\n${dropQueue(`${getSessionKey(ctx)}:${user.config.itemid}`, user)}`)
    if (!user.config.promotionid) return replaceMessage(ctx, user.config.message, `Info Promosi Tidak Terbaca\n\n${dropQueue(`${getSessionKey(ctx)}:${user.config.itemid}`, user)}`)

    if (user.config.cache && user.infoBarang.item.stock > 0) {
      let info = await getCart(ctx, true)
      if (typeof info == 'string') replaceMessage(ctx, user.config.message, info)
    }

    if (!user.payment) {
      return replaceMessage(ctx, user.config.message, `Semua Metode Pembayaran Untuk Item ${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")} Tidak Tersedia\n\n${dropQueue(`${getSessionKey(ctx)}:${user.config.itemid}`, user)}`)
    }

    if (!queuePromotion.includes(`${getSessionKey(ctx)}:${user.config.itemid}`)) {
      return replaceMessage(ctx, user.config.message, `Timer Untuk Barang ${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")} Sudah Di Matikan`)
    }

    while (
      (user.config.end - Date.now() >= 0) ||
      function (now) {
        return (now - (Math.floor(now / 1000) * 1000)) > 100 ? true : false
      }(Date.now())
    ) continue;

    let info = await getCart(ctx)
    dropQueue(`${getSessionKey(ctx)}:${user.config.itemid}`, user)
    if (typeof info == 'string') {
      if (!ensureRole(ctx, true)) sendReportToDev(ctx, info, 'Success')
      return replaceMessage(ctx, user.config.message, info, false)
    } else {
      await Failures.updateOne({
        teleChatId: ctx.message.chat.id,
        itemid: user.config.itemid,
        shopid: user.config.shopid,
        modelid: user.config.modelid
      }, {
        postBuyBody: user.postBuyBody,
        infoBarang: user.infoBarang,
        infoPengiriman: user.infoPengiriman,
        infoKeranjang: user.infoKeranjang,
        updateKeranjang: user.updateKeranjang,
        infoCheckoutQuick: user.infoCheckoutQuick,
        infoCheckoutLong: user.infoCheckoutLong
      }, { upsert: true }).exec()
    }
  }).catch((err) => sendReportToDev(ctx, err));
})

const getCart = async function (ctx, getCache = false) {
  let user = ctx.session;
  user.config.start = Date.now();
  user.config.timestamp = Date.now();

  await postKeranjang(user, getCache).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    user.keranjang = JSON.parse(body)
    user.keranjang.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
    curl.close()
  }).catch((err) => !getCache ? sleep(Math.round(user.keranjang.time / 3)) : sendReportToDev(ctx, err));
  if (user.keranjang.error != 0) return `Gagal Mendapatkan Keranjang Belanja`

  await postInfoKeranjang(user, getCache).then(({ statusCode, body, headers, curlInstance, curl }) => {
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    let chunk = JSON.parse(body);
    if (chunk.data.shop_orders.length > 0) {
      user.infoKeranjang = chunk
      user.infoKeranjang.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
    }
    curl.close()
  }).catch((err) => !getCache ? sleep(1) : sendReportToDev(ctx, err));

  user.selectedShop = function (shops) {
    for (const shop of shops) {
      if (shop.shop.shopid == user.config.shopid) return shop
    }
  }(user.infoKeranjang.data.shop_orders) || user.selectedShop

  user.selectedItem = function (items) {
    for (const item of items) {
      if (item.modelid == user.config.modelid) return item
    }
  }(user.selectedShop.items) || user.selectedItem

  user.config.price = user.config.predictPrice || function (item) {
    if (item.models) {
      for (const model of item.models) {
        if (
          model.itemid == user.config.itemid &&
          model.shop_id == user.config.shopid &&
          model.modelid == user.config.modelid &&
          model.promotionid == user.config.promotionid
        ) return model.price
      }
    }
    return item.origin_cart_item_price
  }(user.selectedItem) || user.config.price

  postUpdateKeranjang(user, 4).then(({ statusCode, body, headers, curlInstance, curl }) => {
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    let chunk = JSON.parse(body);
    if (chunk.data && chunk.error == 0) {
      user.updateKeranjang = chunk
      user.updateKeranjang.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
    }
    curl.close()
  }).catch((err) => sendReportToDev(ctx, err))

  return getCheckout(ctx, getCache);
}

const getCheckout = async function (ctx, getCache) {
  let user = ctx.session;

  postInfoCheckout(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    let chunk = JSON.parse(body);
    if (chunk.shoporders) {
      user.config.infoCheckoutLong = chunk
      user.config.infoCheckoutLong.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
    }
    curl.close()
  }).catch((err) => sendReportToDev(ctx, err));

  await postInfoCheckoutQuick(user, getCache).then(({ statusCode, body, headers, curlInstance, curl }) => {
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    let chunk = JSON.parse(body);
    if (chunk.shoporders) {
      user.infoCheckoutQuick = chunk
      user.infoCheckoutQuick.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
    }
    curl.close()
  }).catch((err) => !getCache ? sleep(1) : sendReportToDev(ctx, err));
  if (!user.infoCheckoutQuick || user.infoCheckoutQuick.error != null) return `Gagal Mendapatkan Info Checkout Belanja : ${user.infoCheckoutQuick.error}`

  return getCache ? waitUntil(user.config, 'infoCheckoutLong', function (resolve, reject) {
    return waitUntil(user, 'updateKeranjang').then(() => resolve()).catch((err) => reject(err));
  }).then(async () => {
    user.infoCheckoutLong = user.config.infoCheckoutLong
    delete user.config.infoCheckoutLong

    await postUpdateKeranjang(user, 2).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      curl.close()
      user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    }).catch((err) => sendReportToDev(ctx, err));

    user.payment = require('./helpers/paymentMethod')(user.config.payment, user.infoCheckoutLong.payment_channel_info.channels, true)
    await replaceMessage(ctx, user.config.paymentMsg, user.payment ? `Metode Pembayaran Berubah Ke : ${user.payment.msg} Karena Suatu Alasan` : `Semua Metode Pembayaran Untuk Item ${user.selectedItem.name.replace(/<[^>]*>?/gm, "")} Tidak Tersedia`)

    await Logs.updateOne({
      teleChatId: ctx.message.chat.id,
      itemid: user.config.itemid,
      shopid: user.config.shopid,
      modelid: user.config.modelid
    }, {
      infoKeranjang: user.infoKeranjang,
      updateKeranjang: user.updateKeranjang,
      infoCheckoutQuick: user.infoCheckoutQuick,
      infoCheckoutLong: user.infoCheckoutLong,
      payment: user.payment,
      selectedShop: user.selectedShop,
      selectedItem: user.selectedItem
    }, { upsert: true }).exec()

    return `${ensureRole(ctx, true) ? `Cache Produk ${user.selectedItem.name.replace(/<[^>]*>?/gm, "")} Telah Di Dapatkan` : null}`
  }).catch(async (err) => {
    return sendReportToDev(ctx, err, 'Error', () => {
      return postUpdateKeranjang(user, 2).then(({ statusCode, body, headers, curlInstance, curl }) => {
        curl.close()
        user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
      }).catch((err) => sendReportToDev(ctx, err));
    })
  }) : !user.config.repeat ? buyItem(ctx) : buyRepeat(ctx);
}

const buyItem = function (ctx) {
  let user = ctx.session;

  return postBuy(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    user.order = JSON.parse(body)
    user.order.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
    curl.close()

    let info = `Detail Informasi : `

    if (ensureRole(ctx, true)) {
      info += `${user.keranjang ? `\nPostKeranjang : ${user.keranjang.time} ms..` : ''}`
      info += `${user.infoKeranjang ? `\nPostInfoKeranjang : ${user.infoKeranjang.time} ms..` : ''}`
      info += `${user.updateKeranjang ? `\nPostUpdateKeranjang : ${user.updateKeranjang.time} ms..` : ''}`
      info += `${user.infoCheckoutQuick ? `\nPostInfoCheckoutQuick : ${user.infoCheckoutQuick.time} ms..` : ''}`
      info += `${user.infoCheckoutLong ? `\nPostInfoCheckoutLong : ${user.infoCheckoutLong.time} ms..` : ''}`
      info += `${user.order ? `\nPostBuy : ${user.order.time} ms..` : ''}`
    }

    info += `\n\nBot Start : <b>${timeConverter(user.config.start, { usemilis: true })}</b>`
    info += `\nCheckout : <b>${timeConverter(user.config.checkout, { usemilis: true })}</b>`
    info += `\nBot End : <b>${timeConverter(Date.now(), { usemilis: true })}</b>`

    if (user.order.error) {
      user.config.fail = user.config.fail + 1
      info += `\n\n<i>Gagal Melakukan Payment Barang <b>(${user.selectedItem.name.replace(/<[^>]*>?/gm, "")})</b>\n${user.order.error_msg}</i>\n${ensureRole(ctx, true) ? user.order.error : ''}`

      if (user.config.fail < 3 && ['error_empty_cart', 'error_fulfillment_info_changed_mwh', 'error_payable_mismatch'].includes(user.order.error)) {
        user.config.info.push(info)
        return buyItem(ctx)
      }

      if (user.order.error != 'error_opc_channel_not_available') {

        await Failures.updateOne({
          teleChatId: ctx.message.chat.id,
          itemid: user.config.itemid,
          shopid: user.config.shopid,
          modelid: user.config.modelid
        }, {
          postBuyBody: user.postBuyBody,
          postBuyBodyLong: user.postBuyBodyLong,
          infoBarang: user.infoBarang,
          infoPengiriman: user.infoPengiriman,
          infoKeranjang: user.infoKeranjang,
          updateKeranjang: user.updateKeranjang,
          infoCheckoutQuick: user.infoCheckoutQuick,
          infoCheckoutLong: user.infoCheckoutLong
        }, { upsert: true }).exec()

      }

      await postUpdateKeranjang(user, 2).then(({ statusCode, body, headers, curlInstance, curl }) => {
        curl.close()
        user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
        info += `\n\nBarang <b>(${user.selectedItem.name.replace(/<[^>]*>?/gm, "")})</b> Telah Telah Di Hapus Dari Keranjang`
      }).catch((err) => sendReportToDev(ctx, err));

    } else {
      user.config.fail = 0
      info += `\n\n<i>Barang <b>(${user.selectedItem.name.replace(/<[^>]*>?/gm, "")})</b> Berhasil Di Pesan</i>`

      await Logs.updateOne({
        teleChatId: ctx.message.chat.id,
        itemid: user.config.itemid,
        shopid: user.config.shopid,
        modelid: user.config.modelid
      }, {
        infoKeranjang: user.infoKeranjang,
        updateKeranjang: user.updateKeranjang,
        infoCheckoutQuick: user.infoCheckoutQuick,
        infoCheckoutLong: user.infoCheckoutLong,
        payment: user.payment,
        selectedShop: user.selectedShop,
        selectedItem: user.selectedItem
      }, { upsert: true }).exec()

      if (user.config.autocancel) {
        await postCancel(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
          curl.close()
          user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
          info += `\n\nAuto Cancel Barang (${user.selectedItem.name}) Berhasil`
        }).catch((err) => sendReportToDev(ctx, err));
      }
    }

    await User.updateOne({ teleChatId: ctx.message.chat.id }, { userCookie: user.userCookie }).exec()
    info += `\n\n============================================= `
    user.config.info.push(info)
    return user.config.info.join('\n\n')
  }).catch((err) => sendReportToDev(ctx, err));
}

const buyRepeat = async function (ctx) {
  let user = ctx.session;

  do {
    await postBuy(user, user.config.repeat).then().catch((err) => sleep(1));
  } while (Date.now() - user.config.start < 1500);

  sleep(500);

  if (user.payment.method.payment_channelid) {

    return getOrders(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      curl.close()
      user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
      if (!body) return sendReportToDev(ctx, 'Body buyRepeat Kosong', 'Error')

      let info = `Detail Informasi : `

      if (ensureRole(ctx, true)) {
        info += `${user.keranjang ? `\nPostKeranjang : ${user.keranjang.time} ms..` : ''}`
        info += `${user.infoKeranjang ? `\nPostInfoKeranjang : ${user.infoKeranjang.time} ms..` : ''}`
        info += `${user.updateKeranjang ? `\nPostUpdateKeranjang : ${user.updateKeranjang.time} ms..` : ''}`
        info += `${user.infoCheckoutQuick ? `\nPostInfoCheckoutQuick : ${user.infoCheckoutQuick.time} ms..` : ''}`
        info += `${user.infoCheckoutLong ? `\nPostInfoCheckoutLong : ${user.infoCheckoutLong.time} ms..` : ''}`
        info += `${user.order ? `\nPostBuy : ${user.order.time} ms..` : ''}`
        info += `\n\nBot Start : <b>${timeConverter(user.config.start, { usemilis: true })}</b>`
      }

      info += `\nCheckout : <b>${timeConverter(user.config.checkout, { usemilis: true })}</b>`
      info += `\nBot End : <b>${timeConverter(Date.now(), { usemilis: true })}</b>`

      for (const orders of JSON.parse(body).orders) {
        if (
          Math.floor(user.config.end / 1000) - orders.mtime < 5 &&
          orders.extinfo.first_itemid == user.config.itemid &&
          orders.extinfo.modelid == user.config.modelid &&
          orders.shopid == user.config.shopid
        ) {
          user.order = orders;
          info += `\n\n<i>Barang <b>(${user.selectedItem.name.replace(/<[^>]*>?/gm, "")})</b> Berhasil Di Pesan</i>`
          if (user.config.autocancel) {
            await postCancel(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
              curl.close()
              user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
              info += `\n\nAuto Cancel Barang (${user.selectedItem.name}) Berhasil`
            }).catch((err) => sendReportToDev(ctx, err));
          }
        }
      }

      if (!user.order) return buyItem(ctx)

      await Logs.updateOne({
        teleChatId: ctx.message.chat.id,
        itemid: user.config.itemid,
        shopid: user.config.shopid,
        modelid: user.config.modelid
      }, {
        infoKeranjang: user.infoKeranjang,
        updateKeranjang: user.updateKeranjang,
        infoCheckoutQuick: user.infoCheckoutQuick,
        infoCheckoutLong: user.infoCheckoutLong,
        payment: user.payment,
        selectedShop: user.selectedShop,
        selectedItem: user.selectedItem
      }, { upsert: true }).exec()

      await User.updateOne({ teleChatId: ctx.message.chat.id }, { userCookie: user.userCookie }).exec()

      info += `\n\n============================================= `
      user.config.info.push(info)
      return user.config.info.join('\n\n')
    }).catch((err) => sendReportToDev(ctx, err));

  } else {

    return getCheckouts(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      curl.close()
      user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
      if (!body) return sendReportToDev(ctx, 'Body buyRepeat Kosong', 'Error')

      let info = `Detail Informasi : `

      if (ensureRole(ctx, true)) {
        info += `${user.keranjang ? `\nPostKeranjang : ${user.keranjang.time} ms..` : ''}`
        info += `${user.infoKeranjang ? `\nPostInfoKeranjang : ${user.infoKeranjang.time} ms..` : ''}`
        info += `${user.updateKeranjang ? `\nPostUpdateKeranjang : ${user.updateKeranjang.time} ms..` : ''}`
        info += `${user.infoCheckoutQuick ? `\nPostInfoCheckoutQuick : ${user.infoCheckoutQuick.time} ms..` : ''}`
        info += `${user.infoCheckoutLong ? `\nPostInfoCheckoutLong : ${user.infoCheckoutLong.time} ms..` : ''}`
        info += `${user.order ? `\nPostBuy : ${user.order.time} ms..` : ''}`
        info += `\n\nBot Start : <b>${timeConverter(user.config.start, { usemilis: true })}</b>`
      }

      info += `\nCheckout : <b>${timeConverter(user.config.checkout, { usemilis: true })}</b>`
      info += `\nBot End : <b>${timeConverter(Date.now(), { usemilis: true })}</b>`

      for (const checkouts of JSON.parse(body).checkouts) {
        for (const orders of checkouts.orders) {
          if (
            Math.floor(user.config.end / 1000) - orders.mtime < 5 &&
            orders.extinfo.first_itemid == user.config.itemid &&
            orders.extinfo.modelid == user.config.modelid &&
            orders.shopid == user.config.shopid
          ) {
            user.order = orders;
            info += `\n\n<i>Barang <b>(${user.selectedItem.name.replace(/<[^>]*>?/gm, "")})</b> Berhasil Di Pesan</i>`
            if (user.config.autocancel) {
              await postCancel(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
                curl.close()
                user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
                info += `\n\nAuto Cancel Barang (${user.selectedItem.name}) Berhasil`
              }).catch((err) => sendReportToDev(ctx, err));
            }
          }
        }
      }

      if (!user.order) return buyItem(ctx)

      await Logs.updateOne({
        teleChatId: ctx.message.chat.id,
        itemid: user.config.itemid,
        shopid: user.config.shopid,
        modelid: user.config.modelid
      }, {
        infoKeranjang: user.infoKeranjang,
        updateKeranjang: user.updateKeranjang,
        infoCheckoutQuick: user.infoCheckoutQuick,
        infoCheckoutLong: user.infoCheckoutLong,
        payment: user.payment,
        selectedShop: user.selectedShop,
        selectedItem: user.selectedItem
      }, { upsert: true }).exec()

      await User.updateOne({ teleChatId: ctx.message.chat.id }, { userCookie: user.userCookie }).exec()

      info += `\n\n============================================= `
      user.config.info.push(info)
      return user.config.info.join('\n\n')
    }).catch((err) => sendReportToDev(ctx, err));

  }
}

const dropQueue = function (queue, user = {}) {
  for (let i = 0; i < queuePromotion.length; i++) {
    if (queuePromotion[i].match(queue)) {
      queuePromotion.splice(i)
      return `Barang ${user.infoBarang ? user.infoBarang.item.name.replace(/<[^>]*>?/gm, "") : ''} Telah Di Hapus Dari Queue`;
    }
  }
  return `Queue Barang ${user.infoBarang ? user.infoBarang.item.name.replace(/<[^>]*>?/gm, "") : ''} Tidak Ditemukan`;
}

bot.command('xplay', async (ctx) => {
  if (!ensureRole(ctx)) return
  if (!fs.existsSync('./temp')) fs.mkdirSync('./temp')
  let user = ctx.session;
  let commands = getCommands(ctx.message.text, '/xplay ')
  if (commands == null) return ctx.reply(`/xplay <code>url=http://...69fck.onion</code>`, { parse_mode: 'HTML' })

  await ctx.reply(`Prepare... <code>${commands.url}</code>`, { parse_mode: 'HTML' }).then((replyCtx) => {
    user.message = {
      chatId: replyCtx.chat.id,
      msgId: replyCtx.message_id,
      inlineMsgId: replyCtx.inline_message_id,
      text: replyCtx.text
    }
  })

  return tr.request({
    url: commands.url,
    headers: {
      'connection': 'keep-alive',
      'pragma': 'no-cache',
      'cache-control': 'no-cache',
      'DNT': '1',
      'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'cookie': process.env.XPLAY_COOKIE
    }
  }, async function (err, response, body) {
    let document = parse(body)
    let videoTitle = document.querySelector('title').childNodes[0].rawText
    let videoName = document.querySelector('source').rawAttrs.split('src="')[1].split('" ')[0].split('/')

    if (fs.existsSync(`./temp/${videoName[videoName.length - 1]}`)) {
      return replaceMessage(ctx, user.message, `File Sudah Video ${videoTitle} ${videoName[videoName.length - 1]} <code>${commands.url}</code> Sudah Ada`, false)
    } else {
      await replaceMessage(ctx, user.message, `Sedang Mendownload Video ${videoTitle} ${videoName[videoName.length - 1]} <code>${commands.url}</code>`, false)
      return tr.request({
        url: `${process.env.XPLAY_DOMAIN}/hwdvideos/uploads/${videoName[videoName.length - 2]}/${videoName[videoName.length - 1]}`,
        headers: {
          'connection': 'keep-alive',
          'DNT': '1',
          'range': 'bytes=0-',
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
          'accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
          'accept-language': 'en-US,en;q=0.5'
        },
        strictSSL: true,
        agentOptions: {
          socksHost: '127.0.0.1',
          socksPort: 9050,
        }
      }, function (err, response, body) {
        return replaceMessage(ctx, user.message, `Video ${videoTitle} ${videoName[videoName.length - 1]} <code>${commands.url}</code> Terdownload`, false)
      }).pipe(fs.createWriteStream(`./temp/${videoName[videoName.length - 1]}`))
    }
  })
})

bot.command('env', async (ctx) => {
  if (!ensureRole(ctx)) return
  let commands = getCommands(ctx.message.text, '/env ')
  if (commands == null) {
    return ctx.reply(`<code>${JSON.stringify(dotenv.parse(Buffer.from(fs.readFileSync('./.env'))), null, "\t")}</code>`, { parse_mode: 'HTML' })
  }
})

bot.command('restart', async (ctx) => {
  if (!ensureRole(ctx)) return
  process.exit(1);
})

bot.command((ctx) => {
  let msg = ctx.message.text
  let userID = msg.match(/[^\s]+/g)[0].substring(1)
  if (!Number.isInteger(userID)) return
  User.findOne({ teleChatId: userID }, function (err, user) {
    if (err || !user) return
    let commands = msg.split(`${user.teleChatId} `)
    if (commands.length < 2) return ctx.reply(`/(user_id) <code>...message...</code>`, { parse_mode: 'HTML' })
    commands[1] = commands[1].replace(/(<([^>]+)>)/gi, "");
    return ctx.reply(`<code>${`@${ctx.message.chat.username}` || ctx.message.chat.first_name} : ${commands[1]}</code>`, { chat_id: user.teleChatId, parse_mode: 'HTML' })
  })
})

bot.catch((err, ctx) => sendReportToDev(ctx, err))

bot.launch()