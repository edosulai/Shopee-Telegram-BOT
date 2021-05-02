Object.size = function (obj) {
  var size = 0,
    key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) size++;
  }
  return size;
}

require('dotenv').config()
const packageJson = require('./package.json'),
  { Telegraf, session } = require('telegraf'),
  mongoose = require('mongoose'),
  fs = require('fs'),
  path = require('path'),
  cookie = require('cookie'),
  { exec } = require('child_process'),
  fetch = require('node-fetch'),
  crypto = require('crypto'),
  findOrCreate = require('mongoose-findorcreate'),
  psl = require('psl'),

  Curl = require('./helpers/curl'),
  waitUntil = require('./helpers/waitUntil'),

  getLogin = require('./request/auth/getLogin'),
  getLogout = require('./request/auth/getLogout'),
  postLogin = require('./request/auth/postlogin'),
  postSendOtp = require('./request/auth/postSendOtp'),
  postVerifyOtp = require('./request/auth/postVerifyOtp'),

  getInfoBarang = require('./request/buy/getInfoBarang'),
  postKeranjang = require('./request/buy/postKeranjang'),
  postUpdateKeranjang = require('./request/buy/postUpdateKeranjang'),
  postInfoKeranjang = require('./request/buy/postInfoKeranjang'),
  postCheckout = require('./request/buy/postCheckout'),
  postInfoCheckoutQuick = require('./request/buy/postInfoCheckoutQuick'),
  postInfoCheckout = require('./request/buy/postInfoCheckout'),
  postBuy = require('./request/buy/postBuy'),

  getInfoPengiriman = require('./request/other/getInfoPengiriman'),
  getAddress = require('./request/other/getAddress'),
  getShopVoucher = require('./request/other/getShopVoucher'),
  getCoin = require('./request/other/getCoin'),
  postCancel = require('./request/other/postCancel')

let queuePromotion = []

mongoose.connect('mongodb://localhost:27017/shopbot', { useNewUrlParser: true, useUnifiedTopology: true })
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

const Prohibited = mongoose.model('Prohibited', {
  typeOlShop: String,
  data: Object,
  allowed: Array,
  exception: String,
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
  console.log("Server has Initialized By Nick : " + process.env.BOT_USERNAME)
})

bot.use(session())

bot.use((ctx, next) => {
  return User.findOrCreate({ teleChatId: ctx.message.chat.id }, {
    teleChatData: ctx.message.chat,
    userLoginInfo: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36 Edg/88.0.705.74',
    },
    userCookie: {
      csrftoken: null
    },
    userRole: "member"
  }, async function (err, user, created) {
    if (err) return sendReportToDev(ctx, err)
    if (created) sendReportToDev(ctx, `Akun Baru Terbuat`, 'Info')
    ctx.session = user
    ctx.session.Curl = Curl
    if (process.env.NODE_ENV == 'development' && !isAdmin(ctx)) {
      ctx.reply(`Bot Sedang Maintenance, Silahkan Contact @edosulai`).then(() => sendReportToDev(ctx, `Mencoba Akses BOT`, 'Info'))
      return ctx.telegram.leaveChat(ctx.message.chat.id).then().catch((err) => sendReportToDev(ctx, `Meninggalkan BOT`, 'Info'));
    }
    return next(ctx)
  })
})

bot.start((ctx) => {
  let banner = `${process.env.BOT_NAME} <b>v.${packageJson.version}</b>`
  banner += `\n\n<b>==== LIST OPSI SHOP BOT ====</b>`
  banner += `\n\nOpsi <code>/beli</code> ini lah BOT online shopee nya, Agan akan Diperingatkan Login terlebih dahulu apabila email password dan token Agan masih kosong`
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
  if (!isAdmin(ctx)) return
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
  if (!isAdmin(ctx)) return
  let commands = getCommands(ctx, '/speedtest ')
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
  if (!isAdmin(ctx)) return
  let user = ctx.session;
  let commands = getCommands(ctx, '/logs ')
  if (commands == null) return ctx.reply(`/logs <code>opsi=...</code>`, { parse_mode: 'HTML' })
  switch (commands.opsi) {
    case 'clear':
      return Logs.deleteMany()
        .then((result) => {
          return ctx.reply(`${result.deletedCount} Logs Telah Terhapus`)
        }).catch((err) => sendReportToDev(ctx, err));
  }
})

