const psl = require('psl');
const puppeteer = require('puppeteer');

const Address = require('../request/other/Address');
const InfoBarang = require('../request/buy/InfoBarang');
const Keranjang = require('../request/buy/Keranjang');
const UpdateKeranjang = require('../request/buy/UpdateKeranjang');
const Cancel = require('../request/other/Cancel');

const User = require('../models/User');
const Log = require('../models/Log');
const FlashSale = require('../models/FlashSale');

const { logReport, setNewCookie, timeConverter, parseShopeeUrl, sendMessage, replaceMessage, sleep, checkAccount, getCommands, objectSize, isValidURL, extractRootDomain, addDots, ensureRole } = require('../helpers')

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
  user.quantity = parseInt(user.commands.qty) || 1
  user.url = user.commands.url
  user.skip = user.commands['-skip'] || false
  user.cancel = user.commands['-cancel'] || false
  user.predict = user.commands.price ? parseInt(user.commands.price) * 100000 : false
  user.payment = user.commands.payment ? paymentMethod[user.commands.payment.toUpperCase()] : paymentMethod.BNI

  await Log.findOne({
    teleBotId: process.env.BOT_ID,
    teleChatId: ctx.message.chat.id,
    itemid: user.itemid,
    shopid: user.shopid,
  }, async function (err, log) {
    if (!err && log) {
      log = JSON.parse(JSON.stringify(log))
      for (const key in log) {
        if (Object.hasOwnProperty.call(log, key) && typeof log[key] == 'object') user[key] = log[key]
      }
    }
  })

  const browser = await puppeteer.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    defaultViewport: null,
    // userDataDir: './temp',
    args: [
      // '--autoplay-policy=user-gesture-required',
      // '--disable-background-networking',
      // '--disable-background-timer-throttling',
      // '--disable-backgrounding-occluded-windows',
      // '--disable-breakpad',
      // '--disable-client-side-phishing-detection',
      // '--disable-component-update',
      // '--disable-default-apps',
      // '--disable-dev-shm-usage',
      // '--disable-domain-reliability',
      // '--disable-extensions',
      // '--disable-features=AudioServiceOutOfProcess',
      // '--disable-hang-monitor',
      // '--disable-ipc-flooding-protection',
      // '--disable-notifications',
      // '--disable-offer-store-unmasked-wallet-cards',
      // '--disable-popup-blocking',
      // '--disable-print-preview',
      // '--disable-prompt-on-repost',
      // '--disable-renderer-backgrounding',
      // '--disable-setuid-sandbox',
      // '--disable-speech-api',
      // '--disable-sync',
      // '--hide-scrollbars',
      // '--ignore-gpu-blacklist',
      // '--metrics-recording-only',
      // '--mute-audio',
      // '--no-default-browser-check',
      // '--no-first-run',
      // '--no-pings',
      // '--no-zygote',
      // '--password-store=basic',
      // '--use-gl=swiftshader',
      // '--use-mock-keychain',
      '--no-sandbox',
      '--start-maximized'
    ]
  })

  await Address(ctx).then(async ({ statusCode, data, headers }) => {
    setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
    user.address = typeof data == 'string' ? JSON.parse(data) : data;
    if (user.address.error) return replaceMessage(ctx, user.message, 'Sesi Anda Sudah Habis Silahkan Login Kembali')

    const [page] = await browser.pages();
    await page.setUserAgent(process.env.USER_AGENT)

    page.on('console', msg => {
      for (let i = 0; i < msg.args.length; ++i) console.log(`${i}: ${msg.args[i]}`);
    });

    await page.setCookie(...Object.keys(user.userCookie).map((key) => {
      return {
        name: key,
        value: user.userCookie[key].value,
        url: 'https://shopee.co.id/',
        domain: user.userCookie[key].Domain || 'shopee.co.id',
      }
    }))

    await page.goto(`https://shopee.co.id/checkout`, { waitUntil: ['domcontentloaded', 'load', 'networkidle0', 'networkidle2'] })

    await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { queue: true }).exec()

    do {
      user.start = Date.now()

      if (await User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id, queue: false })) return ctx.telegram.deleteMessage(user.message.chatId, user.message.msgId)

      await InfoBarang(ctx).then(async ({ statusCode, data, headers }) => {
        setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
        let chunk = typeof data == 'string' ? JSON.parse(data) : data;
        if (chunk.error == null) user.infoBarangTemp = chunk;
      }).catch((err) => err);

      if (!user.infoBarangTemp) continue;
      user.infoBarang = user.infoBarangTemp
      delete user.infoBarangTemp

      user.promotionid = user.infoBarang.data.upcoming_flash_sale ? user.infoBarang.data.upcoming_flash_sale.promotionid : user.infoBarang.data.flash_sale ? user.infoBarang.data.flash_sale.promotionid : null

      user.modelid = function (barang) {
        if (barang.data.flash_sale) {
          for (const model of barang.data.models) {
            if (model.stock > 1 && user.promotionid == model.promotionid) return model.modelid
          }
        }
        for (const model of barang.data.models) {
          if (model.stock > 1) return model.modelid
        }
        return barang.data.models[0].modelid
      }(user.infoBarang)

      if (user.infoBarang.data.stock > 1 && (user.end ? Math.floor(Date.now() / 1000) % (user.infoCheckout ? 5 : 60) == 0 : true)) {
        await getHope(ctx, page, true)

        await Log.updateOne({
          teleBotId: process.env.BOT_ID,
          teleChatId: ctx.message.chat.id,
          itemid: user.itemid,
          modelid: user.modelid,
          shopid: user.shopid
        }, {
          infoKeranjang: user.infoKeranjang ? user.infoKeranjang.responseBody : null,
          updateKeranjang: user.updateKeranjang ? user.updateKeranjang.responseBody : null,
          infoCheckout: user.infoCheckout ? user.infoCheckout.responseBody : null,
          selectedShop: user.selectedShop,
          selectedItem: user.selectedItem
        }, { upsert: true }).exec()
      }

      if (!user.infoBarang.data.upcoming_flash_sale && !user.end) break;

      if (!user.end) user.end = parseInt(user.infoBarang.data.upcoming_flash_sale.start_time) * 1000

      if (user.end < Date.now() + 20000) break;

      await replaceMessage(ctx, user.message,
        `${timeConverter(Date.now() - user.end, { countdown: true })} - <i><b>${user.infoBarang.data.name}</b></i>` + (ensureRole(ctx, true) ?
          `<code>\ninfoKeranjang    = ${typeof user.infoKeranjang}` +
          `\nupdateKeranjang  = ${typeof user.updateKeranjang}` +
          `\ninfoCheckout     = ${typeof user.infoCheckout}</code>` : null), false
      )

      await sleep(1000 - (Date.now() - user.start))

    } while (!user.skip)

    await replaceMessage(ctx, user.message,
      `Mulai Membeli - <i><b>${user.infoBarang.data.name}</b></i>` + (ensureRole(ctx, true) ?
        `<code>\ninfoKeranjang    = ${typeof user.infoKeranjang}` +
        `\nupdateKeranjang  = ${typeof user.updateKeranjang}` +
        `\ninfoCheckout     = ${typeof user.infoCheckout}</code>` : null), false
    )

    while (((user.end > Date.now()) || ((Date.now() % 1000).toFixed(0) > 100)) && !user.skip) continue;

    await getHope(ctx, page)

  }).catch((err) => logReport(ctx, err));

  await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { userCookie: user.userCookie, queue: false }).exec()

  return browser.close()
}

