require('dotenv').config()
const { Telegraf, session } = require('telegraf'),
  mongoose = require('mongoose'),
  fs = require('fs'),
  crypto = require('crypto'),
  psl = require('psl'),
  url = require('url'),
  chalk = require('chalk'),
  { curly } = require('node-libcurl'),

  packageJson = require('./package.json'),
  Curl = require('./helpers/curl'),
  waitUntil = require('./helpers/waitUntil'),

  getLogin = require('./request/auth/getLogin'),
  postLogin = require('./request/auth/postLogin'),
  postLoginMethod = require('./request/auth/postLoginMethod'),
  postLoginLinkVerify = require('./request/auth/postLoginLinkVerify'),
  postLoginTokenVerify = require('./request/auth/postLoginTokenVerify'),
  postStatusLogin = require('./request/auth/postStatusLogin'),
  postLoginDone = require('./request/auth/postLoginDone'),

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
  postCancel = require('./request/other/postCancel'),

  getFlashSaleSession = require('./request/other/getFlashSaleSession'),
  getAllItemids = require('./request/other/getAllItemids'),
  postFlashSaleBatchItems = require('./request/other/postFlashSaleBatchItems'),

  User = require('./models/User'),
  Other = require('./models/Other'),
  Log = require('./models/Log'),
  Failure = require('./models/Failure'),

  bot = new Telegraf(process.env.TOKEN);

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('./helpers'))

global.QUEUEBUY = []

mongoose.connect(process.env.MONGODB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((res, err) => err ? console.error(chalk.red(err)) : console.log(chalk.green('MongoDB connection successful.')))
  .catch((err) => console.error(chalk.red(err)))

bot.use(session())

bot.telegram.getMe().then(async (botInfo) => {
  let user = { Curl: Curl }
  process.env.BOT_NAME = botInfo.first_name
  process.env.BOT_USERNAME = botInfo.username

  await User.updateOne({ teleChatId: process.env.ADMIN_ID }, {
    userRole: "admin"
  }, async function (err, user, created) { if (err) return sendReportToDev(bot, `<code>${err}</code>`, 'Error') })

  await Other.findOrCreate({}, {
    "promotionId": [], "disableProducts": [{ "url": null, "itemid": null, "shopid": null, "allowed": ["admin"], "message": "..." }], "eventProducts": [{ "url": null, "itemid": null, "shopid": null, "price": null }], "metaPayment": { "channels": [{ "name_label": "label_shopee_wallet_v2", "version": 2, "spm_channel_id": 8001400, "be_channel_id": 80030, "name": "ShopeePay", "enabled": true, "channel_id": 8001400 }, { "name_label": "label_offline_bank_transfer", "version": 2, "spm_channel_id": 8005200, "be_channel_id": 80060, "name": "Transfer Bank", "enabled": true, "channel_id": 8005200, "banks": [{ "bank_name": "Bank BCA (Dicek Otomatis)", "option_info": "89052001", "be_channel_id": 80061, "enabled": true }, { "bank_name": "Bank Mandiri(Dicek Otomatis)", "option_info": "89052002", "enabled": true, "be_channel_id": 80062 }, { "bank_name": "Bank BNI (Dicek Otomatis)", "option_info": "89052003", "enabled": true, "be_channel_id": 80063 }, { "bank_name": "Bank BRI (Dicek Otomatis)", "option_info": "89052004", "be_channel_id": 80064, "enabled": true }, { "bank_name": "Bank Syariah Indonesia (BSI) (Dicek Otomatis)", "option_info": "89052005", "be_channel_id": 80065, "enabled": true }, { "bank_name": "Bank Permata (Dicek Otomatis)", "be_channel_id": 80066, "enabled": true, "option_info": "89052006" }] }, { "channelid": 89000, "name_label": "label_cod", "version": 1, "spm_channel_id": 0, "be_channel_id": 89000, "name": "COD (Bayar di Tempat)", "enabled": true }] }
  }, async function (err, other, created) { if (err) return sendReportToDev(bot, `<code>${err}</code>`, 'Error') })

  await User.findOne({ teleChatId: process.env.ADMIN_ID }, async function (err, userUpdated) { user = { ...user, ...userUpdated._doc } })

  return setTimeout(alarmFlashSale.bind(null, user), 0);
}).catch((err) => console.error(chalk.red(err)))

const alarmFlashSale = async function (user) {
  await setEvent({ commands: { "-clear": true } })

  await getFlashSaleSession(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
    user.getFlashSaleSession = typeof body == 'string' ? JSON.parse(body) : body;
    curl.close()
  }).catch((err) => sendReportToDev(bot, err, 'Error'));

  await Promise.all(user.getFlashSaleSession.data.sessions.map(session => {
    return new Promise(async (resolve, reject) => {
      await getAllItemids(user, session).then(({ statusCode, body, headers, curlInstance, curl }) => {
        user.getAllItemids = typeof body == 'string' ? JSON.parse(body) : body;
        curl.close()
      }).catch((err) => sendReportToDev(bot, err, 'Error'));

      return resolve(user.getAllItemids.data.promotionid)
    })
  })).then(async id => {
    await Other.updateOne(null, {
      promotionId: id
    }).exec()
  })

  for (const [index, session] of user.getFlashSaleSession.data.sessions.entries()) {
    if (index == 0) {
      user.timeout = session.end_time + 1
      continue;
    }

    await getAllItemids(user, session).then(({ statusCode, body, headers, curlInstance, curl }) => {
      user.getAllItemids = typeof body == 'string' ? JSON.parse(body) : body;
      curl.close()
    }).catch((err) => sendReportToDev(bot, err, 'Error'));

    await postFlashSaleBatchItems(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
      user.getFlashSaleSession = typeof body == 'string' ? JSON.parse(body) : body;
      curl.close()
    }).catch((err) => sendReportToDev(bot, err, 'Error'));

    let banner = session.name + (session.with_mega_sale_session ? " | MEGA SALE" : "")
    banner += `\n\nList Item yang Mencurigakan : `

    user.max = { price_before_discount: 0, url: null }

    for (const item of user.getFlashSaleSession.data.items) {
      if (item.hidden_price_display === "?.000" && (item.price_before_discount / 100000 > 100000)) {
        // if (item.hidden_price_display === "?.000" && (item.price_before_discount / 100000 > 1)) {
        if (item.price_before_discount > user.max.price_before_discount) {
          user.max = {
            price_before_discount: item.price_before_discount,
            url: `https://shopee.co.id/product/${item.shopid}/${item.itemid}`
          }
        }

        banner += `\n\n${item.name} - (Rp. ${item.hidden_price_display}) - Rp. ${numTocurrency(item.price_before_discount / 100000)} - https://shopee.co.id/product/${item.shopid}/${item.itemid}`
        await setEvent({
          commands: {
            url: `https://shopee.co.id/product/${item.shopid}/${item.itemid}`,
            price: 1000
          }
        })
      }
    }

    await User.find(async function (err, users) {
      if (err) return sendReportToDev(bot, `<code>${err}</code>`, 'Error')
      for (let u of users) {
        u = JSON.parse(JSON.stringify(u))
        if (['admin', 'vip'].includes(u.userRole)) {

          bot.from = u.teleChatData
          bot.chat = u.teleChatData
          bot.message = {
            chat: u.teleChatData
          }
          bot.session = u

          await sendMessage(bot, banner, { parse_mode: 'HTML' })
          if (user.max.url && index == 1) {
            bot.session.commands = {
              url: user.max.url,
              price: user.max.price,
              '-vip': true
            }
            bot.session.Curl = Curl

            await bot.telegram.sendMessage(u.teleChatId, `Prepare... <code>${user.max.url}</code>`, { parse_mode: 'HTML' }).then((replyCtx) => {
              bot.session.config = {
                message: {
                  chatId: replyCtx.chat.id,
                  msgId: replyCtx.message_id,
                  inlineMsgId: replyCtx.inline_message_id,
                  text: replyCtx.text
                }
              }
            })

            setTimeout(getItem.bind(null, bot), 0)
          }
        }
      }
    })
  }

  return setTimeout(alarmFlashSale.bind(null, {
    Curl: Curl
  }), user.timeout * 1000 - Date.now());
}