bot.command('failures', async (ctx) => {
  if (!isAdmin(ctx)) return
  let user = ctx.session;
  let commands = getCommands(ctx, '/failures ')
  if (commands == null) return ctx.reply(`/failures <code>opsi=...</code>`, { parse_mode: 'HTML' })
  switch (commands.opsi) {
    case 'clear':
      return Failures.deleteMany()
        .then((result) => {
          return ctx.reply(`${result.deletedCount} Failures Telah Terhapus`)
        }).catch((err) => sendReportToDev(ctx, err));
  }
})

bot.command('user', async (ctx) => {
  if (!isAdmin(ctx)) return
  let commands = getCommands(ctx, '/user ')

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

    if (Object.size(someUser) > 0) {
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
  let commands = getCommands(ctx, '/login ')
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
  let commands = getCommands(ctx, '/stop ')
  if (commands == null) return ctx.reply(`/stop <code>url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`, { parse_mode: 'HTML' })

  if (!checkAccount(ctx) || !isValidURL(commands.url)) return ctx.reply('Format Url Salah')
  if (psl.get(extractRootDomain(commands.url)) != 'shopee.co.id') return ctx.reply('Bukan Url Dari Shopee')
  return ctx.reply(dropQueue(`${getSessionKey(ctx)}:${parseInt(commands.url.split(".")[commands.url.split(".").length - 1])}`)), { parse_mode: 'HTML' };
})

bot.command('beli', async (ctx) => {
  let user = ctx.session
  let commands = getCommands(ctx, '/beli ')
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
    if (queue.split(':')[0] == getSessionKey(ctx)) return replaceMessage(ctx, user.config.message, 'Hanya Bisa Mendaftarkan 1 Produk Dalam Antrian!!')
  }

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
      makecache: commands['-makecache'] || false,
      usedelay: commands['-usedelay'] || false,
      price: commands['-seribu'] ? 100000000 : false,
      repeat: commands.repeat || 1,
      fail: 0,
      outstock: false,
      info: []
    }
  }

  if (commands['-usecache']) {
    await Logs.findOne({
      teleChatId: ctx.message.chat.id,
      itemid: parseInt(commands.url.split(".")[commands.url.split(".").length - 1]),
    }, async function (err, logs) {
      if (err || !logs) return replaceMessage(ctx, user.config.message, 'Cache Untuk Produk Ini Tidak Tersedia!!')
      logs = JSON.parse(JSON.stringify(logs))
      for (const key in logs) {
        if (Object.hasOwnProperty.call(logs, key) && typeof logs[key] == 'object') user[key] = logs[key]
      }
    })
  }

  if (
    !Number.isInteger(user.config.itemid) ||
    !Number.isInteger(user.config.shopid)
  ) return replaceMessage(ctx, user.config.message, 'Identitas Barang Tidak Terbaca, Harap Coba Kembali')

  user.payment = user.payment || require('./helpers/paymentMethod')(user.config.payment, require('./helpers/metaPayment.json').channels)
  await ctx.reply(`Metode Pembayaran Saat Ini : ${user.payment.msg}`, { parse_mode: 'HTML' }).then((replyCtx) => {
    user.config = {
      ...user.config, paymentMsg: {
        chatId: replyCtx.chat.id,
        msgId: replyCtx.message_id,
        inlineMsgId: replyCtx.inline_message_id,
        text: replyCtx.text
      }
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
    if (user.config.makecache) user.config.firstCache = true

    do {
      if (!queuePromotion.includes(`${getSessionKey(ctx)}:${user.config.itemid}`)) {
        return replaceMessage(ctx, user.config.message, `Timer Untuk Barang ${user.infoBarang ? user.infoBarang.item.name : ''} Sudah Di Matikan`)
      }

      user.config.start = Date.now()

      await getInfoBarang(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
        curl.close();
        user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
        let chunk = JSON.parse(body);
        if (chunk.error != null) {
          user.config.start = false
        } else {
          user.infoBarang = chunk;
        }
      }).catch((err) => sendReportToDev(ctx, err));

      if (
        user.infoBarang.item.upcoming_flash_sale == null &&
        user.infoBarang.item.flash_sale == null
      ) await replaceMessage(ctx, user.config.message, `${user.infoBarang.item.name} Bukan Barang Flash Sale`)

      if (user.infoBarang.item.upcoming_flash_sale && user.config.start) {
        let msg = ``

        user.config = {
          ...user.config, ...{
            modelid: parseInt(function (model) {
              return model[model.length - 1] || model[0]
            }(user.infoBarang.item.upcoming_flash_sale.modelids)),
            promotionid: parseInt(user.infoBarang.item.upcoming_flash_sale.promotionid),
            end: user.infoBarang.item.upcoming_flash_sale.start_time * 1000,
          }
        }

        msg += timeConverter(Date.now() - user.config.end, { countdown: true })
        msg += ` - ${user.infoBarang.item.name}`

        if (
          user.infoBarang.item.stock > 0 &&
          user.config.end > Date.now() + 7000
        ) {

          if (user.config.outstock || user.config.firstCache) {
            let info = await getCart(ctx, true)
            if (typeof msg == 'string') {
              msg += ` - ${info}`
              user.config.outstock = false
              if (user.config.firstCache) user.config.firstCache = false
            }
          }

        } else {
          user.config.outstock = true
          msg += ` - Barang Sudah Di Ikat Untuk Flash Sale${function (barang) {
            for (const model of barang.item.models) {
              for (const stock of model.price_stocks) {
                if (stock.stockout_time) return ` Sejak : ${timeConverter(stock.stockout_time * 1000, { usemilis: false })}`
              }
            }
          }(user.infoBarang)}`
        }

        await replaceMessage(ctx, user.config.message, msg)
      }

      sleep(function (start) {
        start = 100 - (Date.now() - start)
        return start > 0 ? start : 0
      }(user.config.start))

    } while (
      !user.config.skiptimer &&
      user.infoBarang.item.upcoming_flash_sale != null &&
      (user.config.end) > Date.now() + 7000
    )

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
          if (model.stock < 1) return

          if (model.price_stocks.length < 1) {
            return {
              modelid: model.modelid,
              promotionid: model.promotionid
            }
          }

          for (const stock of model.price_stocks) {
            if (!barang.item.flash_sale) {
              return {
                modelid: stock.model_id,
                promotionid: stock.promotion_id
              }
            }

            if (barang.item.flash_sale.promotionid == stock.promotion_id) {
              return {
                modelid: stock.model_id,
                promotionid: stock.promotion_id
              }
            }
          }
        }
      }(user.infoBarang)
    }

    if (!user.config.modelid) return replaceMessage(ctx, user.config.message, `Semua Stok Barang Sudah Habis - ${dropQueue(`${getSessionKey(ctx)}:${user.config.itemid}`, user)}`)
    if (!user.config.promotionid) return replaceMessage(ctx, user.config.message, `Info Promosi Tidak Terbaca - ${dropQueue(`${getSessionKey(ctx)}:${user.config.itemid}`, user)}`)

    if (user.config.makecache && user.infoBarang.item.stock > 0) {
      let info = await getCart(ctx, true)
      if (typeof info == 'string') replaceMessage(ctx, user.config.message, info)
    }

    if (!queuePromotion.includes(`${getSessionKey(ctx)}:${user.config.itemid}`)) {
      return replaceMessage(ctx, user.config.message, `Timer Untuk Barang ${user.infoBarang.item.name} Sudah Di Matikan`)
    }

    while (
      (!user.config.skiptimer && (user.config.end) - Date.now() >= 0) ||
      function (now) {
        return (now - (Math.floor(now / 1000) * 1000)) > 100 ? true : false
      }(Date.now())
    ) continue;

    let info = await getCart(ctx)
    dropQueue(`${getSessionKey(ctx)}:${user.config.itemid}`, user)
    if (typeof info == 'string') {
      if (!isAdmin(ctx)) sendReportToDev(ctx, info, 'Success')
      return replaceMessage(ctx, user.config.message, info, false)
    }
  }).catch((err) => sendReportToDev(ctx, err));
})