const getHope = async function (ctx, page, cache) {
  let user = ctx.session
  user.start = Date.now();

  await page.setRequestInterception(true)

  page.on('request', (request) => {
    if (blockedDomains.some(domain => request.url().indexOf(domain) !== -1) || blockedResource.includes(request.resourceType())) return request.abort();

    let requestName = listRequest.find(e => e.url == request.url());
    requestName = requestName ? requestName.name : request.url();

    if (!cache && user[requestName]) {

      switch (requestName) {
        case 'infoKeranjang':
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
          break;

        case 'updateKeranjang':
          for (const [shop_vouchers_index, shop_vouchers] of user[requestName].responseBody.data.shop_vouchers.entries()) {
            user[requestName].responseBody.data.shop_vouchers[shop_vouchers_index].promotionid = user.promotionid
          }
          for (const [total_payment_index, total_payment] of user[requestName].responseBody.data.total_payment.entries()) {
            user[requestName].responseBody.data.total_payment[total_payment_index] = user.price
          }
          break;

        case 'infoCheckout':
          user[requestName].responseBody.timestamp = Math.floor(user.start / 1000)
          user[requestName].responseBody.checkout_price_data.merchandise_subtotal = user.price * user.quantity
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
            user[requestName].responseBody.checkout_price_data.total_payable = user[requestName].responseBody.shipping_orders[shipping_orders_index].shipping_fee + (user.price * user.quantity) + parseInt(100000000)
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
          break;
      }

      return request.respond({
        status: user[requestName].responseStatus,
        headers: user[requestName].responseHeaders,
        body: listRequest.find(e => e.url == request.url()) ? JSON.stringify(user[requestName].responseBody) : user[requestName].responseBody
      });
    }

    // if (request.url() == 'https://shopee.co.id/api/v4/checkout/place_order') {
    //   console.log(request.postData());
    // }

    return request.continue();
  })

  page.on('requestfinished', async (request) => {
    try {
      const response = await request.response();

      if (request.redirectChain().length === 0) {
        const buffer = await response.buffer();

        const requestName = listRequest.find(e => e.url == request.url());

        user[requestName ? requestName.name : request.url()] = {
          responseStatus: response.status(),
          responseHeaders: response.headers(),
          responseBody: requestName ? JSON.parse(buffer.toString('utf8')) : buffer.toString('utf8'),
        }
      }
    } catch (err) { }
  })

  await Keranjang(ctx).then(async ({ statusCode, data, headers }) => {
    setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
    let chunk = typeof data == 'string' ? JSON.parse(data) : data;
    if (chunk.error == 0) return user.keranjang = chunk
  }).catch((err) => logReport(ctx, err))

  if (!user.keranjang) return await replaceMessage(ctx, user.message, 'Pembelian tidak dapat dilakukan karena produk sudah habis terjual.')

  await page.setCookie(...Object.keys(user.userCookie).map((key) => ({
    name: key,
    value: user.userCookie[key].value,
    url: 'https://shopee.co.id/',
    domain: user.userCookie[key].Domain || 'shopee.co.id',
  })))

  if (cache || !user.selectedItem || !user.infoCheckout) {
    await page.goto(`https://shopee.co.id/cart?itemKeys=${user.itemid}.${user.modelid}.&shopId=${user.shopid}`, { timeout: 5000 }).then().catch((err) => logReport(ctx, new Error(err)));
    await page.waitForResponse('https://shopee.co.id/api/v4/cart/update', { method: 'POST', timeout: 5000 }).then(() => {

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

      user.price = user.predict || function (item) {
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

    }).catch((err) => logReport(ctx, new Error(err)));
  }

  await page.evaluate(({ keranjang, infoKeranjang, updateKeranjang, selectedShop, selectedItem, shopid, itemid, modelid, quantity }) => {
    sessionStorage.setItem('cart_info', JSON.stringify({
      promotion_data: {
        free_shipping_voucher_info: updateKeranjang ? updateKeranjang.data.free_shipping_voucher_info : {
          free_shipping_voucher_id: 0,
          free_shipping_voucher_code: null,
          disabled_reason: "",
          description: ""
        },
        platform_vouchers: updateKeranjang ? updateKeranjang.data.platform_vouchers : [],
        shop_vouchers: updateKeranjang ? updateKeranjang.data.shop_vouchers : [],
        use_coins: updateKeranjang ? updateKeranjang.data.use_coins : false
      },
      shoporders: [{
        shop: { shopid: shopid },
        items: [{
          itemid: itemid,
          quantity: quantity,
          modelid: modelid,
          add_on_deal_id: selectedItem ? selectedItem.add_on_deal_id : null,
          is_add_on_sub_item: selectedItem ? selectedItem.is_add_on_sub_item : null,
          item_group_id: selectedItem ? selectedItem.item_group_id : `${keranjang.data.cart_item.item_group_id}`
        }]
      }]
    }));
  }, {
    keranjang: user.keranjang,
    infoKeranjang: user.infoKeranjang ? user.infoKeranjang.responseBody : null,
    updateKeranjang: user.updateKeranjang ? user.updateKeranjang.responseBody : null,
    selectedShop: user.selectedShop,
    selectedItem: user.selectedItem,
    shopid: user.shopid,
    itemid: user.itemid,
    modelid: user.modelid,
    quantity: user.quantity
  });

  await page.goto(`https://shopee.co.id/checkout`, { timeout: 5000 }).then().catch((err) => logReport(ctx, err));
  await page.waitForResponse('https://shopee.co.id/api/v4/checkout/get', { method: 'POST', timeout: 5000 }).then().catch((err) => logReport(ctx, err));

  if (cache) {

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

    return UpdateKeranjang(ctx, 2).then(async ({ statusCode, data, headers }) => {
      setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
      let chunk = typeof data == 'string' ? JSON.parse(data) : data;
      if (chunk.error != 0) return new Promise((resolve, reject) => reject(chunk.error))
    }).catch((err) => logReport(ctx, err))
  }

  switch (user.payment) {
    case paymentMethod.BNI:
      await page.waitForSelector(process.env.TRANSFER_BANK, { timeout: 5000 }).then().catch((err) => logReport(ctx, err));
      if (user.infoCheckout.responseBody.payment_channel_info.channels[2].banks[3].enabled) {
        await page.click(process.env.TRANSFER_BANK).then().catch((err) => logReport(ctx, err));
        await page.click(process.env.BNI_CEK_OTOMATIS).then().catch((err) => logReport(ctx, err));
      } else {
        return replaceMessage(ctx, user.message, await failedBuy(ctx, `\n\n<i>Gagal Melakukan Order Barang <b>${user.infoBarang.data.name}</b>\n${user.infoCheckout.responseBody.payment_channel_info.channels[2].banks[3].disabled_reason}</i>`), false)
      }
      break;

    case paymentMethod.COD:
      await page.waitForSelector(process.env.COD, { timeout: 5000 }).then().catch((err) => logReport(ctx, err));
      if (user.infoCheckout.responseBody.payment_channel_info.channels[1].enabled) {
        await page.click(process.env.COD).then().catch((err) => logReport(ctx, err));
      } else {
        return replaceMessage(ctx, user.message, await failedBuy(ctx, `\n\n<i>Gagal Melakukan Order Barang <b>${user.infoBarang.data.name}</b>\n${user.infoCheckout.responseBody.payment_channel_info.channels[1].disabled_reason}</i>`), false)
      }
      break;

    case paymentMethod.SHOPEEPAY:
      await page.waitForSelector(process.env.SHOPEEPAY, { timeout: 5000 }).then().catch((err) => logReport(ctx, err));
      if (user.infoCheckout.responseBody.payment_channel_info.channels[0].enabled) {
        await page.click(process.env.SHOPEEPAY).then().catch((err) => logReport(ctx, err));
      } else {
        return replaceMessage(ctx, user.message, await failedBuy(ctx, `\n\n<i>Gagal Melakukan Order Barang <b>${user.infoBarang.data.name}</b>\n${user.infoCheckout.responseBody.payment_channel_info.channels[0].disabled_reason}</i>`), false)
      }
      break;

  }

  await page.waitForSelector(process.env.ORDER_BUTTON, { timeout: 5000 }).then().catch((err) => logReport(ctx, err));

  for (let i = 0; i < 3; i++) await page.click(process.env.ORDER_BUTTON).then().catch((err) => err);

  return page.waitForResponse('https://shopee.co.id/api/v4/checkout/place_order', { method: 'POST', timeout: 15000 }).then(async (response) => {
    const buffer = await response.buffer();
    user.order = JSON.parse(buffer.toString('utf8'))
    return replaceMessage(ctx, user.message, user.order.error ? await failedBuy(ctx, `\n\n<i>Gagal Melakukan Order Barang <b>${user.infoBarang.data.name}</b>\n${user.order.error_msg}</i>\n${ensureRole(ctx, true) ? user.order.error : null}`) : await successBuy(ctx, `\n\n<i><b>${user.infoBarang.data.name}</b> Berhasil Di Pesan</i>`), false)
  }).catch((err) => logReport(ctx, err));

}

const successBuy = async function (ctx, msg) {
  let user = ctx.session

  let info = `<code>Start : <b>${timeConverter(user.start, { usemilis: true })}</b>`
  info += `\nEnd   : <b>${timeConverter(Date.now(), { usemilis: true })}</b>`
  info += `\nSpeed : <b>${Date.now() - user.start}ms</b></code>`
  info += msg

  if (user.cancel) {
    await Cancel(ctx).then(({ statusCode, data, headers }) => {
      setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
      let chunk = typeof data == 'string' ? JSON.parse(data) : data;
      info += `\n\nAuto Cancel Berhasil`
    }).catch((err) => logReport(ctx, err));
  }

  return info;
}

const failedBuy = async function (ctx, msg) {
  let user = ctx.session

  let info = `<code>Start : <b>${timeConverter(user.start, { usemilis: true })}</b>`
  info += `\nEnd   : <b>${timeConverter(Date.now(), { usemilis: true })}</b>`
  info += `\nSpeed : <b>${Date.now() - user.start}ms</b></code>`
  info += msg

  await UpdateKeranjang(ctx, 2).then(({ statusCode, data, headers }) => {
    setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
    let chunk = typeof data == 'string' ? JSON.parse(data) : data;
    info += `\n\nBarang <b>${user.infoBarang.data.name}</b> Telah Telah Di Hapus Dari Keranjang`
  }).catch((err) => logReport(ctx, err));

  return info;
}

const paymentMethod = {
  BNI: 'bni',
  // BRI: 'bri',
  // BCA: 'bca',
  // MANDIRI: 'mandiri',
  // BSI: 'bsi',
  // PERMATA: 'permata',
  COD: 'cod',
  SHOPEEPAY: 'shopeepay'
}

const listRequest = [{
  name: 'infoKeranjang',
  url: 'https://shopee.co.id/api/v4/cart/get'
}, {
  name: 'updateKeranjang',
  url: 'https://shopee.co.id/api/v4/cart/update'
}, {
  name: 'infoCheckout',
  url: 'https://shopee.co.id/api/v4/checkout/get'
}]

const blockedDomains = [
  'gum.criteo.com',
  'stats.g.doubleclick.net',
  'www.google-analytics.com',
  'analytics.google.com',
  'cw.addthis.com',
  'dis.criteo.com',
  'ups.analytics.yahoo.com',
  'pixel.advertising.com',
  'simage2.pubmatic.com',
  'contextual.media.net',
  'rtb-csync.smartadserver.com',
  'eb2.3lift.com',
  'x.bidswitch.net',
  'r.casalemedia.com',
  'ads.yahoo.com',
  'ssp.meba.kr',
  'sync-t1.taboola.com',
  'secure.adnxs.com',
  'criteo-sync.teads.tv',
  'ad.tpmn.co.kr',
  'ade.clmbtech.com',
  's.ad.smaato.net',
  'ad.caprofitx.adtdp.com',
  's-cs.send.microad.jp',
  'adservice.google.com',
  'seller.shopee.sg',
  'seller.shopee.co.id',
  'chat-ws.shopee.co.id',
  'firebaselogging-pa.googleapis.com',
  'fls.doubleclick.net',
  'c-api-bit.shopeemobile.com',
  'www.googletagmanager.com',
  'shopee.co.id/api/v2/item/get_installment_plans',
  'shopee.co.id/api/v4/notification/get_activities?limit=5',
  'shopee.co.id/api/v4/notification/get_notifications?limit=5',
  'shopee.co.id/api/v4/deep_platform/ab_test/get_all_variates?project_numbers=0',
  'shopee.co.id/api/v4/checkout/get_quick'
];

const blockedResource = [
  'image', 'font'
];
