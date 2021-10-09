const postKeranjang = require('../request/buy/postKeranjang');
const postInfoKeranjang = require('../request/buy/postInfoKeranjang');
const postUpdateKeranjang = require('../request/buy/postUpdateKeranjang');
const postInfoCheckout = require('../request/buy/postInfoCheckout');
const postInfoCheckoutQuick = require('../request/buy/postInfoCheckoutQuick');
const postCheckout = require('../request/buy/postCheckout');

const Log = require('../models/Log');

const buyItem = require('./buyItem');

const { setNewCookie, paymentMethod, sleep } = require('./index')

module.exports = async function (ctx, getCache) {
  let user = ctx.session
  user.config.start = Date.now();
  user.config.timestamp = Date.now();

  await postKeranjang(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    setNewCookie(user.userCookie, headers['set-cookie'])
    curl.close()
  }).catch((err) => err)

  if (getCache) {
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
  } else {
    let infoKeranjangInterval = setInterval(() => {
      postInfoKeranjang(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
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

          clearInterval(infoKeranjangInterval)
        }
        curl.close()
      }).catch((err) => err)
    })
  }

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

  postCheckout(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
    setNewCookie(user.userCookie, headers['set-cookie'])
    let chunk = typeof body == 'string' ? JSON.parse(body) : body;
    if (chunk.data && chunk.error == 0) {
      user.checkout = chunk
      user.checkout.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
      user.checkout.now = Date.now()
    }
    curl.close()
  }).catch((err) => err)

  if (getCache) {
    await postInfoCheckout(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
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

    await postInfoCheckoutQuick(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
      setNewCookie(user.userCookie, headers['set-cookie'])
      let chunk = typeof body == 'string' ? JSON.parse(body) : body;
      if (chunk.shoporders) {
        user.infoCheckoutQuick = chunk
        user.infoCheckoutQuick.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
        user.infoCheckoutQuick.now = Date.now()
      }
      curl.close()
    }).catch((err) => err)

    await postUpdateKeranjang(user, 2).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
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
      infoCheckoutQuick: user.infoCheckoutQuick,
      infoCheckoutLong: user.infoCheckoutLong,
      payment: user.payment,
      selectedShop: user.selectedShop,
      selectedItem: user.selectedItem
    }, { upsert: true }).exec()

  } else {
    postInfoCheckout(user).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      setNewCookie(user.userCookie, headers['set-cookie'])
      let chunk = typeof body == 'string' ? JSON.parse(body) : body;
      if (chunk.shoporders) {
        user.infoCheckoutLong = chunk
        user.infoCheckoutLong.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
        user.infoCheckoutLong.now = Date.now()
      }
      curl.close()
    }).catch((err) => err)

    let infoCheckoutInterval = setInterval(() => {
      postInfoCheckoutQuick(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
        setNewCookie(user.userCookie, headers['set-cookie'])
        let chunk = typeof body == 'string' ? JSON.parse(body) : body;
        if (chunk.shoporders) {
          user.infoCheckoutQuickTemp = chunk
          user.infoCheckoutQuick = chunk
          user.infoCheckoutQuick.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
          user.infoCheckoutQuick.now = Date.now()
          clearInterval(infoCheckoutInterval)
        }
        curl.close()
      }).catch((err) => err)
    }, 0);

    // return waitUntil(user, 'infoCheckoutQuickTemp').then(() => buyItem(ctx)).catch((err) => err)
    await sleep(10)
    return buyItem(ctx)
  }
}