bot.use((ctx, next) => {
  if (!ctx.message.chat) return;
  return User.findOrCreate({ teleChatId: ctx.message.chat.id }, {
    teleChatData: ctx.message.chat,
    userLoginInfo: { email: null, },
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
  banner += `\n\n<b>==== Fitur Speed Pada ${process.env.BOT_NAME} ====</b>`
  banner += `\n\nVIP     -> Speed Bot selesai Checkout / Payment ± 5ms`
  banner += `\nPREMIUM -> Speed Bot selesai Checkout / Payment ± 150ms`
  banner += `\nMEMBER  -> Speed Bot selesai Checkout / Payment ± 400ms`
  banner += `\n\n<b>==== LIST OPSI SHOP BOT ====</b>`
  banner += `\n\nOpsi <code>/beli</code> ini lah BOT online shopee nya, Agan akan Diperingatkan Login terlebih dahulu apabila email password Agan masih kosong`
  banner += `\n >> Contohnya : /beli <code>url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`
  banner += `\n\nOpsi <code>/stop</code> Digunakan untuk membatalkan atau stop antrian pembelian flashsale berjadwal`
  banner += `\n >> Contohnya : /stop <code>url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`
  banner += `\n\nOpsi <code>/login</code> di gunakan untuk melakukan input data untuk Login Sekaligus Login ke akun Shopee Agan`
  banner += `\n >> Contohnya : /login <code>email=emailagan@email.com password=rahasia</code>`
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
  banner += `\n\n<b>"UNTUK REQUEST FITUR <b>VIP</b> / <b>PREMIUM</b> BISA CHAT GW LANGSUNG NGAB"</b>`
  banner += `\n\n<i>Contact Person : ngufeel@gmail.com | +6282386007722</i>`
  banner += `\n<i>BOT Created by: @edosulai</i>`
  return ctx.reply(banner, { parse_mode: 'HTML' });
})

bot.help(async (ctx) => {
  let commands = splitAtFirstSpace(ctx.message.text)
  if (commands.length < 2) return ctx.reply(`/help <code>...message...</code>`, { parse_mode: 'HTML' })
  return sendReportToDev(ctx, commands[1].replace(/(<([^>]+)>)/gi, ""), 'Help');
})

bot.command('info', (ctx) => {
  if (!ensureRole(ctx)) return
  let commands = splitAtFirstSpace(ctx.message.text)
  if (commands.length < 2) return ctx.reply(`/info <code>...message...</code>`, { parse_mode: 'HTML' })
  let msg = commands[1].replace(/(<([^>]+)>)/gi, "")
  return User.find(async function (err, users) {
    if (err) return sendReportToDev(ctx, err)
    for (let user of users) {
      await ctx.reply(`<i>Info</i> : ${msg}`, { chat_id: JSON.parse(JSON.stringify(user)).teleChatData.id, parse_mode: 'HTML' })
    }
  })
})

bot.command('speed', async (ctx) => {
  if (!ensureRole(ctx)) return
  let commands = getCommands(ctx.message.text)
  if (objectSize(commands) < 1) return ctx.reply(`/speed <code>limit=1 url=http://example.com/</code>`, { parse_mode: 'HTML' })

  if (typeof commands.url != 'string') return ctx.reply('Syntax Tidak Lengkap')
  if (!isValidURL(commands.url)) return ctx.reply('Format Url Salah')

  let totalRequest = 0;
  let totalWaktu = 0;
  let tunggu = Date.now();

  while (totalWaktu < (commands.limit * 1000)) {
    await curly.get(commands.url).then(({ statusCode, body, headers }) => {
      totalWaktu = Date.now() - tunggu;
      totalRequest++;
    }).catch((err) => sendReportToDev(ctx, err));
  }

  await ctx.reply(`Total curly Dalam ${commands.limit} Detik = ${totalRequest}`)

  sleep(1000);

  totalRequest = 0;
  totalWaktu = 0;
  tunggu = Date.now();

  while (totalWaktu < (commands.limit * 1000)) {
    let curl = new Curl();
    await curl.get(commands.url).then(({ statusCode, body, headers, curlInstance, curl }) => {
      curl.close()
      totalWaktu = Date.now() - tunggu;
      totalRequest++;
    }).catch((err) => sendReportToDev(ctx, err));
  }

  return ctx.reply(`Total curl Dalam ${commands.limit} Detik = ${totalRequest}`)
})

bot.command('log', async (ctx) => {
  if (!ensureRole(ctx)) return
  let user = ctx.session;
  user.commands = getCommands(ctx.message.text)
  if (objectSize(user.commands) < 1) return ctx.reply(`/log <code>url=...</code>`, { parse_mode: 'HTML' })

  if (user.commands.url) {
    if (psl.get(extractRootDomain(user.commands.url)) != 'shopee.co.id') return ctx.reply('Bukan Url Dari Shopee')

    let pathname = url.parse(user.commands.url, true).pathname.split('/')

    if (pathname.length == 4) {
      user.itemid = parseInt(pathname[3])
      user.shopid = parseInt(pathname[2])
    } else {
      pathname = pathname[1].split('.')
      user.itemid = parseInt(pathname[pathname.length - 1])
      user.shopid = parseInt(pathname[pathname.length - 2])
    }

    if (!Number.isInteger(user.itemid) || !Number.isInteger(user.shopid)) return ctx.reply('Bukan Url Produk Shopee')
  }

  if (user.commands['-clear']) {
    return Log.deleteMany(user.itemid ? { itemid: user.itemid, shopid: user.shopid } : null)
      .then((result) => {
        return ctx.reply(`${result.deletedCount} Log Telah Terhapus`)
      }).catch((err) => sendReportToDev(ctx, err));
  }

  return Log.findOne({ itemid: user.itemid, shopid: user.shopid }, async function (err, log) {
    if (err || !log) return ctx.reply('Log Untuk Produk Ini Tidak Tersedia!!')
    fs.writeFileSync(`log-${user.itemid}.json`, JSON.stringify(log));
    await ctx.telegram.sendDocument(ctx.message.chat.id, { source: `./log-${user.itemid}.json` }).catch((err) => console.error(chalk.red(err)))
    return fs.unlinkSync(`./log-${user.itemid}.json`);
  })
})

bot.command('failure', async (ctx) => {
  if (!ensureRole(ctx)) return
  let user = ctx.session;
  user.commands = getCommands(ctx.message.text)
  if (objectSize(user.commands) < 1) return ctx.reply(`/failure <code>url=...</code>`, { parse_mode: 'HTML' })

  if (user.commands.url) {
    if (psl.get(extractRootDomain(user.commands.url)) != 'shopee.co.id') return ctx.reply('Bukan Url Dari Shopee')

    let pathname = url.parse(user.commands.url, true).pathname.split('/')

    if (pathname.length == 4) {
      user.itemid = parseInt(pathname[3])
      user.shopid = parseInt(pathname[2])
    } else {
      pathname = pathname[1].split('.')
      user.itemid = parseInt(pathname[pathname.length - 1])
      user.shopid = parseInt(pathname[pathname.length - 2])
    }

    if (!Number.isInteger(user.itemid) || !Number.isInteger(user.shopid)) return ctx.reply('Bukan Url Produk Shopee')
  }

  if (user.commands['-clear']) {
    return Failure.deleteMany(user.itemid ? { itemid: user.itemid, shopid: user.shopid } : null)
      .then((result) => {
        return ctx.reply(`${result.deletedCount} Failure Telah Terhapus`)
      }).catch((err) => sendReportToDev(ctx, err));
  }

  return Failure.findOne({ itemid: user.itemid, shopid: user.shopid }, async function (err, failure) {
    if (err || !failure) return ctx.reply('Failure Untuk Produk Ini Tidak Tersedia!!')
    fs.writeFileSync(`failure-${user.itemid}.json`, JSON.stringify(failure));
    await ctx.telegram.sendDocument(ctx.message.chat.id, { source: `./failure-${user.itemid}.json` }).catch((err) => console.error(chalk.red(err)))
    return fs.unlinkSync(`./failure-${user.itemid}.json`);
  })
})

bot.command('user', async (ctx) => {
  if (!ensureRole(ctx)) return
  let user = ctx.session;
  user.commands = getCommands(ctx.message.text)

  if (objectSize(user.commands) < 1) {
    return User.find(function (err, users) {
      if (err) return sendReportToDev(ctx, err)
      let alluser = ``
      for (let user of users) {
        let theUser = JSON.parse(JSON.stringify(user)).teleChatData
        alluser += `\n`
        for (const key in theUser) { if (Object.hasOwnProperty.call(theUser, key)) { alluser += `<code>${key}: ${theUser[key]}, </code>` } }
      }
      return ctx.reply(alluser, { parse_mode: 'HTML' })
    })
  }

  if (user.commands.id) {
    return User.findOne({ teleChatId: user.commands.id }, function (err, user) {
      if (err) return sendReportToDev(ctx, err)
      return ctx.reply(`<code>${user}</code>`, { parse_mode: 'HTML' })
    })
  }
})

bot.command('login', async (ctx) => {
  let user = ctx.session;
  let commands = getCommands(ctx.message.text)

  return getAddress(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    curl.close()
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    user.address = typeof body == 'string' ? JSON.parse(body) : body;
    if (!user.address.error) return ctx.reply('Anda Sudah Login')

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

    await User.updateOne({
      teleChatId: ctx.message.chat.id
    }, {
      userLoginInfo: user.userLoginInfo,
      userCookie: user.userCookie
    }).exec()

    if (!checkAccount(ctx)) return ctx.reply(`/login <code>email=emailagan@email.com password=rahasia</code>`, { parse_mode: 'HTML' })

    await getLogin(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
      curl.close()
      user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    }).catch((err) => sendReportToDev(ctx, err));

    return async function _tryLogin(msg) {
      if (msg) await ctx.reply(msg)
      return postLogin(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
        curl.close()
        user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
        user.login = typeof body == 'string' ? JSON.parse(body) : body;

        switch (user.login.error) {
          case 1:
            return _tryLogin('Ada Yang Error.. Sedang Mencoba Kembali..');
          case 2:
            return ctx.reply('Akun dan/atau password Anda salah, silakan coba lagi')
          case 98:
            await postLoginMethod(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
              curl.close()
              user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
              user.loginMethod = typeof body == 'string' ? JSON.parse(body) : body;
            }).catch((err) => sendReportToDev(ctx, err));

            if (user.loginMethod.data.length == 0) {
              return ctx.reply('Maaf, kami tidak dapat memverifikasi log in kamu. Silakan hubungi Customer Service untuk bantuan.')
            }

            await postLoginLinkVerify(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
              curl.close()
              user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
              user.loginLinkVerify = typeof body == 'string' ? JSON.parse(body) : body;
              ctx.reply('Silahkan Cek Notifikasi SMS dari Shopee di Handphone Anda')
            }).catch((err) => sendReportToDev(ctx, err));

            do {
              await postStatusLogin(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
                curl.close()
                user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
                user.loginStatus = typeof body == 'string' ? JSON.parse(body) : body;
              }).catch((err) => sendReportToDev(ctx, err));

              if (user.loginStatus.data.link_status == 4) return ctx.reply('Login Anda Gagal Coba Beberapa Saat Lagi')

              sleep(1000);
            } while (user.loginStatus.data.link_status != 2);

            await postLoginTokenVerify(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
              curl.close()
              user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
              user.loginTokenVerify = typeof body == 'string' ? JSON.parse(body) : body;
            }).catch((err) => sendReportToDev(ctx, err));

            await postLoginDone(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
              curl.close()
              user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
              user.loginStatus = typeof body == 'string' ? JSON.parse(body) : body;
            }).catch((err) => sendReportToDev(ctx, err));

            if (user.loginStatus.data) {
              await ctx.reply('Login Berhasil')
            } else {
              await ctx.reply(`Login Gagal`)
              return sendReportToDev(ctx, 'Login Gagal', 'Error')
            }

            break;

          default:
            await ctx.reply(`Auto Login Berhasil`)
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

  }).catch((err) => sendReportToDev(ctx, err));
})