const getCart = async function (ctx, getCache = false) {
  let user = ctx.session;
  user.config.start = Date.now();
  user.config.timestamp = Date.now();

  return postKeranjang(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    user.keranjang = JSON.parse(body)
    user.keranjang.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
    curl.close()
    if (user.keranjang.error != 0) return `Gagal Menambahkan Produk Ke Dalam Keranjang Belanja <code>${user.keranjang.error_msg}</code>`

    postInfoKeranjang(user, getCache).then(({ statusCode, body, headers, curlInstance, curl }) => {
      user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
      let chunk = JSON.parse(body);
      if (chunk.data) {
        user.infoKeranjang = chunk
        user.infoKeranjang.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
      }
      curl.close()
    }).catch((err) => sleep(1));

    return waitUntil(user, 'infoKeranjang')
      .then(() => {
        if (user.infoKeranjang.error != 0) return `Gagal Mendapatkan Info Keranjang Belanja <code>${user.infoKeranjang.error_msg}</code>`

        user.selectedShop = function (shops) {
          for (const shop of shops) {
            if (shop.shop.shopid == user.config.shopid) {
              return shop
            }
          }
        }(user.infoKeranjang.data.shop_orders)
        user.selectedItem = function (items) {
          for (const item of items) {
            if (item.modelid == user.config.modelid) {
              return item
            }
          }
        }(user.selectedShop.items)
        user.config.price = user.config.price || function (item) {
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
        }(user.selectedItem)

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
      }).catch((err) => sendReportToDev(ctx, err));
  }).catch((err) => sendReportToDev(ctx, err));
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
  }).catch((err) => sleep(user.config.usedelay ? Math.round(user.infoCheckoutQuick.time / 4) : 1));

  return getCache ? waitUntil(user.config, 'infoCheckoutLong')
    .then(async () => {
      user.infoCheckoutLong = user.config.infoCheckoutLong

      await postUpdateKeranjang(user, 2).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
        curl.close()
        user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
      }).catch((err) => sendReportToDev(ctx, err));

      await waitUntil(user, 'updateKeranjang').then().catch((err) => sendReportToDev(ctx, err));

      fs.writeFileSync('./helpers/metaPayment.json', JSON.stringify(user.infoCheckoutLong.payment_channel_info))
      user.payment = require('./helpers/paymentMethod')(user.config.payment, user.infoCheckoutLong.payment_channel_info.channels, true)
      await replaceMessage(ctx, user.config.paymentMsg, user.payment ? `Metode Pembayaran Berubah Ke : ${user.payment.msg} Karena Suatu Alasan` : `Semua Metode Pembayaran Untuk Item ${user.selectedItem.name} Tidak Tersedia`)

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
        payment: user.payment
      }, { upsert: true }).exec()

      return `${isAdmin(ctx) ? `Cache Produk ${user.selectedItem.name} Telah Di Dapatkan` : null}`
    }).catch(async (err) => {
      await sendReportToDev(ctx, err)
      return postUpdateKeranjang(user, 2).then(({ statusCode, body, headers, curlInstance, curl }) => {
        curl.close()
        user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
      }).catch((err) => sendReportToDev(ctx, err));
    }) : buyItem(ctx)
}

