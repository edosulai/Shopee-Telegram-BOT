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

  if (page) {

    let listRequest = [
      {
        name: 'infoKeranjang',
        url: 'https://shopee.co.id/api/v4/cart/get'
      },
      {
        name: 'updateKeranjang',
        url: 'https://shopee.co.id/api/v4/cart/update'
      }
    ]

    await page.setCookie(...Object.keys(user.userCookie).map((key) => ({
      name: key,
      value: user.userCookie[key],
      domain: 'shopee.co.id'
    })))

    await page.setRequestInterception(true)

    page.on('request', request => request.continue())

    page.on('requestfinished', async (request) => {
      try {
        console.log(request.url());
        if (!listRequest.map(e => e.url).includes(request.url())) return;
        if (request.redirectChain().length === 0) {
          user[listRequest.find(e => e.url == request.url()).name] = await request.response().buffer().toString('utf8');
        }
      } catch (err) {
        sendReportToDev(ctx, err.message)
      }
    });

    await page.goto('https://shopee.co.id/cart')

    for (const cookie of await page.cookies('https://shopee.co.id/cart')) {
      user.userCookie[cookie.name] = cookie.value
    }

    await page.close();

    await postInfoCheckout(ctx).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      setNewCookie(user.userCookie, headers['set-cookie'])
      let chunk = typeof body == 'string' ? JSON.parse(body) : body;
      if (chunk.shoporders) user.infoCheckout = chunk
      curl.close()
    }).catch((err) => err)

    await postUpdateKeranjang(ctx, 2).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      curl.close()
      setNewCookie(user.userCookie, headers['set-cookie'])
    }).catch((err) => err);

    if (user.infoCheckout) user.payment = paymentMethod(user, user.infoCheckout.payment_channel_info.channels, true)

    return Log.updateOne({
      teleBotId: process.env.BOT_ID,
      teleChatId: ctx.message.chat.id,
      itemid: user.config.itemid,
      modelid: user.config.modelid,
      shopid: user.config.shopid
    }, {
      status: true,
      buyBody: user.postBuyBody,
      infoKeranjang: user.infoKeranjang,
      updateKeranjang: user.updateKeranjang,
      infoCheckout: user.infoCheckout,
      payment: user.payment,
      selectedShop: user.selectedShop,
      selectedItem: user.selectedItem
    }, { upsert: true }).exec()

  }

  // await postInfoKeranjang(ctx).then(({ statusCode, body, headers, curlInstance, curl }) => {
  //   setNewCookie(user.userCookie, headers['set-cookie'])
  //   let chunk = typeof body == 'string' ? JSON.parse(body) : body;
  //   if (chunk.data.shop_orders.length > 0) {
  //     user.infoKeranjang = chunk

  //     user.selectedShop = function (shops) {
  //       for (const shop of shops) if (shop.shop.shopid == user.config.shopid) return shop
  //     }(user.infoKeranjang.data.shop_orders) || user.selectedShop || user.infoKeranjang.data.shop_orders[0]

  //     user.selectedItem = function (items) {
  //       for (const item of items) {
  //         if (item.modelid == user.config.modelid) return item
  //         if (item.models) {
  //           for (const model of item.models) {
  //             if (
  //               model.itemid == user.config.itemid &&
  //               model.shop_id == user.config.shopid &&
  //               model.modelid == user.config.modelid
  //             ) return item
  //           }
  //         }
  //       }
  //     }(user.selectedShop.items) || user.selectedItem || user.selectedShop.items[0]

  //     user.price = user.config.predictPrice || function (item) {
  //       if (item.models) {
  //         for (const model of item.models) {
  //           if (
  //             model.itemid == user.config.itemid &&
  //             model.shop_id == user.config.shopid &&
  //             model.modelid == user.config.modelid &&
  //             model.promotionid == user.config.promotionid
  //           ) return model.price
  //         }
  //       }
  //       return item.origin_cart_item_price
  //     }(user.selectedItem) || user.price

  //   }
  //   curl.close()
  // }).catch((err) => err)

  // postUpdateKeranjang(ctx, 4).then(({ statusCode, body, headers, curlInstance, curl }) => {
  //   setNewCookie(user.userCookie, headers['set-cookie'])
  //   let chunk = typeof body == 'string' ? JSON.parse(body) : body;
  //   if (chunk.data && chunk.error == 0) user.updateKeranjang = chunk
  //   curl.close()
  // }).catch((err) => err)

  // await postCheckout(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
  //   setNewCookie(user.userCookie, headers['set-cookie'])
  //   let chunk = typeof body == 'string' ? JSON.parse(body) : body;
  //   if (chunk.data && chunk.error == 0) user.checkout = chunk
  //   curl.close()
  // }).catch((err) => err)

  // if (user.userCookie.shopee_webUnique_ccd) return buyItem(ctx)

  return sendReportToDev(ctx, new Error('cookie shopee_webUnique_ccd tidak di temukan'))

}