bot.command('event', async (ctx) => {
  if (!ensureRole(ctx)) return
  let user = ctx.session
  user.commands = getCommands(ctx.message.text)
  if (objectSize(user.commands) < 1) return ctx.reply(`/event <code>url=https://shopee.co.id/Sebuah-Produk-Shop..... price=...</code>`, { parse_mode: 'HTML' })
  return setEvent(user, ctx)
})

const setEvent = async function (user, ctx = null) {
  user.other = (await Other.find())[0]

  if (user.commands.url && user.commands.price) {
    if (!isValidURL(user.commands.url) && ctx) return ctx.reply('Format Url Salah')
    if (psl.get(extractRootDomain(user.commands.url)) != 'shopee.co.id' && ctx) return ctx.reply('Bukan Url Dari Shopee')

    let pathname = url.parse(user.commands.url, true).pathname.split('/')
    if (pathname.length == 4) {
      user.itemid = parseInt(pathname[3])
      user.shopid = parseInt(pathname[2])
    } else {
      pathname = pathname[1].split('.')
      user.itemid = parseInt(pathname[pathname.length - 1])
      user.shopid = parseInt(pathname[pathname.length - 2])
    }

    if (!Number.isInteger(user.itemid) || !Number.isInteger(user.shopid) && ctx) return ctx.reply('Bukan Url Produk Shopee')

    if (user.other.eventProducts.length <= 0) {
      user.other.eventProducts.push({
        url: user.commands.url,
        itemid: user.itemid,
        shopid: user.shopid,
        price: user.commands.price
      })
    } else {
      for (const [index, product] of user.other.eventProducts.entries()) {
        if (
          product.itemid == user.itemid &&
          product.shopid == user.shopid
        ) {
          user.other.eventProducts[index] = {
            url: user.commands.url,
            itemid: user.itemid,
            shopid: user.shopid,
            price: user.commands.price
          }
          break;
        }

        if (index == user.other.eventProducts.length - 1) {
          user.other.eventProducts.push({
            url: user.commands.url,
            itemid: user.itemid,
            shopid: user.shopid,
            price: user.commands.price
          })
        }
      }
    }

    await Other.updateOne(null, {
      eventProducts: user.other.eventProducts
    }).exec()
  }

  if (user.commands['-clear']) {
    return Other.updateOne(null, {
      eventProducts: []
    }).exec(function () {
      if (ctx) return ctx.reply(`List Event Products Berhasil Di Hapus`)
    })
  }

  if (ctx) return ctx.reply(`<code>${JSON.stringify(user.other.eventProducts, null, "\t")}</code>`, { parse_mode: 'HTML' })
}

