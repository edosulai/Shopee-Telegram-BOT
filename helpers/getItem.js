const getAddress = require('../request/other/getAddress');
const getInfoBarang = require('../request/buy/getInfoBarang');
const getInfoPengiriman = require('../request/other/getInfoPengiriman');

const User = require('../models/User');
const Log = require('../models/Log');
const Event = require('../models/Event');
const FlashSale = require('../models/FlashSale');

const getCart = require('./getCart');
const parseShopeeUrl = require('./parseShopeeUrl');

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('./index'))

module.exports = async function (ctx) {
  let user = ctx.session

  let { itemid, shopid, err } = parseShopeeUrl(user.commands.url)
  if (err) return sendMessage(ctx, err)
  user.config.itemid = itemid
  user.config.shopid = shopid

  if (user.queue.length > 0) return ctx.telegram.deleteMessage(user.config.message.chatId, user.config.message.msgId)

  user.flashsale = await FlashSale.find({ teleBotId: process.env.BOT_ID })

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
      cache: user.commands['-cache'] ? ensureRole(ctx, false) : false,
      predictPrice: user.commands.price ? parseInt(user.commands.price) * 100000 : false,
      flashSale: false,
      notHaveCache: true,
      success: false,
      fail: 0,
      info: []
    }
  }

  if (user.commands['-vip'] ? ensureRole(ctx, true, [1, 2]) : false) {
    user.config.cache = true;
    let event = await Event.findOne({ teleBotId: process.env.BOT_ID, itemid: user.config.itemid, shopid: user.config.shopid })
    if (event) {
      user.config.predictPrice = parseInt(event.price) * 100000
      await replaceMessage(ctx, user.config.message, 'Fitur VIP Terpasang')
    }
  }

  if (user.config.cache) {
    await Log.findOne({
      teleBotId: process.env.BOT_ID,
      teleChatId: ctx.message.chat.id,
      itemid: user.config.itemid,
      shopid: user.config.shopid,
      status: true
    }, async function (err, log) {
      if (err || !log) return ensureRole(ctx, true) ? replaceMessage(ctx, user.config.message, 'Cache Untuk Produk Ini Tidak Tersedia!!') : null
      log = JSON.parse(JSON.stringify(log))
      for (const key in log) {
        if (Object.hasOwnProperty.call(log, key) && typeof log[key] == 'object') user[key] = log[key]
      }
    })
  }

  user.payment = require('../helpers/paymentMethod')(user, user.metaPayment.channels)

  return getAddress(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    curl.close()
    setNewCookie(user.userCookie, headers['set-cookie'])
    user.address = typeof body == 'string' ? JSON.parse(body) : body;
    if (user.address.error) return replaceMessage(ctx, user.config.message, 'Sesi Anda Sudah Habis Silahkan Login Kembali')
    user.address = function (addresses) {
      for (const address of addresses) {
        return address
      }
    }(user.address.addresses)

    await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { queue: true }).exec()
    if (user.config.cache) user.config.firstCache = true

    do {
      user.config.start = Date.now()

      if (await User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id, queue: false })) {
        return replaceMessage(ctx, user.config.message, `Timer${user.infoBarang ? ` Untuk Barang ${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")}` : ''} - ${user.payment.msg} - Sudah Di Matikan`)
      }

      await getInfoBarang(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
        setNewCookie(user.userCookie, headers['set-cookie'])
        let chunk = typeof body == 'string' ? JSON.parse(body) : body;
        if (chunk.error == null) {
          user.infoBarang = chunk;
        } else {
          user.config.start = false
        }
        curl.close();
      }).catch((err) => user.config.start = false);

      if (!user.infoBarang || !user.config.start) continue;
      if (user.infoBarang.item.upcoming_flash_sale || user.infoBarang.item.flash_sale) user.config.flashSale = true;
      user.config.promotionid = (user.infoBarang.item.flash_sale ? user.flashsale[0].promotionid : user.flashsale[1].promotionid)
      if (!user.infoBarang.item.upcoming_flash_sale || user.config.skiptimer) break;

      user.config.modelid = parseInt(user.infoBarang.item.upcoming_flash_sale.modelids[0])
      user.config.end = user.infoBarang.item.upcoming_flash_sale.start_time * 1000

      if (user.config.end < Date.now() + 10000) break;

      let msg = ``
      msg += timeConverter(Date.now() - user.config.end, { countdown: true })
      msg += ` - ${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")} - ${user.payment.msg}`

      if (user.infoBarang.item.stock < 1) {
        user.config.notHaveCache = true
        msg += ` - Barang Sudah Di Ikat Untuk Flash Sale${function (barang) {
          for (const model of barang.item.models) {
            for (const stock of model.price_stocks) {
              if (stock.stockout_time) return ` Sejak : ${timeConverter(stock.stockout_time * 1000, { usemilis: false })}`
            }
          }
        }(user.infoBarang)}`
      } else if (user.config.notHaveCache) await getCart(ctx, true)

      await replaceMessage(ctx, user.config.message, msg)
      // await sleep(ensureRole(ctx, true) ? 0 : (200 * (await User.find({ teleBotId: process.env.BOT_ID, queue: true })).length) - (Date.now() - user.config.start))
      sleep(500 - (Date.now() - user.start))

    } while (!user.config.skiptimer)

    await getInfoPengiriman(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
      setNewCookie(user.userCookie, headers['set-cookie'])
      user.infoPengiriman = typeof body == 'string' ? JSON.parse(body) : body;
      curl.close()
    }).catch((err) => sendReportToDev(ctx, new Error(err)));

    if (!user.config.modelid) {
      user.config.modelid = function (barang) {
        for (const model of barang.item.models) {
          if (!barang.item.flash_sale) break;
          if (model.stock < 1 || model.price_stocks.length < 1) continue
          for (const stock of model.price_stocks) {
            if (user.flashsale[0].promotionid == stock.promotion_id) return stock.model_id
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

    if (!user.config.modelid) {
      User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, {
        userCookie: user.userCookie,
        queue: false
      }).exec()
      return replaceMessage(ctx, user.config.message, `Semua Stok Barang Sudah Habis`)
    }

    if (user.config.cache && user.infoBarang.item.stock > 0) await getCart(ctx, true)

    if (await User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id, queue: false })) {
      return replaceMessage(ctx, user.config.message, `Timer${user.infoBarang ? ` Untuk Barang ${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")}` : ''} - ${user.payment.msg} - Sudah Di Matikan`)
    }

    await replaceMessage(ctx, user.config.message, `Mulai Membeli Barang ${user.infoBarang ? `<code>${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")}</code>` : ''}`, false)
    while ((user.config.end > Date.now()) || ((Date.now() % 1000).toFixed(0) > 100)) continue;

    let info = await getCart(ctx)
    if (typeof info == 'string') await replaceMessage(ctx, user.config.message, info, false)

    await Log.updateOne({
      teleBotId: process.env.BOT_ID,
      teleChatId: ctx.message.chat.id,
      itemid: user.config.itemid,
      modelid: user.config.modelid,
      shopid: user.config.shopid
    }, {
      status: user.config.success,
      buyBody: user.postBuyBody,
      buyBodyLong: user.postBuyBodyLong,
      infoPengiriman: user.infoPengiriman,
      infoKeranjang: user.infoKeranjang,
      updateKeranjang: user.updateKeranjang,
      infoCheckoutQuick: user.infoCheckoutQuick,
      infoCheckoutLong: user.infoCheckoutLong,
      payment: user.payment,
      selectedShop: user.selectedShop,
      selectedItem: user.selectedItem
    }, { upsert: true }).exec()

    return User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, {
      userCookie: user.userCookie,
      queue: false
    }).exec()

  }).catch((err) => sendReportToDev(ctx, new Error(err)));
}