const buyItem = function (ctx) {
  let user = ctx.session;

  return postBuy(user).then(async function ({ statusCode, body, headers, curlInstance, curl }) {
    let info = `Detail Informasi : `
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    user.order = JSON.parse(body)
    user.order.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
    curl.close()

    if (isAdmin(ctx)) {
      info += `${user.keranjang ? `\nPostKeranjang : ${user.keranjang.time} ms..` : ''}`
      info += `${user.infoKeranjang ? `\nPostInfoKeranjang : ${user.infoKeranjang.time} ms..` : ''}`
      info += `${user.updateKeranjang ? `\nPostUpdateKeranjang : ${user.updateKeranjang.time} ms..` : ''}`
      info += `${user.infoCheckoutQuick ? `\nPostInfoCheckoutQuick : ${user.infoCheckoutQuick.time} ms..` : ''}`
      info += `${user.infoCheckoutLong ? `\nPostInfoCheckoutLong : ${user.infoCheckoutLong.time} ms..` : ''}`
      info += `${user.order ? `\nPostBuy : ${user.order.time} ms..` : ''}`
      info += `\n\nBot Start : <b>${timeConverter(user.config.start, { usemilis: true })}</b>`
    }

    info += `\nCheckout : <b>${timeConverter(user.config.end, { usemilis: true })}</b>`
    info += `\nPayment : <b>${timeConverter(Date.now(), { usemilis: true })}</b>`

    if (user.order.error) {
      user.config.fail = user.config.fail + 1
      info += `\n\n<i>Gagal Melakukan Payment Barang <b>(${user.selectedItem.name})</b>\n${user.order.error_msg}</i>\n${isAdmin(ctx) ? user.order.error : ''}`

      if (user.config.fail < 3 && (user.order.error == 'error_fulfillment_info_changed_mwh' || user.order.error == 'error_payable_mismatch')) {
        info += `\n\n<b>Sedang Mencoba Kembali...</b>`
        user.config.info.push(info)
        return buyItem(ctx)
      }

      if (
        user.order.error != 'error_opc_channel_not_available'
      ) {

        if (!user.infoCheckoutLong) {
          await postInfoCheckout(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
            user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
            let chunk = JSON.parse(body);
            if (chunk.shoporders) {
              user.infoCheckoutLong = chunk
              user.infoCheckoutLong.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
              fs.writeFileSync('./helpers/metaPayment.json', JSON.stringify(user.infoCheckoutLong.payment_channel_info))
            }
            curl.close()
          }).catch((err) => sendReportToDev(ctx, err));
        }

        await Failures.updateOne({
          teleChatId: ctx.message.chat.id,
          itemid: user.config.itemid,
          shopid: user.config.shopid,
          modelid: user.config.modelid
        }, {
          postBuyBody: user.postBuyBody,
          postBuyBodyLong: require('./helpers/postBuyBodyLong')(user),
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
        info += `\n\nBarang Di Keranjang Telah Di Hapus`
      }).catch((err) => sendReportToDev(ctx, err));

    } else {
      user.config.fail = 0
      info += `\n\n<i>Barang <b>(${user.selectedItem.name})</b> Berhasil Di Pesan</i>`

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
        payment: user.payment
      }, { upsert: true }).exec()

      if (user.config.autocancel) {
        await postCancel(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
          curl.close()
          user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
          info += `\n\nAuto Cancel Barang (${user.selectedItem.name}) Berhasil`
        }).catch((err) => sendReportToDev(ctx, err));
      }
    }

    info += `\n\n============================================= `

    user.config.info.push(info)
    user.config.repeat--
    if (user.config.repeat > 0 && user.config.fail < 3 && user.order.error != 'error_stock') {
      replaceMessage(ctx, user.config.message, user.config.info.join('\n\n'))
      return getCart(ctx)
    }

    await User.updateOne({ teleChatId: ctx.message.chat.id }, { userCookie: user.userCookie }).exec()
    return user.config.info.join('\n\n')

  }).catch((err) => sendReportToDev(ctx, err));
}