bot.command('disable', async (ctx) => {
  if (!ensureRole(ctx)) return
  let user = ctx.session
  user.commands = getCommands(ctx.message.text)

  user.other = (await Other.find())[0]

  if (user.commands.url) {
    if (!isValidURL(user.commands.url)) return ctx.reply('Format Url Salah')
    if (psl.get(extractRootDomain(user.commands.url)) != 'shopee.co.id') return ctx.reply('Bukan Url Dari Shopee')

    let pathname = url.parse(user.commands.url, true).pathname.split('/')
    if (pathname.length == 4) {
      user.itemid = parseInt(pathname[3])
      user.shopid = parseInt(pathname[2])
    } else {
      pathname = pathname[1].split('.')
      user.itemid = parseInt(pathname[pathname.length - 1])
      user.shopid = parseInt(pathname[pathname.length - 2])
    }

    if (!Number.isInteger(user.itemid) || !Number.isInteger(user.shopid)) return ctx.reply('Bukan Url Produk Shopee')

    if (user.other.disableProducts.length <= 0) {
      user.other.disableProducts.push({
        url: user.commands.url,
        itemid: user.itemid,
        shopid: user.shopid,
        allowed: user.commands.allowed ? user.commands.allowed.toLowerCase().split(',') : ['admin'],
        message: user.commands.msg
      })
    } else {
      for (const [index, product] of user.other.disableProducts.entries()) {
        if (
          product.itemid == user.itemid &&
          product.shopid == user.shopid
        ) {
          user.other.disableProducts[index] = {
            url: user.commands.url,
            itemid: user.itemid,
            shopid: user.shopid,
            allowed: user.commands.allowed ? user.commands.allowed.toLowerCase().split(',') : ['admin'],
            message: user.commands.msg
          }
          break;
        }

        if (index == user.other.disableProducts.length - 1) {
          user.other.disableProducts.push({
            url: user.commands.url,
            itemid: user.itemid,
            shopid: user.shopid,
            allowed: user.commands.allowed ? user.commands.allowed.toLowerCase().split(',') : ['admin'],
            message: user.commands.msg
          })
        }
      }
    }

    await Other.updateOne(null, {
      disableProducts: user.other.disableProducts
    }).exec()
  }

  if (user.commands['-clear']) {
    return Other.updateOne(null, {
      disableProducts: []
    }).exec(function () {
      return ctx.reply(`List Disable Products Berhasil Di Hapus`)
    })
  }

  return ctx.reply(`<code>${JSON.stringify(user.other.disableProducts, null, "\t")}</code>`, { parse_mode: 'HTML' })
})

