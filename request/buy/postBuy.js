const cookie = require('cookie');

const { sendReportToDev, addDots } = require('../../helpers')

module.exports = async function (ctx) {
  let user = ctx.session;

  const taxCalc = function (payment, shipping_fee, price) {
    if (payment.payment_channelid) {
      let value = parseInt(shipping_fee + price) / 100 * 3 * 3
      return {
        value: value,
        msg: {
          "learn_more_url": "https://shopee.co.id/m/biaya-penanganan-cod/",
          "description": `Besar biaya penanganan adalah Rp ${addDots(value / 100000)} dari total transaksi.`,
          "title": "Biaya Penanganan"
        }
      }
    } else if (payment.channel_id) {
      let value = parseInt(100000000)
      return {
        value: value,
        msg: {
          "learn_more_url": "https://shopee.co.id/events3/code/634289435/",
          "description": `Besar biaya penanganan adalah Rp ${addDots(value / 100000)} dari total transaksi.`,
          "title": "Biaya Penanganan"
        }
      }
    } else {
      let value = parseInt(0)
      return {
        value: value,
        msg: {
          "learn_more_url": "",
          "description": `Besar biaya penanganan adalah Rp ${addDots(value / 100000)} dari total transaksi.`,
          "title": "Biaya Penanganan"
        }
      }
    }
  }

  const buyIt = function (infoCheckout) {
    let curl = new user.Curl()

    return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, false).setOpt(curl.libcurl.option.TCP_KEEPALIVE, true).setOpt(curl.libcurl.option.TIMEOUT, 2)
      .setOtherOpt(function (curl) {
        user.config.end = Date.now();
        user.config.checkout = user.config.checkout || user.config.end
      }).setHeaders([
        'authority: shopee.co.id',
        'pragma: no-cache',
        'cache-control: no-cache',
        'x-track-id: b26f0c4411c6ec81fdd4a770b81127bf82056f7c1275832a9a5aa6dc4f1b08e4aa7c97945459d6d56907f0d8e0aadf1eb5e584ef0b961ca54eb62487baf55e7b',
        'x-cv-id: 106',
        `user-agent: ${process.env.USER_AGENT}`,
        'content-type: application/json',
        'accept: application/json',
        'x-shopee-language: id',
        'x-requested-with: XMLHttpRequest',
        'if-none-match-: 55b03-8e6117c82a707ccb01b22fc18e91caff',
        'x-api-source: pc',
        `x-csrftoken: ${user.userCookie.csrftoken}`,
        'origin: https://shopee.co.id',
        'sec-fetch-site: same-origin',
        'sec-fetch-mode: cors',
        'sec-fetch-dest: empty',
        'referer: https://shopee.co.id/checkout',
        'accept-language: en-US,en;q=0.9',
        `cookie: ${curl.serializeCookie(user.userCookie)}`,
      ]).setBody(JSON.stringify(infoCheckout)).post(`https://shopee.co.id/api/v2/checkout/place_order`)
  }

  user.postBuyBodyLong = user.postBuyBodyLong || function (user) {

    user.infoCheckout = user.infoCheckoutTemp || user.infoCheckoutLong

    let shipping_orders = user.infoCheckout.shipping_orders[0]
    let checkout_price_data = user.infoCheckout.checkout_price_data
    let shoporders = user.infoCheckout.shoporders[0]
    let promotion_data = user.infoCheckout.promotion_data
    let logistic = shoporders.logistics.logistic_channels[shipping_orders.selected_logistic_channelid]
    let tax = taxCalc(user.payment.method, shipping_orders.shipping_fee, user.price)

    if (!user.infoCheckout.can_checkout) sendReportToDev(ctx, `${user.infoCheckout.disabled_checkout_info.description} - ${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")}`)

    return {
      status: 200,
      headers: {},
      client_id: user.infoCheckout.client_id,
      timestamp: Math.floor(user.config.timestamp / 1000),
      cart_type: user.infoCheckout.cart_type,
      shipping_orders: [
        {
          selected_logistic_channelid: shipping_orders.selected_logistic_channelid,
          cod_fee: shipping_orders.cod_fee,
          order_total: shipping_orders.shipping_fee + (user.price * user.config.quantity),
          shipping_id: shipping_orders.shipping_id,
          shopee_shipping_discount_id: shipping_orders.shopee_shipping_discount_id,
          selected_logistic_channelid_with_warning: shipping_orders.selected_logistic_channelid_with_warning,
          shipping_fee_discount: shipping_orders.shipping_fee_discount,
          shipping_group_description: shipping_orders.shipping_group_description,
          selected_preferred_delivery_time_option_id: 0,
          buyer_remark: shipping_orders.buyer_remark || "",
          buyer_address_data: shipping_orders.buyer_address_data,
          order_total_without_shipping: user.price * user.config.quantity,
          tax_payable: shipping_orders.tax_payable,
          is_fsv_applied: false,
          buyer_ic_number: shipping_orders.buyer_ic_number || "",
          fulfillment_info: shipping_orders.fulfillment_info,
          voucher_wallet_checking_channel_ids: shipping_orders.voucher_wallet_checking_channel_ids,
          shoporder_indexes: shipping_orders.shoporder_indexes,
          shipping_fee: shipping_orders.shipping_fee,
          tax_exemption: shipping_orders.tax_exemption,
          shipping_group_icon: shipping_orders.shipping_group_icon
        }
      ],
      disabled_checkout_info: user.infoCheckout.disabled_checkout_info,
      checkout_price_data: {
        shipping_subtotal: checkout_price_data.shipping_subtotal,
        shipping_discount_subtotal: checkout_price_data.shipping_discount_subtotal,
        shipping_subtotal_before_discount: checkout_price_data.shipping_subtotal_before_discount,
        bundle_deals_discount: checkout_price_data.bundle_deals_discount,
        group_buy_discount: checkout_price_data.group_buy_discount,
        merchandise_subtotal: user.price * user.config.quantity,
        tax_payable: checkout_price_data.tax_payable,
        buyer_txn_fee: checkout_price_data.buyer_txn_fee,
        credit_card_promotion: checkout_price_data.credit_card_promotion,
        promocode_applied: checkout_price_data.promocode_applied,
        shopee_coins_redeemed: checkout_price_data.shopee_coins_redeemed,
        total_payable: shipping_orders.shipping_fee + (user.price * user.config.quantity) + tax.value,
        tax_exemption: checkout_price_data.tax_exemption,
        insurance_subtotal: 0,
        vat_subtotal: 0
      },
      promotion_data: {
        promotion_msg: promotion_data.promotion_msg,
        price_discount: promotion_data.price_discount,
        can_use_coins: promotion_data.can_use_coins,
        voucher_info: promotion_data.voucher_info,
        coin_info: promotion_data.coin_info,
        free_shipping_voucher_info: {
          free_shipping_voucher_id: promotion_data.free_shipping_voucher_info.free_shipping_voucher_id || 0,
          disabled_reason: promotion_data.free_shipping_voucher_info.disabled_reason,
          free_shipping_voucher_code: promotion_data.free_shipping_voucher_info.free_shipping_voucher_code || "",
          banner_info: {
            msg: "",
            learn_more_msg: ""
          }
        },
        applied_voucher_code: promotion_data.applied_voucher_code,
        ...function (vouchers) {
          if (vouchers.length > 0) {
            for (const voucher of vouchers) {
              if (voucher.promotionid == user.config.promotionid) {
                return {
                  shop_voucher_entrances: [{
                    status: true,
                    shopid: user.config.shopid
                  }]
                }
              }
            }
          }
          return {
            shop_voucher_entrances: [{
              status: false,
              shopid: user.config.shopid
            }]
          }
        }(user.updateKeranjang.data.shop_vouchers),
        card_promotion_enabled: promotion_data.card_promotion_enabled,
        invalid_message: promotion_data.invalid_message,
        card_promotion_id: promotion_data.card_promotion_id,
        voucher_code: promotion_data.voucher_code,
        use_coins: promotion_data.use_coins,
        platform_vouchers: []
      },
      dropshipping_info: user.infoCheckout.dropshipping_info,
      selected_payment_channel_data: user.payment.method,
      shoporders: [
        {
          shop: shoporders.shop,
          buyer_remark: shoporders.buyer_remark || "",
          shipping_fee: shoporders.shipping_fee,
          order_total: shoporders.shipping_fee + (user.price * user.config.quantity),
          shipping_id: shoporders.shipping_id,
          buyer_ic_number: shoporders.buyer_ic_number || "",
          items: function (items) {
            items[0].stock = 0
            items[0].price = user.price
            items[0].promotion_id = user.config.promotionid
            items[0].is_flash_sale = user.infoBarang.item.upcoming_flash_sale || user.infoBarang.item.flash_sale
            return items
          }(shoporders.items),
          selected_preferred_delivery_time_option_id: 0,
          selected_logistic_channelid: shoporders.selected_logistic_channelid,
          cod_fee: shoporders.cod_fee,
          tax_payable: shoporders.tax_payable,
          buyer_address_data: shoporders.buyer_address_data,
          shipping_fee_discount: shoporders.shipping_fee_discount,
          tax_info: shoporders.tax_info,
          order_total_without_shipping: user.price * user.config.quantity,
          tax_exemption: shoporders.tax_exemption,
          ext_ad_info_mappings: []
        }
      ],
      buyer_info: user.infoCheckout.buyer_info,
      _cft: [],
      device_info: cookie.parse(`device_sz_fingerprint=${user.userCookie.shopee_webUnique_ccd}`),
      fsv_selection_infos: user.infoCheckout.fsv_selection_infos,
      can_checkout: true,
      order_update_info: {},
      buyer_txn_fee_info: tax.msg,
      captcha_version: 1
    }
  }(user)

  return buyIt(user.postBuyBodyLong)
}