const replaceMessage = async function (ctx, oldMsg, newMsg, filter = true) {
  if (filter) newMsg = newMsg.replace(/(<([^>]+)>)/gi, "");
  if (
    newMsg.localeCompare(oldMsg.text) != 0 &&
    !newMsg.match(oldMsg.text) &&
    oldMsg.text != newMsg &&
    oldMsg.text !== newMsg &&
    oldMsg.text.replace(/[^a-zA-Z]/g, "") != newMsg.replace(/[^a-zA-Z]/g, "")
  ) {
    return await ctx.telegram.editMessageText(oldMsg.chatId, oldMsg.msgId, oldMsg.inlineMsgId, newMsg, { parse_mode: 'HTML' }).then((replyCtx) => {
      oldMsg.text = replyCtx.text
    }).catch((err) => console.log(
      newMsg.localeCompare(oldMsg.text) != 0 &&
      !newMsg.match(oldMsg.text) &&
      oldMsg.text != newMsg &&
      oldMsg.text !== newMsg &&
      oldMsg.text.replace(/[^a-zA-Z]/g, "") != newMsg.replace(/[^a-zA-Z]/g, "")
    ))
  }
}

const sendReportToDev = async function (ctx, msg, type = 'Error') {
  return await ctx.reply(`<code>(${ctx.message.chat.first_name} ${ctx.message.chat.id}) ${msg.stack ? msg.stack : `${type} : ${msg}`}</code>`, { chat_id: process.env.ADMIN_ID, parse_mode: 'HTML' })
}

