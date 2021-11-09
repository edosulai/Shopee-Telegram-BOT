const psl = require('psl');
const puppeteer = require('puppeteer');

const getAddress = require('../request/other/getAddress');
const getInfoBarang = require('../request/buy/getInfoBarang');
const postKeranjang = require('../request/buy/postKeranjang');
const postUpdateKeranjang = require('../request/buy/postUpdateKeranjang');

const User = require('../models/User');
const FlashSale = require('../models/FlashSale');

const getItem = require('../helpers/getItem');

const { sendReportToDev, setNewCookie, timeConverter, parseShopeeUrl, sendMessage, replaceMessage, ensureRole, sleep, checkAccount, getCommands, objectSize, isValidURL, extractRootDomain } = require('../helpers')

module.exports = async function (ctx) {
  let user = ctx.session
  user.commands = getCommands(ctx.message.text)
  if (objectSize(user.commands) < 1) return ctx.reply(`/beli <code>url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`, { parse_mode: 'HTML' })

  if (user.commands['-stop']) {
    return User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { queue: false }).exec()
  }

  await ctx.reply(`Memuat... <code>${user.commands.url}</code>`, { parse_mode: 'HTML' }).then((replyCtx) => {
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

  if (user.queue) {
    return replaceMessage(ctx, user.config.message, 'Hanya Bisa Mendaftarkan 1 Produk Dalam Antrian!!')
  }

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
      predictPrice: user.commands.price ? parseInt(user.commands.price) * 100000 : false,
      success: false,
      fail: 0
    }
  }

  return getAddress(ctx).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    curl.close()
    setNewCookie(user.userCookie, headers['set-cookie'])
    user.address = typeof body == 'string' ? JSON.parse(body) : body;
    if (user.address.error) return replaceMessage(ctx, user.config.message, 'Sesi Anda Sudah Habis Silahkan Login Kembali')

    const browser = await puppeteer.launch({
      headless: false,
      ignoreHTTPSErrors: true,
      defaultViewport: null,
      args: ['--start-maximized']
    })

    await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { queue: true }).exec()

    await getInfoBarang(ctx).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      setNewCookie(user.userCookie, headers['set-cookie'])
      let chunk = typeof body == 'string' ? JSON.parse(body) : body;
      if (chunk.error == null) {

        user.infoBarang = chunk;

        do {

          if (await User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id, queue: false })) {
            await browser.close()
            return ctx.telegram.deleteMessage(user.config.message.chatId, user.config.message.msgId)
          }

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

          if (!user.infoBarang.item.upcoming_flash_sale || user.config.skip) break;

          if (!user.config.end) {
            user.config.end = parseInt(user.infoBarang.item.upcoming_flash_sale.start_time) * 1000
          }

          if (user.config.end < Date.now() + 10000) break;

          await replaceMessage(ctx, user.config.message, timeConverter(Date.now() - user.config.end, { countdown: true }) + ` - ${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")}`)

          await sleep(1000 - (Date.now() - user.config.start))

        } while (!user.config.skip)

        if (!user.config.modelid) {
          await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { userCookie: user.userCookie, queue: false }).exec()
          return replaceMessage(ctx, user.config.message, `Semua Stok Barang Sudah Habis`)
        }

        if (await User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id, queue: false })) {
          return ctx.telegram.deleteMessage(user.config.message.chatId, user.config.message.msgId)
        }

        await replaceMessage(ctx, user.config.message, `Mulai Membeli Barang ${user.infoBarang ? `<code>${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")}</code>` : ''}`, false)

        const page = await browser.newPage();
        await page.setUserAgent(process.env.USER_AGENT)

        while ((user.config.end > Date.now()) || ((Date.now() % 1000).toFixed(0) > 100)) continue;

        user.config.start = Date.now();

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

        page.on('request', request => request.continue())

        page.on('requestfinished', async (request) => {
          try {
            if (!listRequest.map(e => e.url).includes(request.url())) return;

            const response = await request.response();

            let responseBody;
            if (request.redirectChain().length === 0) {
              const buffer = await response.buffer();
              responseBody = buffer.toString('utf8');
            }

            user[listRequest.find(e => e.url == request.url()).name] = JSON.parse(responseBody)
          } catch (err) {
            await sendReportToDev(ctx, err.message)
          }
        });

        await page.goto(`https://shopee.co.id/cart?itemKeys=${user.config.itemid}.${user.config.modelid}.&shopId=${user.config.shopid}`)
        await page.waitForSelector('._2jol0L .W2HjBQ button span')
        await page.click('._2jol0L .W2HjBQ button span')
        await page.waitForSelector('._1WlhIE .PC1-mc button')
        await page.click('._1WlhIE .PC1-mc button')
        await page.waitFor(2000)

        let info = `\n\nBot Start : <b>${timeConverter(user.config.start, { usemilis: true })}</b>`
        info += `\nBot End : <b>${timeConverter(Date.now(), { usemilis: true })}</b>`

        if (user.order.error) {
          info += `\n\n<i>Gagal Melakukan Order Barang <b>(${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")})</b>\n${user.order.error_msg}</i>\n${ensureRole(ctx, true) ? user.order.error : null}`

          await postUpdateKeranjang(ctx, 2).then(({ statusCode, body, headers, curlInstance, curl }) => {
            setNewCookie(user.userCookie, headers['set-cookie'])
            info += `\n\nBarang <b>(${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")})</b> Telah Telah Di Hapus Dari Keranjang`
            curl.close()
          }).catch((err) => err);

        } else {
          info += `\n\n<i>Barang <b>(${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")})</b> Berhasil Di Pesan</i>`

          if (user.config.cancel) {
            await postCancel(ctx).then(({ statusCode, body, headers, curlInstance, curl }) => {
              setNewCookie(user.userCookie, headers['set-cookie'])
              info += `\n\nAuto Cancel Barang (${user.infoBarang.item.name}) Berhasil`
              curl.close()
            }).catch((err) => err);
          }
        }

        await replaceMessage(ctx, user.config.message, info, false)

        await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, {
          userCookie: user.userCookie,
          queue: false
        }).exec()

        await page.close();

      }

      curl.close();
    }).catch((err) => sendReportToDev(ctx, err));

    await browser.close()

  }).catch((err) => sendReportToDev(ctx, err));
}