bot.command('stop', async (ctx) => {
  let user = ctx.session
  user.commands = getCommands(ctx.message.text)
  if (objectSize(user.commands) < 1) return ctx.reply(`/stop <code>url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`, { parse_mode: 'HTML' })

  if (!checkAccount(ctx) || !isValidURL(user.commands.url)) return ctx.reply('Format Url Salah')
  if (psl.get(extractRootDomain(user.commands.url)) != 'shopee.co.id') return ctx.reply('Bukan Url Dari Shopee')

  let pathname = url.parse(user.commands.url, true).pathname.split('/')

  if (pathname.length == 4) {
    user.itemid = parseInt(pathname[3])
  } else {
    pathname = pathname[1].split('.')
    user.itemid = parseInt(pathname[pathname.length - 1])
  }

  if (!Number.isInteger(user.itemid)) return ctx.reply('Bukan Url Produk Shopee')

  return ctx.reply(dropQueue(`${getSessionKey(ctx)}:${user.itemid}`)), { parse_mode: 'HTML' };
})

bot.command('beli', async (ctx) => {
  let user = ctx.session
  user.commands = getCommands(ctx.message.text)
  if (objectSize(user.commands) < 1) return ctx.reply(`/beli <code>url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`, { parse_mode: 'HTML' })

  await ctx.reply(`Prepare... <code>${user.commands.url}</code>`, { parse_mode: 'HTML' }).then((replyCtx) => {
    user.config = {
      message: {
        chatId: replyCtx.chat.id,
        msgId: replyCtx.message_id,
        inlineMsgId: replyCtx.inline_message_id,
        text: replyCtx.text
      }
    }
  })

  if (!checkAccount(ctx) || !isValidURL(user.commands.url)) return replaceMessage(ctx, user.config.message, 'Format Url Salah / Anda Belum Login')
  if (psl.get(extractRootDomain(user.commands.url)) != 'shopee.co.id') return replaceMessage(ctx, user.config.message, 'Bukan Url Dari Shopee')
  if (user.commands['-cod'] && user.commands['-shopeepay']) return replaceMessage(ctx, user.config.message, 'Silahkan Pilih Hanya Salah Satu Metode Pembayaran')

  for (let queue of global.QUEUEBUY) {
    if (queue.split(':')[0] == getSessionKey(ctx) && !ensureRole(ctx, true)) return replaceMessage(ctx, user.config.message, 'Hanya Bisa Mendaftarkan 1 Produk Dalam Antrian!!')
  }

  return getItem(ctx);
})

bot.command('quit', (ctx) => ctx.telegram.leaveChat(ctx.message.chat.id).then().catch((err) => sendReportToDev(ctx, `Meninggalkan BOT`, 'Info')))