const setNewCookie = function (oldcookies, ...newcookies) {
  let temp = oldcookies;
  for (const cookies of newcookies) {
    for (const cook of cookies) {
      let parseCookie = cookie.parse(cook);
      let cookieName = Object.keys(parseCookie)[0]
      temp[cookieName] = parseCookie[cookieName]
    }
  }
  return temp;
}

const dropQueue = function (queue, user = {}) {
  for (let i = 0; i < queuePromotion.length; i++) {
    if (queuePromotion[i].match(queue)) {
      queuePromotion.splice(i)
      return `Barang ${user.infoBarang ? user.infoBarang.item.name : ''} Telah Di Hapus Dari Queue`;
    }
  }
  return `Queue Barang ${user.infoBarang ? user.infoBarang.item.name : ''} Tidak Ditemukan`;
}

const timeConverter = function (timestamp, { usemilis = false, countdown = false }) {
  if (countdown) {
    timestamp = Math.abs(timestamp)
    let hour = Math.floor(timestamp / 3600000).toFixed(0);
    let minutes = Math.floor((timestamp % 3600000) / 60000).toFixed(0);
    let seconds = ((timestamp % 60000) / 1000).toFixed(0);
    let clock = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    if (usemilis) {
      let milsec = (timestamp % 1000).toFixed(0);
      clock += `:${milsec.toString().padStart(3, '0')}`
    }
    return clock;
  } else {
    let time = new Date(timestamp);
    let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let year = time.getFullYear();
    let month = months[time.getMonth()];
    let date = time.getDate();
    let hour = time.getHours();
    let min = time.getMinutes();
    let sec = time.getSeconds();
    time = `${date} ${month} ${year} ${hour}:${min}:${sec}`;
    if (usemilis) {
      let milsec = (timestamp % 1000).toFixed(0);
      time += `:${milsec.toString().padStart(3, '0')}`
    }
    return time;
  }
}

const getSessionKey = function (ctx) {
  if (ctx.from && ctx.chat) {
    return ctx.from.id
  } else if (ctx.from && ctx.inlineQuery) {
    return ctx.from.id
  }
  return null
}

