const psl = require('psl');
const puppeteer = require('puppeteer');

const getAddress = require('../request/other/getAddress');
const getInfoBarang = require('../request/buy/getInfoBarang');
const postKeranjang = require('../request/buy/postKeranjang');
const postUpdateKeranjang = require('../request/buy/postUpdateKeranjang');
const postCancel = require('../request/other/postCancel');

const User = require('../models/User');
const FlashSale = require('../models/FlashSale');

const { sendReportToDev, setNewCookie, timeConverter, parseShopeeUrl, sendMessage, replaceMessage, sleep, checkAccount, getCommands, objectSize, isValidURL, extractRootDomain, addDots } = require('../helpers')

module.exports = async function (ctx) {
  let user = ctx.session
  user.commands = getCommands(ctx.message.text)
  if (objectSize(user.commands) < 1) return ctx.reply(`/beli <code>url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`, { parse_mode: 'HTML' })

  if (user.commands['-stop']) {
    return User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { queue: false }).exec()
  }

  await ctx.reply(`Memuat... <code>${user.commands.url}</code>`, { parse_mode: 'HTML' }).then((replyCtx) => {
    user.message = {
      chatId: replyCtx.chat.id,
      msgId: replyCtx.message_id,
      inlineMsgId: replyCtx.inline_message_id,
      text: replyCtx.text
    }
  })

  if (!checkAccount(ctx) || !isValidURL(user.commands.url)) return replaceMessage(ctx, user.message, 'Format Url Salah / Anda Belum Login')
  if (psl.get(extractRootDomain(user.commands.url)) != 'shopee.co.id') return replaceMessage(ctx, user.message, 'Bukan Url Dari Shopee')
  if (user.commands['-cod'] && user.commands['-shopeepay']) return replaceMessage(ctx, user.message, 'Silahkan Pilih Hanya Salah Satu Metode Pembayaran')

  if (user.queue) {
    return replaceMessage(ctx, user.message, 'Hanya Bisa Mendaftarkan 1 Produk Dalam Antrian!!')
  }

  let { itemid, shopid, err } = parseShopeeUrl(user.commands.url)
  if (err) return sendMessage(ctx, err)
  user.itemid = itemid
  user.shopid = shopid

  if (user.queue.length > 0) return ctx.telegram.deleteMessage(user.message.chatId, user.message.msgId)

  user.flashsale = await FlashSale.find({ teleBotId: process.env.BOT_ID })

  user.quantity = parseInt(user.commands.qty) || 1
  user.url = user.commands.url
  user.skip = user.commands['-skip'] || false
  user.cancel = user.commands['-cancel'] || false
  user.price = user.commands.price ? parseInt(user.commands.price) * 100000 : false

  const browser = await puppeteer.launch({
    headless: false,
    ignoreHTTPSErrors: true,
    defaultViewport: null,
    args: ['--start-maximized']
  })

  await getAddress(ctx).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    curl.close()
    setNewCookie(user.userCookie, headers['set-cookie'])
    user.address = typeof body == 'string' ? JSON.parse(body) : body;
    if (user.address.error) return replaceMessage(ctx, user.message, 'Sesi Anda Sudah Habis Silahkan Login Kembali')

    const [page] = await browser.pages();
    await page.setUserAgent(process.env.USER_AGENT)

    await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { queue: true }).exec()

    do {
      user.start = Date.now()

      if (await User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id, queue: false })) {
        return ctx.telegram.deleteMessage(user.message.chatId, user.message.msgId)
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

      user.promotionid = (user.infoBarang.item.flash_sale ? user.flashsale[0].promotionid : user.flashsale[1].promotionid)

      user.modelid = user.infoBarang.item.upcoming_flash_sale ? user.infoBarang.item.upcoming_flash_sale.modelids[0] : function (barang) {
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

      if (user.infoBarang.item.stock > 1 && (user.end ? Math.floor(Date.now() / 1000) % 10 == 0 : true)) {
        await getHope(ctx, page, true)
      }

      if (!user.infoBarang.item.upcoming_flash_sale || user.skip) break;

      if (!user.end) {
        user.end = parseInt(user.infoBarang.item.upcoming_flash_sale.start_time) * 1000
      }

      let msg = timeConverter(Date.now() - user.end, { countdown: true })
      msg += ` - ${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")}`

      if (user.end < Date.now() + 10000) break;

      await replaceMessage(ctx, user.message, msg)

      await sleep(1000 - (Date.now() - user.start))

    } while (!user.skip)

    if (!user.modelid) {
      await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { userCookie: user.userCookie, queue: false }).exec()
      return replaceMessage(ctx, user.message, `Semua Stok Barang Sudah Habis`)
    }

    if (await User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id, queue: false })) {
      return ctx.telegram.deleteMessage(user.message.chatId, user.message.msgId)
    }

    await replaceMessage(ctx, user.message, `Mulai Membeli Barang <code>${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")}</code>`, false)

    while ((user.end > Date.now()) || ((Date.now() % 1000).toFixed(0) > 100)) continue;

    await getHope(ctx, page)

  }).catch((err) => sendReportToDev(ctx, err));

  return browser.close()
}