const getItem = async function (ctx) {
  let user = ctx.session

  let pathname = url.parse(user.commands.url, true).pathname.split('/')

  if (pathname.length == 4) {
    user.config.itemid = parseInt(pathname[3])
    user.config.shopid = parseInt(pathname[2])
  } else {
    pathname = pathname[1].split('.')
    user.config.itemid = parseInt(pathname[pathname.length - 1])
    user.config.shopid = parseInt(pathname[pathname.length - 2])
  }

  if (!Number.isInteger(user.config.itemid) || !Number.isInteger(user.config.shopid)) return replaceMessage(ctx, user.config.message, 'Bukan Url Produk Shopee')

  user.other = (await Other.find())[0]

  for (const product of user.other.disableProducts) {
    if (
      product.itemid == user.config.itemid &&
      product.shopid == user.config.shopid &&
      !ensureRole(ctx, true, product.allowed)
    ) return replaceMessage(ctx, user.config.message, product.msg || `Shopee Bot Untuk Produk <code>${user.commands.url}</code> Tidak Tersedia Untuk Anda`, false)
  }

  user.config = {
    ...user.config, ...{
      quantity: parseInt(user.commands.qty) || 1,
      url: user.commands.url,
      payment: {
        cod: user.commands['-cod'] || false,
        shopeePay: user.commands['-shopeepay'] || false,
        transferBank: function (tansferPrioritys) {
          if (tansferPrioritys.includes(user.commands.transfer)) {
            tansferPrioritys.sort(function (index, transfer) {
              return index == user.commands.transfer ? -1 : transfer == user.commands.transfer ? 1 : 0;
            });
            return tansferPrioritys;
          } else {
            return tansferPrioritys
          }
        }(['bni', 'bri', 'bca', 'mandiri', 'bsi', 'permata'])
      },
      skiptimer: user.commands['-skiptimer'] || false,
      autocancel: user.commands['-autocancel'] || false,
      cache: user.commands['-cache'] ? ensureRole(ctx, false, ['admin']) : false,
      repeat: user.commands['-repeat'] ? ensureRole(ctx, false, ['admin']) : false,
      predictPrice: user.commands.price ? parseInt(user.commands.price) * 100000 : false,
      flashSale: false,
      fail: 0,
      success: false,
      outstock: false,
      info: []
    }
  }

  if (user.commands['-premium'] ? ensureRole(ctx, true, ['admin', 'vip', 'premium']) : false) {
    user.config.cache = true;
    await replaceMessage(ctx, user.config.message, 'Fitur Premium Terpasang')
  }

  if (user.commands['-vip'] ? ensureRole(ctx, true, ['admin', 'vip']) : false) {
    user.config.cache = true;
    user.config.repeat = true;
    for (const product of user.other.eventProducts) {
      if (
        product.itemid == user.config.itemid &&
        product.shopid == user.config.shopid
      ) {
        user.config.predictPrice = parseInt(product.price) * 100000
        await replaceMessage(ctx, user.config.message, 'Fitur VIP Terpasang')
        break
      }
    }
  }

  if (user.config.cache) {
    await Log.findOne({
      teleChatId: ctx.message.chat.id,
      itemid: user.config.itemid,
    }, async function (err, log) {
      if (err || !log) return ensureRole(ctx, true) ? replaceMessage(ctx, user.config.message, 'Cache Untuk Produk Ini Tidak Tersedia!!') : null
      log = JSON.parse(JSON.stringify(log))
      for (const key in log) {
        if (Object.hasOwnProperty.call(log, key) && typeof log[key] == 'object') user[key] = log[key]
      }
    })
  }

  user.payment = require('./helpers/paymentMethod')(user, user.other.metaPayment.channels)

  return getAddress(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    curl.close()
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    user.address = typeof body == 'string' ? JSON.parse(body) : body;
    if (user.address.error) return replaceMessage(ctx, user.config.message, 'Sesi Anda Sudah Habis Silahkan Login Kembali')
    user.address = function (addresses) {
      for (const address of addresses) {
        return address
      }
    }(user.address.addresses)

    global.QUEUEBUY.push(`${getSessionKey(ctx)}:${user.config.itemid}`)
    if (user.config.cache) user.config.firstCache = true

    do {
      user.config.start = Date.now()

      if (!global.QUEUEBUY.includes(`${getSessionKey(ctx)}:${user.config.itemid}`)) return replaceMessage(ctx, user.config.message, `Timer${user.infoBarang ? ` Untuk Barang ${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")}` : ''} - ${user.payment.msg} - Sudah Di Matikan`)

      await getInfoBarang(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
        curl.close();
        user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
        let chunk = typeof body == 'string' ? JSON.parse(body) : body;
        if (chunk.error != null) {
          user.config.start = false
        } else {
          user.infoBarang = chunk;
        }
      }).catch((err) => userLogs(ctx, err, 'Error', () => user.config.start = false));

      if (!user.infoBarang || !user.config.start) continue;
      if (user.infoBarang.item.upcoming_flash_sale || user.infoBarang.item.flash_sale) user.config.flashSale = true;
      user.config.promotionid = (user.infoBarang.item.flash_sale ? user.other.promotionId[0] : user.other.promotionId[1])
      if (!user.infoBarang.item.upcoming_flash_sale) break;

      user.config.modelid = parseInt(user.infoBarang.item.upcoming_flash_sale.modelids[0])
      user.config.end = user.infoBarang.item.upcoming_flash_sale.start_time * 1000

      if (user.config.end < Date.now() + 10000) break;

      let msg = ``
      msg += timeConverter(Date.now() - user.config.end, { countdown: true })
      msg += ` - ${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")} - ${user.payment.msg}`

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
        if (typeof info == 'string') {
          msg += ` - ${info}`
          user.config.outstock = false
          if (user.config.firstCache) user.config.firstCache = false
        }
      }

      await replaceMessage(ctx, user.config.message, msg)
      sleep(ensureRole(ctx, true) ? 200 : (200 * global.QUEUEBUY.length) - (Date.now() - user.config.start))
      delete user.infoBarang

    } while (!user.config.skiptimer)

    await getInfoPengiriman(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
      curl.close()
      user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
      user.infoPengiriman = typeof body == 'string' ? JSON.parse(body) : body;
    }).catch((err) => sendReportToDev(ctx, err));

    if (!user.config.modelid) {
      user.config.modelid = function (barang) {
        for (const model of barang.item.models) {
          if (!barang.item.flash_sale) break;
          if (model.stock < 1 || model.price_stocks.length < 1) continue
          for (const stock of model.price_stocks) {
            if (user.other.promotionId[0] == stock.promotion_id) return stock.model_id
          }
        }

        for (const model of barang.item.models) {
          if (model.stock < 1 || model.price_stocks.length < 1) continue
          return model.price_stocks[0].model_id
        }

        for (const model of barang.item.models) {
          if (model.stock < 1) continue
          return model.modelid
        }

        return null
      }(user.infoBarang)
    }

    if (!user.config.modelid) return replaceMessage(ctx, user.config.message, `Semua Stok Barang Sudah Habis\n\n${dropQueue(`${getSessionKey(ctx)}:${user.config.itemid}`, user)}`)

    if (user.config.cache && user.infoBarang.item.stock > 0) {
      let info = await getCart(ctx, true)
      if (typeof info == 'string') replaceMessage(ctx, user.config.message, info)
    }

    if (!global.QUEUEBUY.includes(`${getSessionKey(ctx)}:${user.config.itemid}`)) return replaceMessage(ctx, user.config.message, `Timer${user.infoBarang ? ` Untuk Barang ${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")}` : ''} - ${user.payment.msg} - Sudah Di Matikan`)

    while ((user.config.end > Date.now()) || ((Date.now() % 1000).toFixed(0) > 100)) continue;

    let info = await getCart(ctx)
    dropQueue(`${getSessionKey(ctx)}:${user.config.itemid}`, user)
    if (typeof info == 'string') await replaceMessage(ctx, user.config.message, info, false)

    if (!user.config.success) {
      return Failure.updateOne({
        teleChatId: ctx.message.chat.id,
        itemid: user.config.itemid,
        shopid: user.config.shopid,
        modelid: user.config.modelid
      }, {
        buyBody: user.postBuyBody,
        buyBodyLong: user.postBuyBodyLong,
        infoBarang: user.infoBarang,
        infoPengiriman: user.infoPengiriman,
        infoKeranjang: user.infoKeranjang,
        updateKeranjang: user.updateKeranjang,
        infoCheckoutQuick: user.infoCheckoutQuick,
        infoCheckoutLong: user.infoCheckoutLong
      }, { upsert: true }).exec()
    }

  }).catch((err) => sendReportToDev(ctx, err, function () {

    return Failure.updateOne({
      teleChatId: ctx.message.chat.id,
      itemid: user.config.itemid,
      shopid: user.config.shopid,
      modelid: user.config.modelid
    }, {
      buyBody: user.postBuyBody,
      buyBodyLong: user.postBuyBodyLong,
      infoBarang: user.infoBarang,
      infoPengiriman: user.infoPengiriman,
      infoKeranjang: user.infoKeranjang,
      updateKeranjang: user.updateKeranjang,
      infoCheckoutQuick: user.infoCheckoutQuick,
      infoCheckoutLong: user.infoCheckoutLong
    }, { upsert: true }).exec()

  }));
}