const isValidURL = function (string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

const isAdmin = function (ctx) {
  if (ctx.session.userRole == 'admin') return true
  sendReportToDev(ctx, `Mencoba Mengakses Fitur Admin`, 'Info')
  return false
}

const checkAccount = function (ctx) {
  if (
    ctx.session.userLoginInfo.email &&
    ctx.session.userLoginInfo.password
  ) return true;

  let info = `Informasi Akun Anda Belum Lengkap: `
  info += `\nEmail: ${ctx.session.userLoginInfo.email || ''} `
  info += `\nPassword: ${(ctx.session.userLoginInfo.metaPassword ? '**********' : '')} `

  ctx.reply(info)
  return false;
}

const sleep = function (milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

const replaceAll = function (str, find, replace) {
  let escapedFind = find.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
  return str.replace(new RegExp(escapedFind, 'g'), replace);
}

const extractHostname = function (url) {
  let hostname;
  if (url.indexOf("//") > -1) {
    hostname = url.split('/')[2];
  } else {
    hostname = url.split('/')[0];
  }

  hostname = hostname.split(':')[0];
  hostname = hostname.split('?')[0];
  return hostname;
}

const extractRootDomain = function (url) {
  let domain = extractHostname(url),
    splitArr = domain.split('.'),
    arrLen = splitArr.length;

  if (arrLen > 2) {
    domain = splitArr[arrLen - 2] + '.' + splitArr[arrLen - 1];
    if (splitArr[arrLen - 2].length == 2 && splitArr[arrLen - 1].length == 2) {
      domain = splitArr[arrLen - 3] + '.' + domain;
    }
  }
  return domain;
}

const getCommands = function (ctx, prefix, sparator = '=') {
  let commands = {};
  let firstSplit = ctx.message.text.split(prefix)
  Object.prototype.toString.call(firstSplit)
  if (firstSplit.length > 1) {
    let everyCommand = firstSplit[1].split(" ")
    Object.prototype.toString.call(everyCommand)
    everyCommand.forEach(command => {
      command = command.split(sparator)
      command.forEach((cmd, i) => {
        command[i] = cmd.replace(/(<([^>]+)>)/gi, "")
      });
      commands[command[0]] = command[1] ? function () {
        delete command[0]
        return command.join(sparator).substring(1)
      }() : true
    })
    return commands
  }
  return null
}

const generateString = function (length = 0, chartset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chartset.charAt(Math.floor(Math.random() * chartset.length));
  }
  return result;
}

bot.command('xplay', async (ctx) => {
  if (!isAdmin(ctx)) return
  if (!fs.existsSync('./temp')) fs.mkdirSync('./temp')
  let user = ctx.session;
  let commands = getCommands(ctx, '/xplay ')
  if (commands == null) return ctx.reply(`/xplay <code>url=http://...69fck.onion</code>`, { parse_mode: 'HTML' })

  await ctx.reply(`Prepare... <code>${commands.url}</code>`, { parse_mode: 'HTML' }).then((replyCtx) => {
    user.message = {
      chatId: replyCtx.chat.id,
      msgId: replyCtx.message_id,
      inlineMsgId: replyCtx.inline_message_id,
      text: replyCtx.text
    }
  })

  let curl = new user.Curl();
  curl.newTorIdentity()
  curl.setProxy('127.0.0.1:9050').setHeaders([
    "User-Agent: Mozilla/5.0 (Windows NT 10.0; rv:78.0) Gecko/20100101 Firefox/78.0",
    "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language: en-US,en;q=0.5",
    `Referer: http://${psl.get(extractRootDomain(commands.url))}/index.php?option=com_users&view=login`,
    "DNT: 1",
    "Connection: keep-alive",
    `Cookie: ${process.env.COOKIE}`,
    "Upgrade-Insecure-Requests: 1",
    "Cache-Control: max-age=0"
  ]).get(commands.url).then(async ({ statusCode, body, headers }) => {
    let document = parse(body)
    let videoTitle = document.querySelector('title').childNodes[0].rawText
    let videoName = document.querySelector('source').rawAttrs.split('src="')[1].split('" ')[0].split('/')

    if (fs.existsSync(`./temp/${videoName[videoName.length - 1]}`)) {
      return replaceMessage(ctx, message, `File Sudah Video <code>${commands.url}</code> Sudah Ada`, false)
    } else {
      let header = [
        `${process.env.DOMAIN}/hwdvideos/uploads/${videoName[videoName.length - 2]}/${videoName[videoName.length - 1]}`,
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; rv:78.0) Gecko/20100101 Firefox/78.0',
        'Accept: video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
        'Accept-Language: en-US,en;q=0.5',
        'Range: bytes=0-',
        'DNT: 1',
        'Connection: keep-alive'
      ]

      await replaceMessage(ctx, user.message, `Sedang Mendownload Video <code>${commands.url}</code>`, false)
      return exec(`curl --socks5-hostname 127.0.0.1:9050 '${header.join(`' -H '`)}' --output temp/${videoName[videoName.length - 1]}`, async (err, stdout, stderr) => {
        if (err) return sendReportToDev(ctx, err)
        return replaceMessage(ctx, user.message, `Video <code>${commands.url}</code> ${videoTitle} ${videoName[videoName.length - 1]} Terdownload\n${stderr}`, false)
      });
    }

  }).catch((err) => sendReportToDev(ctx, err));
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