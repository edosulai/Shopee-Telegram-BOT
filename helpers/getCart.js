const cookie = require('cookie');

const postKeranjang = require('../request/buy/postKeranjang');
const postInfoKeranjang = require('../request/buy/postInfoKeranjang');
const postUpdateKeranjang = require('../request/buy/postUpdateKeranjang');
const postInfoCheckout = require('../request/buy/postInfoCheckout');
const postCheckout = require('../request/buy/postCheckout');

const Log = require('../models/Log');

const buyItem = require('./buyItem');

const { setNewCookie, paymentMethod, sendReportToDev } = require('./index')

module.exports = async function (ctx, page) {
  let user = ctx.session
  user.config.start = Date.now();
  user.config.timestamp = Date.now();

  await postKeranjang(ctx).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    setNewCookie(user.userCookie, headers['set-cookie'])
    curl.close()
  }).catch((err) => err)

  if (!page) {

    await postInfoKeranjang(ctx).then(({ statusCode, body, headers, curlInstance, curl }) => {
      setNewCookie(user.userCookie, headers['set-cookie'])
      let chunk = typeof body == 'string' ? JSON.parse(body) : body;
      if (chunk.data.shop_orders.length > 0) {
        user.infoKeranjang = chunk
        user.infoKeranjang.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
        user.infoKeranjang.now = Date.now()

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

        user.price = user.config.predictPrice || function (item) {
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
        }(user.selectedItem) || user.price
      }
      curl.close()
    }).catch((err) => err)

    postUpdateKeranjang(ctx, 4).then(({ statusCode, body, headers, curlInstance, curl }) => {
      setNewCookie(user.userCookie, headers['set-cookie'])
      let chunk = typeof body == 'string' ? JSON.parse(body) : body;
      if (chunk.data && chunk.error == 0) {
        user.updateKeranjang = chunk
        user.updateKeranjang.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
        user.updateKeranjang.now = Date.now()
      }
      curl.close()
    }).catch((err) => err)

    await postInfoCheckout(ctx).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      setNewCookie(user.userCookie, headers['set-cookie'])
      let chunk = typeof body == 'string' ? JSON.parse(body) : body;
      if (chunk.shoporders) {
        user.infoCheckoutLong = chunk
        user.infoCheckoutLong.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
        user.infoCheckoutLong.now = Date.now()
        user.config.notHaveCache = false
      }
      curl.close()
    }).catch((err) => err)

    await postUpdateKeranjang(ctx, 2).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      curl.close()
      setNewCookie(user.userCookie, headers['set-cookie'])
    }).catch((err) => err);

    if (user.infoCheckoutLong) user.payment = paymentMethod(user, user.infoCheckoutLong.payment_channel_info.channels, true)

    return Log.updateOne({
      teleBotId: process.env.BOT_ID,
      teleChatId: ctx.message.chat.id,
      itemid: user.config.itemid,
      modelid: user.config.modelid,
      shopid: user.config.shopid
    }, {
      status: true,
      buyBody: user.postBuyBody,
      buyBodyLong: user.postBuyBodyLong,
      infoPengiriman: user.infoPengiriman,
      infoKeranjang: user.infoKeranjang,
      updateKeranjang: user.updateKeranjang,
      infoCheckoutLong: user.infoCheckoutLong,
      payment: user.payment,
      selectedShop: user.selectedShop,
      selectedItem: user.selectedItem
    }, { upsert: true }).exec()

  }

  await page.setCookie(...Object.keys(user.userCookie).map((key) => ({
    name: key,
    value: user.userCookie[key],
    domain: 'shopee.co.id'
  })));

  await page.goto('https://shopee.co.id/cart')

  for (const cookie of await page.cookies('https://shopee.co.id/cart')) {
    user.userCookie[cookie.name] = cookie.value
  }

  if (user.userCookie.shopee_webUnique_ccd) return buyItem(ctx)

  return sendReportToDev(ctx, new Error('cookie shopee_webUnique_ccd tidak di temukan'))

}