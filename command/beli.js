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

const { logReport, setNewCookie, timeConverter, parseShopeeUrl, sendMessage, replaceMessage, sleep, checkAccount, getCommands, objectSize, isValidURL, extractRootDomain, addDots } = require('../helpers')

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

  user.flashsale = await FlashSale.find({ teleBotId: process.env.BOT_ID })

  let { itemid, shopid, err } = parseShopeeUrl(user.commands.url)
  if (err) return sendMessage(ctx, err)

  user.itemid = itemid
  user.shopid = shopid
  user.quantity = parseInt(user.commands.qty) || 1
  user.url = user.commands.url
  user.skip = user.commands['-skip'] || false
  user.cancel = user.commands['-cancel'] || false
  user.cache = user.commands['-cache'] || false
  user.price = user.commands.price ? parseInt(user.commands.price) * 100000 : false

  await Log.findOne({
    teleBotId: process.env.BOT_ID,
    teleChatId: ctx.message.chat.id,
    itemid: user.itemid,
    shopid: user.shopid,
  }, async function (err, log) {
    if (!err && log && user.cache) {
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
      '--autoplay-policy=user-gesture-required',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-dev-shm-usage',
      '--disable-domain-reliability',
      '--disable-extensions',
      '--disable-features=AudioServiceOutOfProcess',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-notifications',
      '--disable-offer-store-unmasked-wallet-cards',
      '--disable-popup-blocking',
      '--disable-print-preview',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-setuid-sandbox',
      '--disable-speech-api',
      '--disable-sync',
      '--hide-scrollbars',
      '--ignore-gpu-blacklist',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-default-browser-check',
      '--no-first-run',
      '--no-pings',
      '--no-sandbox',
      '--no-zygote',
      '--password-store=basic',
      '--use-gl=swiftshader',
      '--use-mock-keychain',
      '--start-maximized'
    ]
  })

  await Address(ctx).then(async ({ statusCode, data, headers }) => {
    setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
    user.address = typeof data == 'string' ? JSON.parse(data) : data;
    if (user.address.error) return replaceMessage(ctx, user.message, 'Sesi Anda Sudah Habis Silahkan Login Kembali')

    const [page] = await browser.pages();
    await page.setUserAgent(process.env.USER_AGENT)

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

      if (user.cache && user.infoBarang.item.stock > 1 && (user.end ? Math.floor(Date.now() / 1000) % 10 == 0 : true)) {
        await getHope(ctx, page, user.cache)

        await Log.updateOne({
          teleBotId: process.env.BOT_ID,
          teleChatId: ctx.message.chat.id,
          itemid: user.itemid,
          modelid: user.modelid,
          shopid: user.shopid
        }, {
          infoKeranjang: user.infoKeranjang,
          updateKeranjang: user.updateKeranjang,
          infoCheckout: user.infoCheckout,
          selectedShop: user.selectedShop,
          selectedItem: user.selectedItem
        }, { upsert: true }).exec()
      }

      if (!user.infoBarang.item.upcoming_flash_sale && !user.end) break;

      if (!user.end) user.end = parseInt(user.infoBarang.item.upcoming_flash_sale.start_time) * 1000

      if (user.end < Date.now() + 20000) break;

      await replaceMessage(ctx, user.message,
        `${timeConverter(Date.now() - user.end, { countdown: true })} - <i><b>${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")}</b></i>` +
        `<code>\ninfoKeranjang    = ${typeof user.infoKeranjang}` +
        `\nupdateKeranjang  = ${typeof user.updateKeranjang}` +
        `\ninfoCheckout     = ${typeof user.infoCheckout}</code>`, false
      )

      await sleep(1000 - (Date.now() - user.start))

    } while (!user.skip)

    if (!user.modelid) return replaceMessage(ctx, user.message, `Semua Stok Barang Sudah Habis`)

    if (await User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id, queue: false })) return ctx.telegram.deleteMessage(user.message.chatId, user.message.msgId)

    await replaceMessage(ctx, user.message,
      `Mulai Membeli - <i><b>${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")}</b></i>` +
      `<code>\ninfoKeranjang    = ${typeof user.infoKeranjang}` +
      `\nupdateKeranjang  = ${typeof user.updateKeranjang}` +
      `\ninfoCheckout     = ${typeof user.infoCheckout}</code>`, false
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

  await Keranjang(ctx).then(async ({ statusCode, data, headers }) => {
    setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
    let chunk = typeof data == 'string' ? JSON.parse(data) : data;
    if (chunk.error == 0) user.keranjang = chunk
  }).catch((err) => logReport(ctx, err))

  await page.setCookie(...Object.keys(user.userCookie).map((key) => {
    return {
      name: key,
      value: user.userCookie[key].value,
      url: 'https://shopee.co.id/',
      domain: user.userCookie[key].Domain || 'shopee.co.id',
    }
  }))

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

  await page.setRequestInterception(true)

  page.on('console', msg => {
    for (let i = 0; i < msg.args.length; ++i) console.log(`${i}: ${msg.args[i]}`);
  });

  page.on('request', async (request) => {
    if (blockedDomains.some(domain => request.url().indexOf(domain) !== -1) || blockedResource.includes(request.resourceType())) return request.abort();

    const requestName = listRequest.find(e => e.url == request.url());

    if (!cache && user[requestName ? requestName.name : request.url()]) {
      return request.respond({
        status: user[requestName ? requestName.name : request.url()].responseStatus,
        headers: user[requestName ? requestName.name : request.url()].responseHeaders,
        body: requestName ? JSON.stringify(user[requestName.name].responseBody) : user[request.url()].responseBody
      });
    }

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

  if (cache) {
    await page.goto(`https://shopee.co.id/cart?itemKeys=${user.itemid}.${user.modelid}.&shopId=${user.shopid}`, { timeout: 5000 }).then().catch((err) => logReport(ctx, err));

    await page.waitForResponse('https://shopee.co.id/api/v4/cart/update', { method: 'POST', timeout: 5000 }).then().catch((err) => logReport(ctx, err));

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
  }

  await page.evaluate(({ infoBarang, keranjang, infoKeranjang, updateKeranjang, selectedShop, selectedItem, shopid, itemid, modelid, quantity }) => {
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
          add_on_deal_id: infoBarang.item.add_on_deal_info ? infoBarang.item.add_on_deal_id : null,
          is_add_on_sub_item: selectedItem ? selectedItem.is_add_on_sub_item : null,
          item_group_id: keranjang.data.cart_item.item_group_id
        }]
      }]
    }));
  }, {
    infoBarang: user.infoBarang,
    keranjang: user.keranjang,
    infoKeranjang: user.infoKeranjang.responseBody,
    updateKeranjang: user.updateKeranjang.responseBody,
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
      if (chunk.error != 0) await logReport(ctx, chunk)
    }).catch((err) => logReport(ctx, err))
  }

  await page.waitForSelector(process.env.TRANSFER_BANK, { timeout: 5000 }).then().catch((err) => err);
  await page.click(process.env.TRANSFER_BANK).then().catch((err) => err);
  await page.click(process.env.BNI_CEK_OTOMATIS).then().catch((err) => err);

  await page.waitForSelector(process.env.ORDER_BUTTON, { timeout: 5000 }).then().catch((err) => logReport(ctx, err));

  for (let i = 0; i < 5; i++) await page.click(process.env.ORDER_BUTTON).then().catch((err) => err);

  await page.waitForResponse('https://shopee.co.id/api/v4/checkout/place_order', { method: 'POST', timeout: 15000 }).then(async (response) => {

    const buffer = await response.buffer();

    user.order = JSON.parse(buffer.toString('utf8'))

    let info = `<code>Start : <b>${timeConverter(user.start, { usemilis: true })}</b>`
    info += `\nEnd   : <b>${timeConverter(Date.now(), { usemilis: true })}</b></code>`

    if (user.order.error) {
      info += `\n\n<i>Gagal Melakukan Order Barang <b>(${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")})</b>\n${user.order.error_msg}</i>\n${ensureRole(ctx, true) ? user.order.error : null}`

      await UpdateKeranjang(ctx, 2).then(({ statusCode, data, headers }) => {
        setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
        info += `\n\nBarang <b>(${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")})</b> Telah Telah Di Hapus Dari Keranjang`

      }).catch((err) => logReport(ctx, err));

    } else {
      info += `\n\n<i><b>(${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")})</b> Berhasil Di Pesan</i>`

      if (user.cancel) {
        await Cancel(ctx).then(({ statusCode, data, headers }) => {
          setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
          info += `\n\nAuto Cancel Berhasil`

        }).catch((err) => logReport(ctx, err));
      }
    }

    await replaceMessage(ctx, user.message, info, false)

    await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { userCookie: user.userCookie, queue: false }).exec()

  }).catch((err) => logReport(ctx, err));

}