const getHope = async function (ctx, page, cache) {
  let user = ctx.session
  user.start = Date.now();

  await postKeranjang(ctx).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    setNewCookie(user.userCookie, headers['set-cookie'])
    curl.close()
  }).catch((err) => sendReportToDev(ctx, err))

  const listRequest = [{
    name: 'infoKeranjang',
    url: 'https://shopee.co.id/api/v4/cart/get'
  }, {
    name: 'updateKeranjang',
    url: 'https://shopee.co.id/api/v4/cart/update'
  }, {
    name: 'checkout',
    url: 'https://shopee.co.id/api/v4/cart/checkout'
  }, {
    name: 'infoCheckout',
    url: 'https://shopee.co.id/api/v4/checkout/get'
  }, {
    name: 'order',
    url: 'https://shopee.co.id/api/v4/checkout/place_order'
  }]

  await page.setCookie(...Object.keys(user.userCookie).map((key) => {
    return {
      name: key,
      value: user.userCookie[key].value,
      url: 'https://shopee.co.id/',
      domain: user.userCookie[key].Domain || 'shopee.co.id',
    }
  }))

  await page.setRequestInterception(true)
  await page.setDefaultNavigationTimeout(0)

  page.on('request', async (request) => {
    if (!listRequest.map(e => e.url).includes(request.url()) || cache) return request.continue()

    const requestName = listRequest.find(e => e.url == request.url()).name;

    if (requestName == 'infoKeranjang') {

      for (const [shop_orders_index, shop_orders] of user[requestName].responseBody.data.shop_orders.entries()) {
        for (const [items_index, items] of shop_orders.items.entries()) {
          for (const [models_index, models] of items.models.entries()) {

            user[requestName].responseBody.data.shop_orders[shop_orders_index].shop.addin_time = Math.floor(user.start / 1000)
            user[requestName].responseBody.data.shop_orders[shop_orders_index].items[items_index].addin_time = Math.floor(user.start / 1000)

            user[requestName].responseBody.data.shop_orders[shop_orders_index].items[items_index].models[models_index].price = user.price
            user[requestName].responseBody.data.shop_orders[shop_orders_index].items[items_index].models[models_index].promotionid = user.promotionid

            user[requestName].responseBody.data.shop_orders[shop_orders_index].items[items_index].origin_cart_item_price = user.price
            user[requestName].responseBody.data.shop_orders[shop_orders_index].items[items_index].price = user.price

            user[requestName].responseBody.data.shop_orders[shop_orders_index].items[items_index].applied_promotion_id = user.promotionid
            user[requestName].responseBody.data.shop_orders[shop_orders_index].items[items_index].product_promotion_id = user.promotionid

          }
        }
      }

      for (const [shop_order_id_list_index, shop_order_id_list] of user[requestName].responseBody.data.shop_order_id_list.entries()) {
        user[requestName].responseBody.data.shop_order_id_list[shop_order_id_list_index].addin_time = Math.floor(user.start / 1000)
      }

    } else if (requestName == 'updateKeranjang') {
      for (const [shop_vouchers_index, shop_vouchers] of user[requestName].responseBody.data.shop_vouchers.entries()) {
        user[requestName].responseBody.data.shop_vouchers[shop_vouchers_index].promotionid = user.promotionid
      }

      for (const [total_payment_index, total_payment] of user[requestName].responseBody.data.total_payment.entries()) {
        user[requestName].responseBody.data.total_payment[total_payment_index] = user.price
      }
    } else if (requestName == 'checkout') {

    } else if (requestName == 'infoCheckout') {
      let shipping_orders = user[requestName].responseBody.shipping_orders[0]
      let checkout_price_data = user[requestName].responseBody.checkout_price_data
      let promotion_data = user[requestName].responseBody.promotion_data

      user[requestName].responseBody.timestamp = Math.floor(user.start / 1000)
      user[requestName].responseBody.checkout_price_data.merchandise_subtotal = user.price * user.quantity
      user[requestName].responseBody.checkout_price_data.total_payable = shipping_orders.shipping_fee + (user.price * user.quantity) + tax.value

      for (const [shoporders_index, shoporders] of user[requestName].responseBody.shoporders.entries()) {
        for (const [items_index, items] of shoporders.items.entries()) {
          user[requestName].responseBody.shoporders[shoporders_index].items[items_index].price = user.price
        }

        user[requestName].responseBody.shoporders[shoporders_index].order_total_without_shipping = user.price * user.quantity
        user[requestName].responseBody.shoporders[shoporders_index].order_total = shoporders.shipping_fee + (user.price * user.quantity)
      }

      for (const [shipping_orders_index, shipping_orders] of user[requestName].responseBody.shipping_orders.entries()) {
        user[requestName].responseBody.shipping_orders[shipping_orders_index].order_total_without_shipping = user.price * user.quantity
        user[requestName].responseBody.shipping_orders[shipping_orders_index].order_total = shipping_orders.shipping_fee + (user.price * user.quantity)

      }

      user[requestName].responseBody.dropshipping_info = {
        "enabled": false,
        "name": "",
        "phone_number": ""
      }

      user[requestName].responseBody.buyer_txn_fee_info = {
        "title": "Biaya Penanganan",
        "description": `Besar biaya penanganan adalah Rp ${addDots(parseInt(100000000) / 100000)} dari total transaksi.`,
        "learn_more_url": "https://shopee.co.id/events3/code/634289435/"
      }

      user[requestName].responseBody.disabled_checkout_info = {
        "description": "",
        "auto_popup": false,
        "error_infos": []
      }

      user[requestName].responseBody.can_checkout = true

    }

    return request.respond({
      status: user[requestName].responseStatus,
      headers: user[requestName].responseHeaders,
      body: JSON.stringify(user[requestName].responseBody)
    });
  })

  page.on('requestfinished', async (request) => {
    try {
      if (!listRequest.map(e => e.url).includes(request.url())) return;

      const response = await request.response();

      let responseBody;

      if (request.redirectChain().length === 0) {
        const buffer = await response.buffer();
        responseBody = buffer.toString('utf8');
      }

      user[listRequest.find(e => e.url == request.url()).name] = {
        url: request.url(),
        responseStatus: response.status(),
        responseHeaders: response.headers(),
        responseBody: JSON.parse(responseBody),
      }

    } catch (err) {
      await sendReportToDev(ctx, err.message)
    }
  });

  await page.goto(`https://shopee.co.id/cart?itemKeys=${user.itemid}.${user.modelid}.&shopId=${user.shopid}`, { timeout: 0 })
  await page.waitForSelector('._2jol0L .W2HjBQ button span')
  await page.click('._2jol0L .W2HjBQ button span')
  await page.waitForSelector('.bank-transfer-category__body')

  if (cache) {
    user.selectedShop = function (shops) {
      for (const shop of shops) if (shop.shop.shopid == user.shopid) return shop
    }(user.infoKeranjang.responseBody.data.shop_orders) || user.selectedShop || user.infoKeranjang.responseBody.data.shop_orders[0]

    user.selectedItem = function (items) {
      for (const item of items) {
        if (item.modelid == user.modelid) return item
        if (item.models) {
          for (const model of item.models) {
            if (
              model.itemid == user.itemid &&
              model.shop_id == user.shopid &&
              model.modelid == user.modelid
            ) return item
          }
        }
      }
    }(user.selectedShop.items) || user.selectedItem || user.selectedShop.items[0]

    user.price = user.price || function (item) {
      if (item.models) {
        for (const model of item.models) {
          if (
            model.itemid == user.itemid &&
            model.shop_id == user.shopid &&
            model.modelid == user.modelid &&
            model.promotionid == user.promotionid
          ) return model.price
        }
      }
      return item.origin_cart_item_price
    }(user.selectedItem) || user.price

    for (const cookie of await page.cookies('https://shopee.co.id')) {
      user.userCookie[cookie.name] = {
        value: cookie.value,
        Domain: cookie.domain,
        Path: cookie.path,
        expires: cookie.expires,
        size: cookie.size,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        session: cookie.session,
        sameParty: cookie.sameParty,
        sourceScheme: cookie.sourceScheme,
        sourcePort: cookie.sourcePort
      }
    }

    return postUpdateKeranjang(ctx, 2).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      setNewCookie(user.userCookie, headers['set-cookie'])
      let chunk = typeof body == 'string' ? JSON.parse(body) : body;
      if (chunk.error != 0) sendReportToDev(ctx, new Error(JSON.stringify(chunk, null, 2)))
      curl.close()
    }).catch((err) => console.error(chalk.red(err)))

  }

  await page.click('._1WlhIE .PC1-mc button')
  user.end = Date.now();
  // await page.waitForSelector('.payment-safe-page')
  await page.waitFor(5000)

  let info = `\n\nBot Start : <b>${timeConverter(user.start, { usemilis: true })}</b>`
  info += `\nBot End : <b>${timeConverter(user.end, { usemilis: true })}</b>`

  if (user.order.error) {
    info += `\n\n<i>Gagal Melakukan Order Barang <b>(${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")})</b>\n${user.order.error_msg}</i>\n${ensureRole(ctx, true) ? user.order.error : null}`

    await postUpdateKeranjang(ctx, 2).then(({ statusCode, body, headers, curlInstance, curl }) => {
      setNewCookie(user.userCookie, headers['set-cookie'])
      info += `\n\nBarang <b>(${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")})</b> Telah Telah Di Hapus Dari Keranjang`
      curl.close()
    }).catch((err) => sendReportToDev(ctx, err));

  } else {
    info += `\n\n<i>Barang <b>(${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")})</b> Berhasil Di Pesan</i>`

    if (user.cancel) {
      await postCancel(ctx).then(({ statusCode, body, headers, curlInstance, curl }) => {
        setNewCookie(user.userCookie, headers['set-cookie'])
        info += `\n\nAuto Cancel Barang (${user.infoBarang.item.name}) Berhasil`
        curl.close()
      }).catch((err) => sendReportToDev(ctx, err));
    }
  }

  await replaceMessage(ctx, user.message, info, false)

  await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { userCookie: user.userCookie, queue: false }).exec()
}