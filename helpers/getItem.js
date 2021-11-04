const puppeteer = require('puppeteer');

const getAddress = require('../request/other/getAddress');
const getInfoBarang = require('../request/buy/getInfoBarang');
const getInfoPengiriman = require('../request/other/getInfoPengiriman');

const User = require('../models/User');
const Log = require('../models/Log');
const Event = require('../models/Event');
const FlashSale = require('../models/FlashSale');

const getCart = require('./getCart');

const { sendReportToDev, setNewCookie, timeConverter, parseShopeeUrl, paymentMethod, sendMessage, replaceMessage, ensureRole, sleep } = require('./index')

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
            return tansferPrioritys.sort((index, transfer) => index == user.commands.transfer ? -1 : transfer == user.commands.transfer ? 1 : 0)
          } else {
            return tansferPrioritys
          }
        }(['bni', 'bri', 'bca', 'mandiri', 'bsi', 'permata'])
      },
      skip: user.commands['-skip'] || false,
      cancel: user.commands['-cancel'] || false,
      cache: user.commands['-cache'] ? ensureRole(ctx, false) : false,
      predictPrice: user.commands.price ? parseInt(user.commands.price) * 100000 : false,
      success: false,
      fail: 0
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

  user.payment = paymentMethod(user, user.metaPayment.channels)

  return getAddress(ctx).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    curl.close()
    setNewCookie(user.userCookie, headers['set-cookie'])
    user.address = typeof body == 'string' ? JSON.parse(body) : body;
    if (user.address.error) return replaceMessage(ctx, user.config.message, 'Sesi Anda Sudah Habis Silahkan Login Kembali')
    user.address = function (addresses) {
      for (const address of addresses) {
        return address
      }
    }(user.address.addresses)

    user.browser = await puppeteer.launch({
      headless: true,
      defaultViewport: null,
      args: ['--start-maximized']
    })

    await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { queue: true }).exec()

    do {
      user.config.start = Date.now()

      if (await User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id, queue: false })) {
        await browser.close()
        return ctx.telegram.deleteMessage(user.config.message.chatId, user.config.message.msgId)
      }

      await getInfoBarang(ctx).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
        setNewCookie(user.userCookie, headers['set-cookie'])
        let chunk = typeof body == 'string' ? JSON.parse(body) : body;
        if (chunk.error == null) {
          user.infoBarangTemp = chunk;
        }
        curl.close();
      }).catch((err) => err);

      if (!user.infoBarangTemp) continue;
      user.infoBarang = user.infoBarangTemp
      delete user.infoBarangTemp

      user.config.promotionid = (user.infoBarang.item.flash_sale ? user.flashsale[0].promotionid : user.flashsale[1].promotionid)

      user.config.modelid = user.infoBarang.item.upcoming_flash_sale ? user.infoBarang.item.upcoming_flash_sale.modelids[0] : function (barang) {
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

      // if (user.infoBarang.item.stock > 1 && Math.floor(Date.now() / 1000) % 10 == 0) {
      if (user.infoBarang.item.stock > 1) {
        // const [page] = await user.browser.pages();
        const page = await user.browser.newPage();
        await page.setUserAgent(process.env.USER_AGENT)
        await getCart(ctx, page)
      }

      let msg = timeConverter(Date.now() - user.config.end, { countdown: true })
      msg += ` - ${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")} - ${user.payment.msg}`

      if (!user.infoBarang.item.upcoming_flash_sale || user.config.skip) break;

      if (!user.config.end) {
        user.config.end = parseInt(user.infoBarang.item.upcoming_flash_sale.start_time) * 1000
      }

      if (user.config.end < Date.now() + 5000) break;

      await replaceMessage(ctx, user.config.message, msg)
      // await sleep(ensureRole(ctx, true) ? 0 : (200 * (await User.find({ teleBotId: process.env.BOT_ID, queue: true })).length) - (Date.now() - user.config.start))
      await sleep(1000 - (Date.now() - user.config.start))

    } while (!user.config.skip)

    await user.browser.close()

    if (!user.config.modelid) {
      User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, {
        userCookie: user.userCookie,
        queue: false
      }).exec()
      return replaceMessage(ctx, user.config.message, `Semua Stok Barang Sudah Habis`)
    }

    if (await User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id, queue: false })) {
      return ctx.telegram.deleteMessage(user.config.message.chatId, user.config.message.msgId)
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
      infoKeranjang: user.infoKeranjang,
      updateKeranjang: user.updateKeranjang,
      infoCheckout: user.infoCheckout,
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