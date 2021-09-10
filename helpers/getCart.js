const postKeranjang = require('../request/buy/postKeranjang');
const postInfoKeranjang = require('../request/buy/postInfoKeranjang');
const postUpdateKeranjang = require('../request/buy/postUpdateKeranjang');
const postInfoCheckout = require('../request/buy/postInfoCheckout');
const postInfoCheckoutQuick = require('../request/buy/postInfoCheckoutQuick');

const Log = require('../models/Log');

const buyItem = require('../helpers/buyItem');

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

module.exports = async function (ctx, getCache) {
  let user = ctx.session;
  user.config.start = Date.now();
  user.config.timestamp = Date.now();

  postKeranjang(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    setNewCookie(user.userCookie, headers['set-cookie'])
    curl.close()
  }).catch((err) => err)

  let infoKeranjangInterval = setInterval(async function () {
    if (Date.now() - user.config.start > (getCache ? 1000 : 100)) clearInterval(infoKeranjangInterval);

    await postInfoKeranjang(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
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

        clearInterval(infoKeranjangInterval);
      }
      curl.close()
    }).catch((err) => err)

    postUpdateKeranjang(user, 4).then(({ statusCode, body, headers, curlInstance, curl }) => {
      setNewCookie(user.userCookie, headers['set-cookie'])
      let chunk = typeof body == 'string' ? JSON.parse(body) : body;
      if (chunk.data && chunk.error == 0) {
        user.updateKeranjang = chunk
        user.updateKeranjang.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
        user.updateKeranjang.now = Date.now()
      }
      curl.close()
    }).catch((err) => err)

  }, 0)

  postInfoCheckout(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    setNewCookie(user.userCookie, headers['set-cookie'])
    let chunk = typeof body == 'string' ? JSON.parse(body) : body;
    if (chunk.shoporders) {
      user.config.infoCheckoutLong = chunk
      user.config.infoCheckoutLong.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
      user.config.infoCheckoutLong.now = Date.now()
      clearInterval(checkoutInterval);
    }
    curl.close()
  }).catch((err) => err)

  let checkoutInterval = setInterval(async function () {
    if (Date.now() - user.config.start > (getCache ? 1000 : 100)) clearInterval(checkoutInterval);
    
    await postInfoCheckoutQuick(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
      setNewCookie(user.userCookie, headers['set-cookie'])
      let chunk = typeof body == 'string' ? JSON.parse(body) : body;
      if (chunk.shoporders) {
        user.infoCheckoutQuick = chunk
        user.infoCheckoutQuick.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
        user.infoCheckoutQuick.now = Date.now()
        clearInterval(checkoutInterval);
      }
      curl.close()
    }).catch((err) => err)
  }, 0)

  if (getCache) {
    return waitUntil(user.config, 'infoCheckoutLong').then(async () => {
      user.infoCheckoutLong = user.config.infoCheckoutLong
      delete user.config.infoCheckoutLong

      await postUpdateKeranjang(user, 2).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
        curl.close()
        setNewCookie(user.userCookie, headers['set-cookie'])
      }).catch((err) => err);

      user.payment = require('../helpers/paymentMethod')(user, user.infoCheckoutLong.payment_channel_info.channels, true)

      return Log.updateOne({
        teleBotId: process.env.BOT_ID,
        teleChatId: ctx.message.chat.id,
        itemid: user.config.itemid,
        modelid: user.config.modelid
      }, {
        status: true,
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

    }).catch(async (err) => {
      await postUpdateKeranjang(user, 2).then(({ statusCode, body, headers, curlInstance, curl }) => {
        curl.close()
        setNewCookie(user.userCookie, headers['set-cookie'])
      }).catch((err) => err);

      return sendReportToDev(ctx, new Error(err))
    })
  } else {

    let buyInterval = setInterval(async () => {
      if(infoKeranjangInterval._destroyed && checkoutInterval._destroyed){
        clearInterval(buyInterval)
        return await replaceMessage(ctx, user.config.message, await buyItem(ctx), false)
      }
    }, 0)

  }
}