const getCart = async function (ctx, getCache = false) {
  let user = ctx.session;
  user.config.start = Date.now();
  user.config.timestamp = Date.now();

  await postKeranjang(user, getCache).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    curl.close()
  }).catch((err) => err)

  await postInfoKeranjang(user, getCache).then(({ statusCode, body, headers, curlInstance, curl }) => {
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    let chunk = typeof body == 'string' ? JSON.parse(body) : body;
    if (chunk.data.shop_orders.length > 0) {
      user.infoKeranjang = chunk
      user.infoKeranjang.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
      user.infoKeranjang.now = Date.now()
    } else sendReportToDev(ctx, JSON.stringify(chunk, null, "\t"), 'postInfoKeranjang')
    curl.close()
  }).catch((err) => err)

  user.selectedShop = function (shops) {
    for (const shop of shops) if (shop.shop.shopid == user.config.shopid) return shop
  }(user.infoKeranjang.data.shop_orders) || user.selectedShop || user.infoKeranjang.data.shop_orders[0]

  user.selectedItem = function (items) {
    for (const item of items) {
      if (item.modelid == user.config.modelid) return item
      if (item.models) {
        for (const model of item.models) {
          if (
            model.itemid == user.config.itemid &&
            model.shop_id == user.config.shopid &&
            model.modelid == user.config.modelid
          ) return item
        }
      }
    }
  }(user.selectedShop.items) || user.selectedItem || user.selectedShop.items[0]

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
    let chunk = typeof body == 'string' ? JSON.parse(body) : body;
    if (chunk.data && chunk.error == 0) {
      user.updateKeranjang = chunk
      user.updateKeranjang.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
      user.updateKeranjang.now = Date.now()
    } else sendReportToDev(ctx, JSON.stringify(chunk, null, "\t"), 'postUpdateKeranjang')
    curl.close()
  }).catch((err) => err)

  return getCheckout(ctx, getCache);
}

const getCheckout = async function (ctx, getCache) {
  let user = ctx.session;

  postInfoCheckout(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    let chunk = typeof body == 'string' ? JSON.parse(body) : body;
    if (chunk.shoporders) {
      user.config.infoCheckoutLong = chunk
      user.config.infoCheckoutLong.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
      user.config.infoCheckoutLong.now = Date.now()
    } else sendReportToDev(ctx, JSON.stringify(chunk, null, "\t"), 'postInfoCheckout')
    curl.close()
  }).catch((err) => err)

  await postInfoCheckoutQuick(user, getCache).then(({ statusCode, body, headers, curlInstance, curl }) => {
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    let chunk = typeof body == 'string' ? JSON.parse(body) : body;
    if (chunk.shoporders) {
      user.infoCheckoutQuick = chunk
      user.infoCheckoutQuick.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
      user.infoCheckoutQuick.now = Date.now()
    } else sendReportToDev(ctx, JSON.stringify(chunk, null, "\t"), 'postInfoCheckoutQuick')
    curl.close()
  }).catch((err) => err)

  return getCache ? waitUntil(user.config, 'infoCheckoutLong', function (resolve, reject) {
    return waitUntil(user, 'updateKeranjang').then(() => resolve()).catch((err) => reject(err));
  }).then(async () => {
    user.infoCheckoutLong = user.config.infoCheckoutLong
    delete user.config.infoCheckoutLong

    await postUpdateKeranjang(user, 2).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      curl.close()
      user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    }).catch((err) => err);

    user.payment = require('./helpers/paymentMethod')(user, user.infoCheckoutLong.payment_channel_info.channels, true)

    await Log.updateOne({
      teleChatId: ctx.message.chat.id,
      itemid: user.config.itemid,
      shopid: user.config.shopid,
      modelid: user.config.modelid
    }, {
      buyBody: user.postBuyBody,
      buyBodyLong: user.postBuyBodyLong,
      infoKeranjang: user.infoKeranjang,
      updateKeranjang: user.updateKeranjang,
      infoCheckoutQuick: user.infoCheckoutQuick,
      infoCheckoutLong: user.infoCheckoutLong,
      payment: user.payment,
      selectedShop: user.selectedShop,
      selectedItem: user.selectedItem
    }, { upsert: true }).exec()

    return `${ensureRole(ctx, true) ? `Cache Produk Telah Di Dapatkan` : null}`
  }).catch(async (err) => {
    return sendReportToDev(ctx, err, 'Error', () => {
      return postUpdateKeranjang(user, 2).then(({ statusCode, body, headers, curlInstance, curl }) => {
        curl.close()
        user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
      }).catch((err) => err);
    })
  }) : !user.config.repeat ? buyItem(ctx) : buyRepeat(ctx);
}

