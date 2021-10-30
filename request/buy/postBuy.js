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
      client_id: 0,
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
      client_id: user.infoCheckout.client_id,
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
      buyer_info: {
        share_to_friends_info: {
          display_toggle: false,
          enable_toggle: false,
          allow_to_share: false
        },
        checkout_email: ""
      },
      _cft: [],
      // device_info: cookie.parse(`device_sz_fingerprint=${user.userCookie.shopee_webUnique_ccd}`),
      device_info: {
        device_sz_fingerprint: "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||MTAwMDA="
      },
      fsv_selection_infos: [],
      can_checkout: true,
      order_update_info: {},
      buyer_txn_fee_info: tax.msg,
      captcha_version: 1
    }
  }(user)

  return buyIt(user.postBuyBodyLong)
}