const url = require('url');

const getAddress = require('../request/other/getAddress');
const getInfoBarang = require('../request/buy/getInfoBarang');
const getInfoPengiriman = require('../request/other/getInfoPengiriman');

const User = require('../models/User');
const Other = require('../models/Other');
const Log = require('../models/Log');

const getCart = require('../helpers/getCart');

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

module.exports = async function (ctx) {
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
  if (user.queue.length > 0) return ctx.telegram.deleteMessage(user.config.message.chatId, user.config.message.msgId)

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
      cache: user.commands['-cache'] ? ensureRole(ctx, false, [1]) : false,
      predictPrice: user.commands.price ? parseInt(user.commands.price) * 100000 : false,
      flashSale: false,
      fail: 0,
      success: false,
      outstock: false,
      info: []
    }
  }

  if (user.commands['-premium'] ? ensureRole(ctx, true, [1, 2, 3]) : false) {
    user.config.cache = true;
    await replaceMessage(ctx, user.config.message, 'Fitur Premium Terpasang')
  }

  if (user.commands['-vip'] ? ensureRole(ctx, true, [1, 2]) : false) {
    user.config.cache = true;
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
      teleBotId: process.env.BOT_ID,
      teleChatId: ctx.message.chat.id,
      itemid: user.config.itemid,
      status: true
    }, async function (err, log) {
      if (err || !log) return ensureRole(ctx, true) ? replaceMessage(ctx, user.config.message, 'Cache Untuk Produk Ini Tidak Tersedia!!') : null
      log = JSON.parse(JSON.stringify(log))
      for (const key in log) {
        if (Object.hasOwnProperty.call(log, key) && typeof log[key] == 'object') user[key] = log[key]
      }
    })
  }

  user.payment = require('../helpers/paymentMethod')(user, user.other.metaPayment.channels)

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
        curl.close();
        setNewCookie(user.userCookie, headers['set-cookie'])
        let chunk = typeof body == 'string' ? JSON.parse(body) : body;
        if (chunk.error != null) {
          user.config.start = false
        } else {
          user.infoBarang = chunk;
        }
      }).catch((err) => {
        user.config.start = false
        return err;
      });

      if (!user.infoBarang || !user.config.start) continue;
      if (user.infoBarang.item.upcoming_flash_sale || user.infoBarang.item.flash_sale) user.config.flashSale = true;
      user.config.promotionid = (user.infoBarang.item.flash_sale ? user.other.promotionId[0] : user.other.promotionId[1])
      if (!user.infoBarang.item.upcoming_flash_sale || user.config.skiptimer) break;

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

    } while (!user.config.skiptimer)

    await getInfoPengiriman(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
      curl.close()
      setNewCookie(user.userCookie, headers['set-cookie'])
      user.infoPengiriman = typeof body == 'string' ? JSON.parse(body) : body;
    }).catch((err) => sendReportToDev(ctx, new Error(err)));

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

    if (!user.config.modelid) {
      User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, {
        userCookie: user.userCookie,
        queue: false
      }).exec()
      return replaceMessage(ctx, user.config.message, `Semua Stok Barang Sudah Habis`)
    }

    if (user.config.cache && user.infoBarang.item.stock > 0) {
      let info = await getCart(ctx, true)
      if (typeof info == 'string') replaceMessage(ctx, user.config.message, info)
    }

    if (await User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id, queue: false })) {
      return replaceMessage(ctx, user.config.message, `Timer${user.infoBarang ? ` Untuk Barang ${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")}` : ''} - ${user.payment.msg} - Sudah Di Matikan`)
    }

    while ((user.config.end > Date.now()) || ((Date.now() % 1000).toFixed(0) > 100)) continue;

    let info = await getCart(ctx)
    if (typeof info == 'string') await replaceMessage(ctx, user.config.message, info, false)

    await Log.updateOne({
      teleBotId: process.env.BOT_ID,
      teleChatId: ctx.message.chat.id,
      itemid: user.config.itemid,
      modelid: user.config.modelid
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

  }).catch((err) => sendReportToDev(ctx, new Error(err)).then((result) => {
    return Log.updateOne({
      teleBotId: process.env.BOT_ID,
      teleChatId: ctx.message.chat.id,
      itemid: user.config.itemid,
      modelid: user.config.modelid
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
  }).catch((err) => sendReportToDev(ctx, new Error(err))));
}