const buyItem = function (ctx) {
  let user = ctx.session;

  return postBuy(user).then(async ({ statusCode, body, headers, curlInstance, curl, err }) => {
    if (err) return err;

    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    user.order = typeof body == 'string' ? JSON.parse(body) : body;
    user.order.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
    curl.close()

    let info = `Detail Informasi : `

    // if (ensureRole(ctx, true)) {
    //   info += `${user.keranjang ? `\nPostKeranjang : ${user.keranjang.time} ms..` : ''}`
    //   info += `${user.infoKeranjang ? `\nPostInfoKeranjang : ${user.infoKeranjang.time} ms..` : ''}`
    //   info += `${user.updateKeranjang ? `\nPostUpdateKeranjang : ${user.updateKeranjang.time} ms..` : ''}`
    //   info += `${user.infoCheckoutQuick ? `\nPostInfoCheckoutQuick : ${user.infoCheckoutQuick.time} ms..` : ''}`
    //   info += `${user.infoCheckoutLong ? `\nPostInfoCheckoutLong : ${user.infoCheckoutLong.time} ms..` : ''}`
    //   info += `${user.order ? `\nPostBuy : ${user.order.time} ms..` : ''}`
    // }

    info += `\n\nMetode Pembayaran : ${user.payment.msg}`
    info += `\n\nBot Start : <b>${timeConverter(user.config.start, { usemilis: true })}</b>`
    info += `\nCheckout : <b>${timeConverter(user.config.checkout, { usemilis: true })}</b>`
    info += `\nBot End : <b>${timeConverter(Date.now(), { usemilis: true })}</b>`

    if (user.order.error) {
      user.config.fail = user.config.fail + 1
      info += `\n\n<i>Gagal Melakukan Payment Barang <b>(${user.selectedItem.name.replace(/<[^>]*>?/gm, "")})</b>\n${user.order.error_msg}</i>\n${ensureRole(ctx, true) ? user.order.error : ''}`

      // if (user.config.fail < 3 && ['error_fulfillment_info_changed_mwh'].includes(user.order.error) && !user.config.repeat) {
      //   user.config.info.push(info)
      //   return buyItem(ctx)
      // }

      await postUpdateKeranjang(user, 2).then(({ statusCode, body, headers, curlInstance, curl }) => {
        curl.close()
        user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
        info += `\n\nBarang <b>(${user.selectedItem.name.replace(/<[^>]*>?/gm, "")})</b> Telah Telah Di Hapus Dari Keranjang`
      }).catch((err) => sendReportToDev(ctx, err));

    } else {
      user.config.fail = 0
      user.config.success = true
      info += `\n\n<i>Barang <b>(${user.selectedItem.name.replace(/<[^>]*>?/gm, "")})</b> Berhasil Di Pesan</i>`

      await Log.updateOne({
        teleChatId: ctx.message.chat.id,
        itemid: user.config.itemid,
        shopid: user.config.shopid,
        modelid: user.config.modelid
      }, {
        buyBody: user.postBuyBody,
        buyBodyLong: user.postBuyBodyLong,
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
    await postBuy(user, user.config.repeat)
      .then(({ statusCode, body, headers, curlInstance, curl, err }) => console.error(chalk.red(err)))
      .catch((err) => sleep(1));
  } while (Date.now() - user.config.checkout < 10);

  sleep(590);

  const order = function () {
    if (!user.order) {
      await waitUntil(user.config, 'infoCheckoutLong', Math.max(900 - (Date.now() - user.config.start), 0))
        .then(() => delete user.postBuyBodyLong).catch((err) => sendReportToDev(ctx, err));
      return buyItem(ctx)
    }

    await Log.updateOne({
      teleChatId: ctx.message.chat.id,
      itemid: user.config.itemid,
      shopid: user.config.shopid,
      modelid: user.config.modelid
    }, {
      buyBody: user.postBuyBody,
      buyBodyLong: user.postBuyBodyLong,
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
  }

  if (user.payment.method.payment_channelid) {
    return getOrders(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      curl.close()
      user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
      if (!body) return sendReportToDev(ctx, 'Body buyRepeat Kosong', 'Error')

      let info = `Detail Informasi : `

      info += `\n\nMetode Pembayaran : ${user.payment.msg}`
      info += `\n\nBot Start : <b>${timeConverter(user.config.start, { usemilis: true })}</b>`
      info += `\nCheckout : <b>${timeConverter(user.config.checkout, { usemilis: true })}</b>`
      info += `\nBot End : <b>${timeConverter(Date.now(), { usemilis: true })}</b>`

      for (const orders of (typeof body == 'string' ? JSON.parse(body) : body).orders) {
        if (
          Math.floor(user.config.end / 1000) - orders.mtime < 5 &&
          orders.extinfo.first_itemid == user.config.itemid &&
          orders.extinfo.modelid == user.config.modelid &&
          orders.shopid == user.config.shopid
        ) {
          user.order = orders;
          user.config.success = true
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

      return order()
    }).catch((err) => sendReportToDev(ctx, err));
  }

  return getCheckouts(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    curl.close()
    user.userCookie = setNewCookie(user.userCookie, headers['set-cookie'])
    if (!body) return sendReportToDev(ctx, 'Body buyRepeat Kosong', 'Error')

    let info = `Detail Informasi : `

    info += `\n\nMetode Pembayaran : ${user.payment.msg}`

    info += `\n\nBot Start : <b>${timeConverter(user.config.start, { usemilis: true })}</b>`
    info += `\nCheckout : <b>${timeConverter(user.config.checkout, { usemilis: true })}</b>`
    info += `\nBot End : <b>${timeConverter(Date.now(), { usemilis: true })}</b>`

    for (const checkouts of (typeof body == 'string' ? JSON.parse(body) : body).checkouts) {
      for (const orders of checkouts.orders) {
        if (
          Math.floor(user.config.end / 1000) - orders.mtime < 5 &&
          orders.extinfo.first_itemid == user.config.itemid &&
          orders.extinfo.modelid == user.config.modelid &&
          orders.shopid == user.config.shopid
        ) {
          user.order = orders;
          user.config.success = true
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

    return order()
  }).catch((err) => sendReportToDev(ctx, err));
}

bot.command('restart', async (ctx) => {
  if (!ensureRole(ctx)) return
  process.exit(1);
})

bot.command((ctx) => {
  let user = ctx.session;
  user.commands = splitAtFirstSpace(ctx.message.text)
  if (user.commands.length < 2) return ctx.reply(`/(user) <code>...message...</code>`, { parse_mode: 'HTML' })
  User.findOne(function (userData) {
    if (Number.isInteger(parseInt(userData))) return { teleChatId: userData }
    return { 'teleChatData.username': userData }
  }(user.commands[0].substring(1)), function (err, u) {
    if (err || !u) return
    return ctx.reply(`<code>${`@${ctx.message.chat.username}` || ctx.message.chat.first_name} : ${user.commands[1].replace(/(<([^>]+)>)/gi, "")}</code>`, { chat_id: u.teleChatId, parse_mode: 'HTML' })
  })
})

bot.catch((err, ctx) => sendReportToDev(ctx, err, () => process.exit(1)))

bot.launch()